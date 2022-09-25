const axios = require("axios");
const Configstore = require("configstore");
const R = require("ramda");
const dateFormat = require("dateformat");
const Table = require("tty-table");
const terminalLink = require("terminal-link");

const nflUrl = `http://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`;
const ncaaUrl = `http://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard`;

const gameStatusPath = [`status`, `type`, `name`];
const oddsPath = [`competitions`, 0, `odds`, 0, `details`];
const ouPath = [`competitions`, 0, `odds`, 0, `overUnder`];
const na = `n/a`;
const F = `℉`;

const Config = new Configstore(`sportsOdds`, {
  initTimestamp: new Date().getTime(),
});

const main = async () => {
  //@ts-ignore
  const ncaaResult = await axios.get(ncaaUrl);

  //@ts-ignore
  const nflResult = await axios.get(nflUrl);
  // const nflEvents = [bearsEvent, ...R.tail((R.path([`data`, `events`], nflResult)))];
  const events = [
    ...R.path([`data`, `events`], ncaaResult),
    // ...nflEvents
    ...R.path([`data`, `events`], nflResult),
  ];

  const filteredGames = filterAllGames(events);
  // const filteredGames = filterScheduled(events);
  // const filteredGames = filterInProgress(events);
  // const filteredGames = filterFinal(events);

  const sorter = (gameA, gameB) => gameA.timestamp - gameB.timestamp;
  const gamesComposer = R.compose(R.sort(sorter), assemblGameMap);
  //@ts-ignore
  const games = gamesComposer(filteredGames);
  const headers = makeHeaders(games);
  output(headers, games);
};

const pluckGamecastUrl = (event) => R.pathOr(`n/a`, [`links`, 0, `href`], event);

const getEventType = (event) =>
  R.cond([
    [isNFLEvent, R.always(`NFL`)],
    [R.T, R.always(`NCAA`)],
  ])(event);

const isNFLEvent = (event) => {
  const linkUrl = pluckGamecastUrl(event);
  return R.includes(`/nfl/`, linkUrl);
};

const createTerminalHREF = (description, url) => {
  const href = terminalLink(description, url, { fallback: false });
  // console.log(href);
  return href;
};

const makeHeaders = (games) => {
  const headers = require("./headers").headers;
  return headers;
};

const getHeaderWidth = (key) =>
  R.cond([
    [R.equals(`Weather`), R.always(40)],
    [R.equals(`Predicted Score`), R.always(30)],
    [R.equals(`O/U`), R.always(8)],
    [R.T, R.always(24)],
  ])(key);

const StatusType = {
  STATUS_SCHEDULED: `STATUS_SCHEDULED`,
  STATUS_IN_PROGRESS: `STATUS_IN_PROGRESS`,
  STATUS_FINAL: `STATUS_FINAL`,
};

const filterAllGames = R.filter(R.T);
const filterScheduled = R.filter(R.pathEq(gameStatusPath, StatusType.STATUS_SCHEDULED));

const filterInProgress = R.filter(R.pathEq(gameStatusPath, StatusType.STATUS_IN_PROGRESS));
const filterGameOver = R.filter(R.pathEq(gameStatusPath, StatusType.STATUS_FINAL));

const convertHalfFraction = R.replace(`.5`, `½`);
const removeDecimal = R.replace(`.0`, ``);

const lineExists = (event) => R.path(oddsPath); //{
// console.log(`R.path(oddsPath): ${JSON.stringify(R.path(oddsPath))}`);
//   if (R.path(oddsPath) === undefined) {
//     return false;
//   } else {
//     return tru;
//   }
// };
const ouExists = (event) => R.path(ouPath);

// const valueIsInvalid = value =>
//   R.anyPass([
//     R.equals(null),
//     R.equals(``),
//     R.equals(undefined),
//     R.equals(NaN),
//     R.equals(Infinity),
//     R.equals(na)
//   ])(value);

// // const valueIsValid = value => R.not(valueIsInvalid(value));

const getFromLocalStorage = (key) => Config.get(key);
const saveToLocalStorage = (key, value) => {
  // localStorage.setItem(key, JSON.stringify(value));
  Config.set(key, value);
  // console.log(`saved to local storage: \n\t${key}: ${value}`);
};

const getLine = (event) => (lineExists(event) ? getLineValue(event) : getFromLocalStorage(lineID));

const getOU = (event) => (ouExists(event) ? getOUValue(event) : getFromLocalStorage(ouID));

const getLineValue = (event) => R.compose(removeDecimal, convertHalfFraction, String, R.pathOr(na, oddsPath))(event);

const getOUValue = (event) => R.compose(removeDecimal, convertHalfFraction, String, R.pathOr(na, ouPath))(event);

const output = (header, rows, footer) => {
  let t1 = Table(header, rows, footer, {
    borderStyle: "1",
    borderColor: "yellow",
    // paddingBottom: `0`,
    // headerAlign: "center",
    // align: "center",
    color: "white",
    truncate: "...",
  });

  process.stdout.write(t1.render());
};

const showersEmojify = (weather) => {
  return R.includes(`shower`, weather) ? `🌧` : weather;
};
const rainEmojfy = (weather) => (R.includes(`rain`, weather) ? `☔️` : weather);
const partlySunnyEmojify = (weather) => (R.includes(`artly sunny`, weather) ? `⛅️` : weather);
const weatherEmojify = (weatherStr) => R.compose(String);

const nflTempPath = [`weather`, `highTemperature`];
const ncaaTempPath = [`weather`, `temperature`];
const weatherDisplayValuePath = [`weather`, `displayValue`];

const getWeatherDisplay = (event) => R.ifElse(R.hasPath(weatherDisplayValuePath), getWeather, R.always(na))(event);

