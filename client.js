const axios = require("axios");
const R = require("ramda");
var dateFormat = require("dateformat");

const nflUrl = `http://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`;
const ncaaUrl = `http://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard`;

const main = async () => {
  //@ts-ignore
  const { data } = await axios.get(
    // ncaaUrl
    nflUrl
  );

  const { leagues, season, week, events } = data;
  const filteredGames = filterScheduled(events);
  // const filteredGames = filterInProgress(events);
  // const filteredGames = filterFinal(events);

  const gamesComposer = R.compose(assemblGameMap);
  //@ts-ignore
  const games = gamesComposer(filteredGames);
  console.log(`games: ${JSON.stringify(games)}`);
};

main();

const ScheduleType = {
  STATUS_SCHEDULED: `STATUS_SCHEDULED`,
  STATUS_IN_PROGRESS: `STATUS_IN_PROGRESS`,
  STATUS_FINAL: `STATUS_FINAL`
};

const filterScheduled = R.filter(
  R.pathEq([`status`, `type`, `name`], ScheduleType.STATUS_SCHEDULED)
);

const filterInProgress = R.filter(
  R.pathEq([`status`, `type`, `name`], ScheduleType.STATUS_IN_PROGRESS)
);
const filterFinal = R.filter(
  R.pathEq([`status`, `type`, `name`], ScheduleType.STATUS_FINAL)
);

const assembleGame = event => {
  const date = dateFormat(
    new Date(R.pathOr(`n/a`, [`date`], event)),
    "longTime"
  );
  const game = {
    shortName: R.pathOr(`n/a`, [`shortName`], event),
    date,
    weather: `${R.pathOr(
      `n/a`,
      [`weather`, `displayValue`],
      event
    )} & ${R.pathOr(`n/a`, [`weather`, `temperature`], event)}℉`,

    status: R.pathOr(`n/a`, [`status`, `type`, `description`], event)
  };
  console.log(`game: ${JSON.stringify(game)}`);
  return game;
};

const assemblGameMap = R.map(assembleGame);
