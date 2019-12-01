const axios = require("axios");
const R = require("ramda");
const dateFormat = require("dateformat");
const Table = require("tty-table");

const nflUrl = `http://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`;
const ncaaUrl = `http://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard`;

const gameStatusPath = [`status`, `type`, `name`];
const oddsPath = [`competitions`, 0, `odds`, 0, `details`];
const ouPath = [`competitions`, 0, `odds`, 0, `overUnder`];
const isNFLUrl = url => url.includes(`nfl`);
const isNFLEvent = R.hasPath([`weather`, `highTemperature`]);
const na = `n/a`;
const F = `℉`;

const main = async () => {
  //@ts-ignore
  const { data } = await axios.get(
    // ncaaUrl
    nflUrl
  );

  const { leagues, season, week, events } = data;

  const filteredGames = filterAllGames(events);
  // const filteredGames = filterScheduled(events);
  // const filteredGames = filterInProgress(events);
  // const filteredGames = filterFinal(events);

  const gamesComposer = R.compose(assemblGameMap);
  //@ts-ignore
  const games = gamesComposer(filteredGames);
  // console.log(`games: ${JSON.stringify(games)}`);
  const headers = makeHeaders(games);
  output(headers, games);
};

main();

const makeHeaders = games => {
  const keys = R.keys(games[0]);
  return keys.map(key => {
    return {
      value: key,
      headerColor: "cyan",
      color: "white",
      align: "center",
      paddingLeft: 2,
      width: getHeaderWidth(key)
    };
  });
};

const getHeaderWidth = key =>
  R.cond([
    [R.equals(`Weather`), R.always(40)],
    [R.equals(`Predicted Score`), R.always(40)],
    [R.equals(`O/U`), R.always(8)],
    [R.T, R.always(20)]
  ])(key);

const StatusType = {
  STATUS_SCHEDULED: `STATUS_SCHEDULED`,
  STATUS_IN_PROGRESS: `STATUS_IN_PROGRESS`,
  STATUS_FINAL: `STATUS_FINAL`
};

const filterAllGames = R.filter(R.T);
const filterScheduled = R.filter(
  R.pathEq(gameStatusPath, StatusType.STATUS_SCHEDULED)
);

const filterInProgress = R.filter(
  R.pathEq(gameStatusPath, StatusType.STATUS_IN_PROGRESS)
);
const filterFinal = R.filter(R.pathEq(gameStatusPath, StatusType.STATUS_FINAL));

const convertHalfFraction = R.replace(`.5`, `½`);
const removeDecimal = R.replace(`.0`, ``);

const getLine = event =>
  R.compose(
    removeDecimal,
    convertHalfFraction,
    String,
    R.pathOr(na, oddsPath)
  )(event);

const getOU = event =>
  R.compose(
    removeDecimal,
    convertHalfFraction,
    String,
    R.pathOr(na, ouPath)
  )(event);

const output = (header, rows, footer) => {
  let t1 = Table(header, rows, footer, {
    borderStyle: 1,
    borderColor: "blue",
    paddingBottom: 0,
    headerAlign: "center",
    align: "center",
    color: "white",
    truncate: "..."
  });

  console.log(t1.render());
};

const showersEmojify = weather => {
  return R.includes(`shower`, weather) ? `🌧` : weather;
};

const rainEmojfy = weather => (R.includes(`rain`, weather) ? `☔️` : weather);
const partlySunnyEmojify = weather =>
  R.includes(`artly sunny`, weather) ? `⛅️` : weather;

const weatherEmojify = weatherStr => R.compose(String);
const nflTempPath = [`weather`, `highTemperature`];
const ncaaTempPath = [`weather`, `temperature`];
const weatherDisplayValuePath = [`weather`, `displayValue`];

const getWeather = event =>
  isNFLEvent(event)
    ? `${R.pathOr(na, weatherDisplayValuePath, event)} ${R.pathOr(
        na,
        nflTempPath,
        event
      )}${F}`
    : `${R.pathOr(na, weatherDisplayValuePath, event)} ${R.pathOr(
        na,
        ncaaTempPath,
        event
      )}${F}`;

const determineUnderdogTeam = event => {
  const lineStr = getLine(event);
  const favoredTeam = lineStr.split(` -`)[0];

  const visitingTeam = pluckVisitingTeamFromEvent(event);
  const homeTeam = pluckHomeTeamFromEvent(event);
  const underdogTeam = homeTeam === favoredTeam ? visitingTeam : homeTeam;
  return underdogTeam;
};

const predictScore = event => {
  try {
    if (pluckStatusType(event) !== StatusType.STATUS_SCHEDULED) {
      return na;
    }
    const ouStr = getOU(event);
    const fullLineStr = getLine(event);
    const ou = parseInt(ouStr);
    // const line = parseInt(fullLineStr);

    const [favoredTeam, lineStr] = fullLineStr.split(` -`);
    const line = parseFloat(lineStr.replace(`½`, `.5`));
    const underdogTeam = determineUnderdogTeam(event);
    const halfScore = ou / 2;
    const halfSpread = line / 2;
    const winningScore = Math.round(halfScore + halfSpread);
    const losingScore = Math.round(halfScore - halfSpread);
    const scorePrediction = `${favoredTeam} ${winningScore}-${losingScore} ${underdogTeam}`;
    return scorePrediction;
  } catch (error) {
    return `n/a`;
  }
};
const pluckVisitingTeamFromEvent = R.path([
  `competitions`,
  0,
  `competitors`,
  1,
  `team`,
  `abbreviation`
]);

const pluckHomeTeamFromEvent = R.path([
  `competitions`,
  0,
  `competitors`,
  0,
  `team`,
  `abbreviation`
]);

const pluckStatusDescription = R.pathOr(na, [`status`, `type`, `description`]);
const pluckStatusType = R.pathOr(na, [`status`, `type`, `name`]);

const assembleGame = event => {
  const date = dateFormat(new Date(R.pathOr(na, [`date`], event)), "longTime");
  const game = {
    Date: date,
    Name: R.pathOr(na, [`shortName`], event),
    Line: getLine(event),
    [`Predicted Score`]: predictScore(event),
    [`O/U`]: getOU(event),
    Status: pluckStatusDescription(event),
    Weather: getWeather(event)
  };
  // console.log(`game: ${JSON.stringify(game)}`);
  return game;
};

const assemblGameMap = R.map(assembleGame);