const getWeather = (event) =>
  isNFLEvent(event)
    ? `${R.pathOr(na, weatherDisplayValuePath, event)} ${R.pathOr(na, nflTempPath, event)}${F}`
    : `${R.pathOr(na, weatherDisplayValuePath, event)} ${R.pathOr(na, ncaaTempPath, event)}${F}`;

const calcUnderdogTeam = (event) => {
  const lineStr = getLine(event);
  const favoredTeam = lineStr.split(` -`)[0];

  const visitingTeam = pluckAwayTeamFromEvent(event);
  const homeTeam = pluckHomeTeamFromEvent(event);
  const underdogTeam = homeTeam === favoredTeam ? visitingTeam : homeTeam;
  return underdogTeam;
};
const bettingLineSplit = R.split(` -`);
const calcFavoredTeam = (fullLineStr) => bettingLineSplit(fullLineStr)[0];
const pluckLineStr = (fullLineStr) => bettingLineSplit(fullLineStr)[1];

const calculateScores = (fullLineStr, ou) => {
  const lineStr = pluckLineStr(fullLineStr);
  const line = parseFloat(lineStr.replace(`½`, `.5`));
  const halfScore = ou / 2;
  const halfSpread = line / 2;
  const winningScore = Math.round(halfScore + halfSpread);
  const losingScore = Math.round(halfScore - halfSpread);

  return {
    winningScore,
    losingScore,
  };
};

const predictScore = (event) => {
  try {
    if (pluckStatusType(event) !== StatusType.STATUS_SCHEDULED) {
      return na;
    }
    const ouStr = getOU(event);
    const fullLineStr = getLine(event);
    const ou = parseInt(ouStr);
    const favoredTeam = calcFavoredTeam(fullLineStr);
    const underdogTeam = calcUnderdogTeam(event);
    const { winningScore, losingScore } = calculateScores(fullLineStr, ou);
    const scorePrediction = `${favoredTeam} ${winningScore}-${losingScore} ${underdogTeam}`;
    return scorePrediction;
  } catch (error) {
    return `n/a`;
  }
};
const pluckAwayTeamFromEvent = R.path([`competitions`, 0, `competitors`, 1, `team`, `abbreviation`]);
const pluckAwayTeamScore = R.path([`competitions`, 0, `competitors`, 1, `score`]);

const pluckHomeTeamFromEvent = R.path([`competitions`, 0, `competitors`, 0, `team`, `abbreviation`]);

const pluckHomeTeamScore = R.path([`competitions`, 0, `competitors`, 0, `score`]);

const isGameOver = (event) => R.allPass([R.pathEq([`status`, `clock`], 0), R.pathEq([`status`, `period`], 4)])(event);

const pluckGameClockQuarter = R.path([`status`, `period`]);
const pluckGameClockTime = R.path([`status`, `displayClock`]);

const gameClockDisplay = (event) => `Q${pluckGameClockQuarter(event)} ${pluckGameClockTime(event)}`;

const finalClockDisplay = () => `F`;
const isScheduled = (event) => StatusType.STATUS_SCHEDULED === pluckStatusType(event);

const getGameScoreDisplay = (event) => R.ifElse(isGameOver, finalScoreDisplay, inGameScoreDisplay)(event);

const homeTeamAndScoreDisplay = (event) => `${pluckHomeTeamScore(event)} ${pluckHomeTeamFromEvent(event)}`;
const awayTeamAndScoreDisplay = (event) => `${pluckAwayTeamFromEvent(event)} ${pluckAwayTeamScore(event)}`;

const gameScoreDisplay = (event) => `${awayTeamAndScoreDisplay(event)}-${homeTeamAndScoreDisplay(event)}`;

const inGameScoreDisplay = (event) => `${gameScoreDisplay(event)} [${gameClockDisplay(event)}]`;
const finalScoreDisplay = (event) => `${gameScoreDisplay(event)} [ ${finalClockDisplay()} ]`;

const getGameStatus = (event) => R.ifElse(isScheduled, pluckStatusDescription, getGameScoreDisplay)(event);

const pluckStatusDescription = (event) => formattedDate(event);
// const pluckStatusDescription = formattedDate.pathOr(na, [`status`, `type`, `description`]);

const pluckStatusType = R.pathOr(na, [`status`, `type`, `name`]);
const pluckDate = R.pathOr(na, [`date`]);

const lineID = (event) => `${event.id}-line`;
const ouID = (event) => `${event.id}-ou`;

const pluckTimestamp = (event) => {
  const eventDate = new Date(pluckDate(event));
  return eventDate.getTime() / 1000;
};
const formattedDate = (event) => {
  const eventDate = new Date(pluckDate(event));
  const date = dateFormat(new Date(eventDate), "ddd m/dd h:MM");
  return date;
};

const assembleGame = (event) => {
  // console.log(`lineExists(event): ${JSON.stringify(lineExists(event))}`);

  const game = {
    timestamp: pluckTimestamp(event),
    Date: formattedDate(event),
    Event: getEventType(event),
    Name: R.pathOr(na, [`shortName`], event),
    Line: getLine(event),
    [`Predicted Score`]: predictScore(event),
    [`O/U`]: getOU(event),
    Status: getGameStatus(event),
    Weather: getWeatherDisplay(event),
    // URL: createTerminalHREF(`Details`, pluckGamecastUrl(event)),
    URL: pluckGamecastUrl(event),
    // URL: "e]8;;http://example.come\\This is a linke]8;;e\\\n"
  };
  lineExists(event) && saveToLocalStorage(lineID(event), getLineValue(event));
  ouExists(event) && saveToLocalStorage(ouID(event), getOUValue(event));
  return game;
};

const assemblGameMap = R.map(assembleGame);

main();
