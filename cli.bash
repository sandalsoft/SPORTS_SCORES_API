#!/bin/bash


# curl -s http://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard \
curl -s http://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard \
| jq -j \
'.events[]   | select(.status.type.name  == "STATUS_SCHEDULED")   | { 
  event: .shortName, 
 (.competitions[0].competitors[0].homeAway): .competitions[0].competitors[0].team.abbreviation, 
 (.competitions[0].competitors[1].homeAway): .competitions[0].competitors[1].team.abbreviation,
 schedule: .competitions[0].status.type.description,   
 weather: "\(.weather.displayValue) \(.weather.highTemperature)℉", 
 tv: .competitions[0].broadcasts[0].names[0],   
 bettingLine: .competitions[0].odds[0].details,
 ou: .competitions[0].odds[0].overUnder,   
 }'


  