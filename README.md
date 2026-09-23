# Football ICS

small js project that turns football fixtures from [fussball.de](https://www.fussball.de/) into updating `.ics` calendar feeds.

I built this because I wanted football matches to show up in my calendar automatically, without adding every fixture by hand.

It currently creates calendar feeds for:

* FC Viktoria Neupotz home matches (so I can cycle there)
* all 1. FC Kaiserslautern matches

## How it works

The script fetches the public match schedule from fussball.de and parses the returned HTML.

* date
* kickoff time
* competition
* opponent
* home or away status

The data is then converted into `.ics` calendar files.

## Automation

A GitHub Actions workflow runs the JavaScript automatically, builds the calendar files and publishes them through GitHub Pages.

This means the calendar subscription links stay the same while the fixture data can be updated automatically.

## Usage

Open the GitHub Pages site:

https://tim-f-dev.github.io/football-ics/

From there, the calendars can be opened or subscribed to with Apple Calendar, Google Calendar, or by copying the direct ICS link.

Because the calendars are published as subscription feeds, updated fixture data can appear automatically without importing a new file each time.

## Data source

Match data is taken from the publicly available schedules on [fussball.de](https://www.fussball.de/).

Natürlich not affiliated with fussball.de, FC Viktoria Neupotz or 1. FC Kaiserslautern.
