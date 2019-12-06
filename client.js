const axios = require("axios");
const Configstore = require("configstore");
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

const Config = new Configstore(`sportsOdds`, {
  initTimestamp: new Date().getTime()
});

const main = async () => {

  //@ts-ignore
  const ncaaResult = await axios.get(ncaaUrl);

  //@ts-ignore
  const nflResult = await axios.get(nflUrl);
  const nflEvents = [bearsEvent, ...R.tail((R.path([`data`, `events`], nflResult)))];
  const events = [
    ...R.path([`data`, `events`], ncaaResult),
    // ...nflEvents
    ...R.path([`data`, `events`], nflResult)
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

main();

const makeHeaders = games => {
  const headers = require("./headers").headers;
  return headers;
};

const getHeaderWidth = key =>
  R.cond([
    [R.equals(`Weather`), R.always(40)],
    [R.equals(`Predicted Score`), R.always(30)],
    [R.equals(`O/U`), R.always(8)],
    [R.T, R.always(24)]
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
const filterGameOver = R.filter(
  R.pathEq(gameStatusPath, StatusType.STATUS_FINAL)
);

const convertHalfFraction = R.replace(`.5`, `½`);
const removeDecimal = R.replace(`.0`, ``);

const lineExists = event => R.path(oddsPath)//{
  // console.log(`R.path(oddsPath): ${JSON.stringify(R.path(oddsPath))}`);
//   if (R.path(oddsPath) === undefined) {
//     return false;
//   } else {
//     return tru;
//   }
// };
const ouExists = event => R.path(ouPath);

const getFromLocalStorage = key => Config.get(key);
const saveToLocalStorage = (key, value) => {
  // localStorage.setItem(key, JSON.stringify(value));
  Config.set(key, value);
  console.log(`saved to local storage: \n\t${key}: ${value}`);
};

const getLine = event =>
  lineExists(event) ? getLineValue(event) : getFromLocalStorage(lineID);

const getOU = event =>
  ouExists(event) ? getOUValue(event) : getFromLocalStorage(ouID);

const getLineValue = event =>
  R.compose(
    removeDecimal,
    convertHalfFraction,
    String,
    R.pathOr(na, oddsPath)
  )(event);

const getOUValue = event =>
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

const getWeatherDisplay = event =>
  R.ifElse(R.hasPath(weatherDisplayValuePath), getWeather, R.always(na))(event);

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

const calcUnderdogTeam = event => {
  const lineStr = getLine(event);
  const favoredTeam = lineStr.split(` -`)[0];

  const visitingTeam = pluckAwayTeamFromEvent(event);
  const homeTeam = pluckHomeTeamFromEvent(event);
  const underdogTeam = homeTeam === favoredTeam ? visitingTeam : homeTeam;
  return underdogTeam;
};
const bettingLineSplit = R.split(` -`);
const calcFavoredTeam = fullLineStr => bettingLineSplit(fullLineStr)[0];
const pluckLineStr = fullLineStr => bettingLineSplit(fullLineStr)[1];

const calculateScores = (fullLineStr, ou) => {
  const lineStr = pluckLineStr(fullLineStr);
  const line = parseFloat(lineStr.replace(`½`, `.5`));
  const halfScore = ou / 2;
  const halfSpread = line / 2;
  const winningScore = Math.round(halfScore + halfSpread);
  const losingScore = Math.round(halfScore - halfSpread);

  return {
    winningScore,
    losingScore
  };
};

const predictScore = event => {
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
const pluckAwayTeamFromEvent = R.path([
  `competitions`,
  0,
  `competitors`,
  1,
  `team`,
  `abbreviation`
]);
const pluckAwayTeamScore = R.path([
  `competitions`,
  0,
  `competitors`,
  1,
  `score`
]);

const pluckHomeTeamFromEvent = R.path([
  `competitions`,
  0,
  `competitors`,
  0,
  `team`,
  `abbreviation`
]);

const pluckHomeTeamScore = R.path([
  `competitions`,
  0,
  `competitors`,
  0,
  `score`
]);

const isGameOver = event =>
  R.allPass([
    R.pathEq([`status`, `clock`], 0),
    R.pathEq([`status`, `period`], 4)
  ])(event);

const pluckGameClockQuarter = R.path([`status`, `period`]);
const pluckGameClockTime = R.path([`status`, `displayClock`]);

const gameClockDisplay = event =>
  `Q${pluckGameClockQuarter(event)} ${pluckGameClockTime(event)}`;

const finalClockDisplay = () => `F`;
const isScheduled = event =>
  StatusType.STATUS_SCHEDULED === pluckStatusType(event);

const getGameScoreDisplay = event =>
  R.ifElse(isGameOver, finalScoreDisplay, inGameScoreDisplay)(event);

const homeTeamAndScoreDisplay = event =>
  `${pluckHomeTeamScore(event)} ${pluckHomeTeamFromEvent(event)}`;
const awayTeamAndScoreDisplay = event =>
  `${pluckAwayTeamFromEvent(event)} ${pluckAwayTeamScore(event)}`;

const gameScoreDisplay = event =>
  `${awayTeamAndScoreDisplay(event)}-${homeTeamAndScoreDisplay(event)}`;

const inGameScoreDisplay = event =>
  `${gameScoreDisplay(event)}  ${gameClockDisplay(event)}]`;
const finalScoreDisplay = event =>
  `${gameScoreDisplay(event)} [ ${finalClockDisplay()} ]`;

const getGameStatus = event =>
  R.ifElse(isScheduled, pluckStatusDescription, getGameScoreDisplay)(event);

const pluckStatusDescription = R.pathOr(na, [`status`, `type`, `description`]);

const pluckStatusType = R.pathOr(na, [`status`, `type`, `name`]);
const pluckDate = R.pathOr(na, [`date`]);

const lineID = event => `${event.id}-line`;
const ouID = event => `${event.id}-ou`;

const assembleGame = event => {
  const eventDate = new Date(pluckDate(event));
  const timestamp = eventDate.getTime() / 1000;
  const date = dateFormat(new Date(eventDate), "ddd m/dd h:MM");
  // console.log(`lineExists(event): ${JSON.stringify(lineExists(event))}`);
  
  const game = {
    timestamp,
    Date: date,
    Name: R.pathOr(na, [`shortName`], event),
    Line: getLine(event),
    [`Predicted Score`]: predictScore(event),
    [`O/U`]: getOU(event),
    Status: getGameStatus(event),
    Weather: getWeatherDisplay(event)
  };
  lineExists(event) && saveToLocalStorage(lineID(event), getLineValue(event));
  ouExists(event) && saveToLocalStorage(ouID(event), getOUValue(event));
  return game;
};

const assemblGameMap = R.map(assembleGame);


const bearsEvent =   {
    "id": "401127871",
    "uid": "s:20~l:28~e:401127871",
    "date": "2019-12-06T01:20Z",
    "name": "Dallas Cowboys at Chicago Bears",
    "shortName": "DAL @ CHI",
    "season": {
      "year": 2019,
      "type": 2
    },
    "competitions": [
      {
        "id": "401127871",
        "uid": "s:20~l:28~e:401127871~c:401127871",
        "date": "2019-12-06T01:20Z",
        "attendance": 0,
        "type": {
          "id": "1"
        },
        "timeValid": true,
        "neutralSite": false,
        "conferenceCompetition": false,
        "recent": false,
        "venue": {
          "id": "3933",
          "fullName": "Soldier Field",
          "address": {
            "city": "Chicago",
            "state": "IL"
          },
          "capacity": 61500,
          "indoor": false
        },
        "competitors": [
          {
            "id": "3",
            "uid": "s:20~l:28~t:3",
            "type": "team",
            "order": 0,
            "homeAway": "home",
            "team": {
              "id": "3",
              "uid": "s:20~l:28~t:3",
              "location": "Chicago",
              "name": "Bears",
              "abbreviation": "CHI",
              "displayName": "Chicago Bears",
              "shortDisplayName": "Bears",
              "color": "152644",
              "alternateColor": "0b162a",
              "isActive": true,
              "venue": {
                "id": "3933"
              },
              "links": [
                {
                  "rel": [
                    "clubhouse",
                    "desktop",
                    "team"
                  ],
                  "href": "http://www.espn.com/nfl/team/_/name/chi/chicago-bears",
                  "text": "Clubhouse",
                  "isExternal": false,
                  "isPremium": false
                },
                {
                  "rel": [
                    "roster",
                    "desktop",
                    "team"
                  ],
                  "href": "http://www.espn.com/nfl/team/roster/_/name/chi/chicago-bears",
                  "text": "Roster",
                  "isExternal": false,
                  "isPremium": false
                },
                {
                  "rel": [
                    "stats",
                    "desktop",
                    "team"
                  ],
                  "href": "http://www.espn.com/nfl/team/stats/_/name/chi/chicago-bears",
                  "text": "Statistics",
                  "isExternal": false,
                  "isPremium": false
                },
                {
                  "rel": [
                    "schedule",
                    "desktop",
                    "team"
                  ],
                  "href": "http://www.espn.com/nfl/team/schedule/_/name/chi",
                  "text": "Schedule",
                  "isExternal": false,
                  "isPremium": false
                },
                {
                  "rel": [
                    "photos",
                    "desktop",
                    "team"
                  ],
                  "href": "http://www.espn.com/nfl/team/photos/_/name/chi",
                  "text": "photos",
                  "isExternal": false,
                  "isPremium": false
                },
                {
                  "rel": [
                    "scores",
                    "sportscenter",
                    "app",
                    "team"
                  ],
                  "href": "sportscenter://x-callback-url/showClubhouse?uid=s:20~l:28~t:3&section=scores",
                  "text": "Scores",
                  "isExternal": false,
                  "isPremium": false
                },
                {
                  "rel": [
                    "draftpicks",
                    "desktop",
                    "team"
                  ],
                  "href": "http://www.espn.com/nfl/draft/teams/_/name/chi/chicago-bears",
                  "text": "Draft Picks",
                  "isExternal": false,
                  "isPremium": true
                },
                {
                  "rel": [
                    "transactions",
                    "desktop",
                    "team"
                  ],
                  "href": "http://www.espn.com/nfl/team/transactions/_/name/chi",
                  "text": "Transactions",
                  "isExternal": false,
                  "isPremium": false
                },
                {
                  "rel": [
                    "injuries",
                    "desktop",
                    "team"
                  ],
                  "href": "http://www.espn.com/nfl/team/injuries/_/name/chi",
                  "text": "Injuries",
                  "isExternal": false,
                  "isPremium": false
                },
                {
                  "rel": [
                    "depthchart",
                    "desktop",
                    "team"
                  ],
                  "href": "http://www.espn.com/nfl/team/depth/_/name/chi",
                  "text": "Depth Chart",
                  "isExternal": false,
                  "isPremium": false
                }
              ],
              "logo": "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/chi.png"
            },
            "score": "0",
            "linescores": [
              {
                "value": 0
              }
            ],
            "statistics": [],
            "records": [
              {
                "name": "All Splits",
                "abbreviation": "Any",
                "type": "total",
                "summary": "6-6"
              },
              {
                "name": "Home",
                "type": "home",
                "summary": "3-3"
              },
              {
                "name": "Road",
                "type": "road",
                "summary": "3-3"
              }
            ],
            "leaders": [
              {
                "name": "passingLeader",
                "displayName": "Passing Leader",
                "shortDisplayName": "PASS",
                "abbreviation": "PYDS",
                "leaders": [
                  {
                    "displayValue": "230-361, 2196 YDS, 13 TD, 7 INT",
                    "value": 2196,
                    "athlete": {
                      "id": "3039707",
                      "fullName": "Mitchell Trubisky",
                      "displayName": "Mitchell Trubisky",
                      "shortName": "M. Trubisky",
                      "links": [
                        {
                          "rel": [
                            "playercard",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/_/id/3039707/mitchell-trubisky"
                        },
                        {
                          "rel": [
                            "stats",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/stats/_/id/3039707/mitchell-trubisky"
                        },
                        {
                          "rel": [
                            "splits",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/splits/_/id/3039707/mitchell-trubisky"
                        },
                        {
                          "rel": [
                            "gamelog",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/gamelog/_/id/3039707/mitchell-trubisky"
                        },
                        {
                          "rel": [
                            "news",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/news/_/id/3039707/mitchell-trubisky"
                        },
                        {
                          "rel": [
                            "bio",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/bio/_/id/3039707/mitchell-trubisky"
                        },
                        {
                          "rel": [
                            "overview",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/_/id/3039707/mitchell-trubisky"
                        }
                      ],
                      "jersey": "10",
                      "headshot": "https://a.espncdn.com/i/headshots/nfl/players/full/3039707.png",
                      "position": {
                        "abbreviation": "QB"
                      },
                      "team": {
                        "id": "3"
                      },
                      "active": true
                    },
                    "team": {
                      "id": "3"
                    }
                  }
                ]
              },
              {
                "name": "rushingLeader",
                "displayName": "Rushing Leader",
                "shortDisplayName": "RUSH",
                "abbreviation": "RYDS",
                "leaders": [
                  {
                    "displayValue": "172 CAR, 594 YDS, 5 TD",
                    "value": 594,
                    "athlete": {
                      "id": "4035538",
                      "fullName": "David Montgomery",
                      "displayName": "David Montgomery",
                      "shortName": "D. Montgomery",
                      "links": [
                        {
                          "rel": [
                            "playercard",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/_/id/4035538/david-montgomery"
                        },
                        {
                          "rel": [
                            "stats",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/stats/_/id/4035538/david-montgomery"
                        },
                        {
                          "rel": [
                            "splits",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/splits/_/id/4035538/david-montgomery"
                        },
                        {
                          "rel": [
                            "gamelog",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/gamelog/_/id/4035538/david-montgomery"
                        },
                        {
                          "rel": [
                            "news",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/news/_/id/4035538/david-montgomery"
                        },
                        {
                          "rel": [
                            "bio",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/bio/_/id/4035538/david-montgomery"
                        },
                        {
                          "rel": [
                            "overview",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/_/id/4035538/david-montgomery"
                        }
                      ],
                      "jersey": "32",
                      "headshot": "https://a.espncdn.com/i/headshots/nfl/players/full/4035538.png",
                      "position": {
                        "abbreviation": "RB"
                      },
                      "team": {
                        "id": "3"
                      },
                      "active": true
                    },
                    "team": {
                      "id": "3"
                    }
                  }
                ]
              },
              {
                "name": "receivingLeader",
                "displayName": "Receiving Leader",
                "shortDisplayName": "REC",
                "abbreviation": "RECYDS",
                "leaders": [
                  {
                    "displayValue": "71 REC, 850 YDS, 5 TD",
                    "value": 850,
                    "athlete": {
                      "id": "16799",
                      "fullName": "Allen Robinson II",
                      "displayName": "Allen Robinson II",
                      "shortName": "A. Robinson II",
                      "links": [
                        {
                          "rel": [
                            "playercard",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/_/id/16799/allen-robinson-ii"
                        },
                        {
                          "rel": [
                            "stats",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/stats/_/id/16799/allen-robinson-ii"
                        },
                        {
                          "rel": [
                            "splits",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/splits/_/id/16799/allen-robinson-ii"
                        },
                        {
                          "rel": [
                            "gamelog",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/gamelog/_/id/16799/allen-robinson-ii"
                        },
                        {
                          "rel": [
                            "news",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/news/_/id/16799/allen-robinson-ii"
                        },
                        {
                          "rel": [
                            "bio",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/bio/_/id/16799/allen-robinson-ii"
                        },
                        {
                          "rel": [
                            "overview",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/_/id/16799/allen-robinson-ii"
                        }
                      ],
                      "jersey": "12",
                      "headshot": "https://a.espncdn.com/i/headshots/nfl/players/full/16799.png",
                      "position": {
                        "abbreviation": "WR"
                      },
                      "team": {
                        "id": "3"
                      },
                      "active": true
                    },
                    "team": {
                      "id": "3"
                    }
                  }
                ]
              }
            ]
          },
          {
            "id": "6",
            "uid": "s:20~l:28~t:6",
            "type": "team",
            "order": 1,
            "homeAway": "away",
            "team": {
              "id": "6",
              "uid": "s:20~l:28~t:6",
              "location": "Dallas",
              "name": "Cowboys",
              "abbreviation": "DAL",
              "displayName": "Dallas Cowboys",
              "shortDisplayName": "Cowboys",
              "color": "002E4D",
              "alternateColor": "b0b7bc",
              "isActive": true,
              "venue": {
                "id": "3687"
              },
              "links": [
                {
                  "rel": [
                    "clubhouse",
                    "desktop",
                    "team"
                  ],
                  "href": "http://www.espn.com/nfl/team/_/name/dal/dallas-cowboys",
                  "text": "Clubhouse",
                  "isExternal": false,
                  "isPremium": false
                },
                {
                  "rel": [
                    "roster",
                    "desktop",
                    "team"
                  ],
                  "href": "http://www.espn.com/nfl/team/roster/_/name/dal/dallas-cowboys",
                  "text": "Roster",
                  "isExternal": false,
                  "isPremium": false
                },
                {
                  "rel": [
                    "stats",
                    "desktop",
                    "team"
                  ],
                  "href": "http://www.espn.com/nfl/team/stats/_/name/dal/dallas-cowboys",
                  "text": "Statistics",
                  "isExternal": false,
                  "isPremium": false
                },
                {
                  "rel": [
                    "schedule",
                    "desktop",
                    "team"
                  ],
                  "href": "http://www.espn.com/nfl/team/schedule/_/name/dal",
                  "text": "Schedule",
                  "isExternal": false,
                  "isPremium": false
                },
                {
                  "rel": [
                    "photos",
                    "desktop",
                    "team"
                  ],
                  "href": "http://www.espn.com/nfl/team/photos/_/name/dal",
                  "text": "photos",
                  "isExternal": false,
                  "isPremium": false
                },
                {
                  "rel": [
                    "scores",
                    "sportscenter",
                    "app",
                    "team"
                  ],
                  "href": "sportscenter://x-callback-url/showClubhouse?uid=s:20~l:28~t:6&section=scores",
                  "text": "Scores",
                  "isExternal": false,
                  "isPremium": false
                },
                {
                  "rel": [
                    "draftpicks",
                    "desktop",
                    "team"
                  ],
                  "href": "http://www.espn.com/nfl/draft/teams/_/name/dal/dallas-cowboys",
                  "text": "Draft Picks",
                  "isExternal": false,
                  "isPremium": true
                },
                {
                  "rel": [
                    "transactions",
                    "desktop",
                    "team"
                  ],
                  "href": "http://www.espn.com/nfl/team/transactions/_/name/dal",
                  "text": "Transactions",
                  "isExternal": false,
                  "isPremium": false
                },
                {
                  "rel": [
                    "injuries",
                    "desktop",
                    "team"
                  ],
                  "href": "http://www.espn.com/nfl/team/injuries/_/name/dal",
                  "text": "Injuries",
                  "isExternal": false,
                  "isPremium": false
                },
                {
                  "rel": [
                    "depthchart",
                    "desktop",
                    "team"
                  ],
                  "href": "http://www.espn.com/nfl/team/depth/_/name/dal",
                  "text": "Depth Chart",
                  "isExternal": false,
                  "isPremium": false
                }
              ],
              "logo": "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/dal.png"
            },
            "score": "0",
            "linescores": [
              {
                "value": 0
              }
            ],
            "statistics": [],
            "records": [
              {
                "name": "All Splits",
                "abbreviation": "Any",
                "type": "total",
                "summary": "6-6"
              },
              {
                "name": "Home",
                "type": "home",
                "summary": "3-3"
              },
              {
                "name": "Road",
                "type": "road",
                "summary": "3-3"
              }
            ],
            "leaders": [
              {
                "name": "passingLeader",
                "displayName": "Passing Leader",
                "shortDisplayName": "PASS",
                "abbreviation": "PYDS",
                "leaders": [
                  {
                    "displayValue": "298-447, 3788 YDS, 23 TD, 11 INT",
                    "value": 3788,
                    "athlete": {
                      "id": "2577417",
                      "fullName": "Dak Prescott",
                      "displayName": "Dak Prescott",
                      "shortName": "D. Prescott",
                      "links": [
                        {
                          "rel": [
                            "playercard",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/_/id/2577417/dak-prescott"
                        },
                        {
                          "rel": [
                            "stats",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/stats/_/id/2577417/dak-prescott"
                        },
                        {
                          "rel": [
                            "splits",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/splits/_/id/2577417/dak-prescott"
                        },
                        {
                          "rel": [
                            "gamelog",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/gamelog/_/id/2577417/dak-prescott"
                        },
                        {
                          "rel": [
                            "news",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/news/_/id/2577417/dak-prescott"
                        },
                        {
                          "rel": [
                            "bio",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/bio/_/id/2577417/dak-prescott"
                        },
                        {
                          "rel": [
                            "overview",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/_/id/2577417/dak-prescott"
                        }
                      ],
                      "jersey": "4",
                      "headshot": "https://a.espncdn.com/i/headshots/nfl/players/full/2577417.png",
                      "position": {
                        "abbreviation": "QB"
                      },
                      "team": {
                        "id": "6"
                      },
                      "active": true
                    },
                    "team": {
                      "id": "6"
                    }
                  }
                ]
              },
              {
                "name": "rushingLeader",
                "displayName": "Rushing Leader",
                "shortDisplayName": "RUSH",
                "abbreviation": "RYDS",
                "leaders": [
                  {
                    "displayValue": "227 CAR, 990 YDS, 7 TD",
                    "value": 990,
                    "athlete": {
                      "id": "3051392",
                      "fullName": "Ezekiel Elliott",
                      "displayName": "Ezekiel Elliott",
                      "shortName": "E. Elliott",
                      "links": [
                        {
                          "rel": [
                            "playercard",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/_/id/3051392/ezekiel-elliott"
                        },
                        {
                          "rel": [
                            "stats",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/stats/_/id/3051392/ezekiel-elliott"
                        },
                        {
                          "rel": [
                            "splits",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/splits/_/id/3051392/ezekiel-elliott"
                        },
                        {
                          "rel": [
                            "gamelog",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/gamelog/_/id/3051392/ezekiel-elliott"
                        },
                        {
                          "rel": [
                            "news",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/news/_/id/3051392/ezekiel-elliott"
                        },
                        {
                          "rel": [
                            "bio",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/bio/_/id/3051392/ezekiel-elliott"
                        },
                        {
                          "rel": [
                            "overview",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/_/id/3051392/ezekiel-elliott"
                        }
                      ],
                      "jersey": "21",
                      "headshot": "https://a.espncdn.com/i/headshots/nfl/players/full/3051392.png",
                      "position": {
                        "abbreviation": "RB"
                      },
                      "team": {
                        "id": "6"
                      },
                      "active": true
                    },
                    "team": {
                      "id": "6"
                    }
                  }
                ]
              },
              {
                "name": "receivingLeader",
                "displayName": "Receiving Leader",
                "shortDisplayName": "REC",
                "abbreviation": "RECYDS",
                "leaders": [
                  {
                    "displayValue": "64 REC, 971 YDS, 7 TD",
                    "value": 971,
                    "athlete": {
                      "id": "2976499",
                      "fullName": "Amari Cooper",
                      "displayName": "Amari Cooper",
                      "shortName": "A. Cooper",
                      "links": [
                        {
                          "rel": [
                            "playercard",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/_/id/2976499/amari-cooper"
                        },
                        {
                          "rel": [
                            "stats",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/stats/_/id/2976499/amari-cooper"
                        },
                        {
                          "rel": [
                            "splits",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/splits/_/id/2976499/amari-cooper"
                        },
                        {
                          "rel": [
                            "gamelog",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/gamelog/_/id/2976499/amari-cooper"
                        },
                        {
                          "rel": [
                            "news",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/news/_/id/2976499/amari-cooper"
                        },
                        {
                          "rel": [
                            "bio",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/bio/_/id/2976499/amari-cooper"
                        },
                        {
                          "rel": [
                            "overview",
                            "desktop",
                            "athlete"
                          ],
                          "href": "http://www.espn.com/nfl/player/_/id/2976499/amari-cooper"
                        }
                      ],
                      "jersey": "19",
                      "headshot": "https://a.espncdn.com/i/headshots/nfl/players/full/2976499.png",
                      "position": {
                        "abbreviation": "WR"
                      },
                      "team": {
                        "id": "6"
                      },
                      "active": true
                    },
                    "team": {
                      "id": "6"
                    }
                  }
                ]
              }
            ]
          }
        ],
        "notes": [],
        "status": {
          "clock": 900,
          "displayClock": "15:00",
          "period": 1,
          "type": {
            "id": "1",
            "name": "STATUS_SCHEDULED",
            "state": "pre",
            "completed": false,
            "description": "Scheduled",
            "detail": "Thu, December 5th at 8:20 PM EST",
            "shortDetail": "12/5 - 8:20 PM EST"
          }
        },
        "broadcasts": [
          {
            "market": "national",
            "names": [
              "FOX",
              "NFL"
            ]
          }
        ],
        "leaders": [
          {
            "name": "passingYards",
            "displayName": "Passing Leader",
            "shortDisplayName": "PASS",
            "abbreviation": "PYDS",
            "leaders": [
              {
                "displayValue": "298-447, 3788 YDS, 23 TD, 11 INT",
                "value": 3788,
                "athlete": {
                  "id": "2577417",
                  "fullName": "Dak Prescott",
                  "displayName": "Dak Prescott",
                  "shortName": "D. Prescott",
                  "links": [
                    {
                      "rel": [
                        "playercard",
                        "desktop",
                        "athlete"
                      ],
                      "href": "http://www.espn.com/nfl/player/_/id/2577417/dak-prescott"
                    },
                    {
                      "rel": [
                        "stats",
                        "desktop",
                        "athlete"
                      ],
                      "href": "http://www.espn.com/nfl/player/stats/_/id/2577417/dak-prescott"
                    },
                    {
                      "rel": [
                        "splits",
                        "desktop",
                        "athlete"
                      ],
                      "href": "http://www.espn.com/nfl/player/splits/_/id/2577417/dak-prescott"
                    },
                    {
                      "rel": [
                        "gamelog",
                        "desktop",
                        "athlete"
                      ],
                      "href": "http://www.espn.com/nfl/player/gamelog/_/id/2577417/dak-prescott"
                    },
                    {
                      "rel": [
                        "news",
                        "desktop",
                        "athlete"
                      ],
                      "href": "http://www.espn.com/nfl/player/news/_/id/2577417/dak-prescott"
                    },
                    {
                      "rel": [
                        "bio",
                        "desktop",
                        "athlete"
                      ],
                      "href": "http://www.espn.com/nfl/player/bio/_/id/2577417/dak-prescott"
                    },
                    {
                      "rel": [
                        "overview",
                        "desktop",
                        "athlete"
                      ],
                      "href": "http://www.espn.com/nfl/player/_/id/2577417/dak-prescott"
                    }
                  ],
                  "jersey": "4",
                  "headshot": "https://a.espncdn.com/i/headshots/nfl/players/full/2577417.png",
                  "position": {
                    "abbreviation": "QB"
                  },
                  "team": {
                    "id": "6"
                  },
                  "active": true
                },
                "team": {
                  "id": "6"
                }
              }
            ]
          },
          {
            "name": "rushingYards",
            "displayName": "Rushing Leader",
            "shortDisplayName": "RUSH",
            "abbreviation": "RYDS",
            "leaders": [
              {
                "displayValue": "227 CAR, 990 YDS, 7 TD",
                "value": 990,
                "athlete": {
                  "id": "3051392",
                  "fullName": "Ezekiel Elliott",
                  "displayName": "Ezekiel Elliott",
                  "shortName": "E. Elliott",
                  "links": [
                    {
                      "rel": [
                        "playercard",
                        "desktop",
                        "athlete"
                      ],
                      "href": "http://www.espn.com/nfl/player/_/id/3051392/ezekiel-elliott"
                    },
                    {
                      "rel": [
                        "stats",
                        "desktop",
                        "athlete"
                      ],
                      "href": "http://www.espn.com/nfl/player/stats/_/id/3051392/ezekiel-elliott"
                    },
                    {
                      "rel": [
                        "splits",
                        "desktop",
                        "athlete"
                      ],
                      "href": "http://www.espn.com/nfl/player/splits/_/id/3051392/ezekiel-elliott"
                    },
                    {
                      "rel": [
                        "gamelog",
                        "desktop",
                        "athlete"
                      ],
                      "href": "http://www.espn.com/nfl/player/gamelog/_/id/3051392/ezekiel-elliott"
                    },
                    {
                      "rel": [
                        "news",
                        "desktop",
                        "athlete"
                      ],
                      "href": "http://www.espn.com/nfl/player/news/_/id/3051392/ezekiel-elliott"
                    },
                    {
                      "rel": [
                        "bio",
                        "desktop",
                        "athlete"
                      ],
                      "href": "http://www.espn.com/nfl/player/bio/_/id/3051392/ezekiel-elliott"
                    },
                    {
                      "rel": [
                        "overview",
                        "desktop",
                        "athlete"
                      ],
                      "href": "http://www.espn.com/nfl/player/_/id/3051392/ezekiel-elliott"
                    }
                  ],
                  "jersey": "21",
                  "headshot": "https://a.espncdn.com/i/headshots/nfl/players/full/3051392.png",
                  "position": {
                    "abbreviation": "RB"
                  },
                  "team": {
                    "id": "6"
                  },
                  "active": true
                },
                "team": {
                  "id": "6"
                }
              }
            ]
          },
          {
            "name": "receivingYards",
            "displayName": "Receiving Leader",
            "shortDisplayName": "REC",
            "abbreviation": "RECYDS",
            "leaders": [
              {
                "displayValue": "64 REC, 971 YDS, 7 TD",
                "value": 971,
                "athlete": {
                  "id": "2976499",
                  "fullName": "Amari Cooper",
                  "displayName": "Amari Cooper",
                  "shortName": "A. Cooper",
                  "links": [
                    {
                      "rel": [
                        "playercard",
                        "desktop",
                        "athlete"
                      ],
                      "href": "http://www.espn.com/nfl/player/_/id/2976499/amari-cooper"
                    },
                    {
                      "rel": [
                        "stats",
                        "desktop",
                        "athlete"
                      ],
                      "href": "http://www.espn.com/nfl/player/stats/_/id/2976499/amari-cooper"
                    },
                    {
                      "rel": [
                        "splits",
                        "desktop",
                        "athlete"
                      ],
                      "href": "http://www.espn.com/nfl/player/splits/_/id/2976499/amari-cooper"
                    },
                    {
                      "rel": [
                        "gamelog",
                        "desktop",
                        "athlete"
                      ],
                      "href": "http://www.espn.com/nfl/player/gamelog/_/id/2976499/amari-cooper"
                    },
                    {
                      "rel": [
                        "news",
                        "desktop",
                        "athlete"
                      ],
                      "href": "http://www.espn.com/nfl/player/news/_/id/2976499/amari-cooper"
                    },
                    {
                      "rel": [
                        "bio",
                        "desktop",
                        "athlete"
                      ],
                      "href": "http://www.espn.com/nfl/player/bio/_/id/2976499/amari-cooper"
                    },
                    {
                      "rel": [
                        "overview",
                        "desktop",
                        "athlete"
                      ],
                      "href": "http://www.espn.com/nfl/player/_/id/2976499/amari-cooper"
                    }
                  ],
                  "jersey": "19",
                  "headshot": "https://a.espncdn.com/i/headshots/nfl/players/full/2976499.png",
                  "position": {
                    "abbreviation": "WR"
                  },
                  "team": {
                    "id": "6"
                  },
                  "active": true
                },
                "team": {
                  "id": "6"
                }
              }
            ]
          }
        ],
        "tickets": [
          {
            "summary": "Tickets as low as $101",
            "numberAvailable": 357,
            "links": [
              {
                "href": "https://www.vividseats.com/nfl/chicago-bears-tickets/bears-1-4-3002042.html?wsUser=717"
              },
              {
                "href": "https://www.vividseats.com/venues/soldier-field-tickets.html?wsUser=717"
              }
            ]
          }
        ],
        "startDate": "2019-12-06T01:20Z",
        "geoBroadcasts": [
          {
            "type": {
              "id": "1",
              "shortName": "TV"
            },
            "market": {
              "id": "1",
              "type": "National"
            },
            "media": {
              "shortName": "FOX"
            },
            "lang": "en",
            "region": "us"
          },
          {
            "type": {
              "id": "1",
              "shortName": "TV"
            },
            "market": {
              "id": "1",
              "type": "National"
            },
            "media": {
              "shortName": "NFL"
            },
            "lang": "en",
            "region": "us"
          }
        ],
        "odds": [
          {
            "provider": {
              "id": "38",
              "name": "Caesars",
              "priority": 1
            },
            "details": "DAL -3.0",
            "overUnder": 42.5
          }
        ]
      }
    ],
    "links": [
      {
        "language": "en",
        "rel": [
          "summary",
          "desktop",
          "event"
        ],
        "href": "http://www.espn.com/nfl/game/_/gameId/401127871",
        "text": "Gamecast",
        "shortText": "Gamecast",
        "isExternal": false,
        "isPremium": false
      }
    ],
    "weather": {
      "displayValue": "Partly sunny",
      "temperature": 45,
      "conditionId": "3"
    },
    "status": {
      "clock": 900,
      "displayClock": "15:00",
      "period": 1,
      "type": {
        "id": "1",
        "name": "STATUS_SCHEDULED",
        "state": "pre",
        "completed": false,
        "description": "Scheduled",
        "detail": "Thu, December 5th at 8:20 PM EST",
        "shortDetail": "12/5 - 8:20 PM EST"
      }
    }
  }