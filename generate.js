import fs from "node:fs";

const ics = `
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//My Calendar//EN
CALSCALE:GREGORIAN

BEGIN:VEVENT
UID:test-1@example.com
DTSTART:20261010T180000Z
DTEND:20261010T200000Z
SUMMARY:Test event
END:VEVENT

END:VCALENDAR
`.trim();

fs.writeFileSync("calendar.ics", ics);

import * as cheerio from "cheerio";

const url =
  "https://www.fussball.de/ajax.team.matchplan/-/mode/PAGE/match-type/1/team-id/011MIAOB5G000000VTVG0001VTR8C1K7";

const response = await fetch(url);
const html = await response.text();

const $ = cheerio.load(html);

const games = [];

$("tr.row-competition").each((_, element) => {
  const competitionRow = $(element);

  // ----- DATE + TIME -----

  const dateCell = competitionRow.find(".column-date");

  const dateText = dateCell
    .find("span")
    .text()
    .replace("|", "")
    .trim();

  // Clone the cell and remove the date span,
  // leaving only the kickoff time.
  const kickoff = dateCell
    .clone()
    .find("span")
    .remove()
    .end()
    .text()
    .trim();

  // ----- COMPETITION -----

  const competition = competitionRow
    .find(".column-team")
    .text()
    .trim();

  // ----- TEAMS -----

  const matchRow = competitionRow.next("tr");

  const teams = matchRow
    .find(".club-name")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get();

  const homeTeam = teams[0];
  const opponent = teams[1];

  games.push({
    date: dateText,
    kickoff,
    competition,
    opponent
  });
});

console.log(games);