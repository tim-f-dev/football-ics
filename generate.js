import * as cheerio from "cheerio";
import fs from "node:fs";

// Configuration
const TEAM_ID = "011MIAOB5G000000VTVG0001VTR8C1K7";

const MATCHPLAN_URL =
  `https://www.fussball.de/ajax.team.matchplan/-/mode/PAGE/match-type/1/team-id/${TEAM_ID}`;

const OUTPUT_FILE = "calendar.ics";

// Clean whitespace and invisible zero-width spaces
function cleanText(text) {
  return text
    .replace(/\u200B/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Convert "So, 27.09.26" to "20260927"
function parseDate(dateText) {
  const match = dateText.match(/(\d{2})\.(\d{2})\.(\d{2})/);

  if (!match) {
    throw new Error(`Could not parse date: ${dateText}`);
  }

  const [, day, month, shortYear] = match;
  const year = `20${shortYear}`;

  return `${year}${month}${day}`;
}

// Convert "15:00" to "150000"
function parseTime(timeText) {
  const [hours, minutes] = timeText.split(":");

  return `${hours}${minutes}00`;
}

// Add hours to a kickoff time
function addHours(timeText, hoursToAdd) {
  const [hours, minutes] = timeText.split(":").map(Number);

  const date = new Date(2000, 0, 1, hours, minutes);

  date.setHours(date.getHours() + hoursToAdd);

  const resultHours = String(date.getHours()).padStart(2, "0");
  const resultMinutes = String(date.getMinutes()).padStart(2, "0");

  return `${resultHours}${resultMinutes}00`;
}

// Escape special characters for ICS text fields
function escapeIcs(text) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

// Load matchplan from fussball.de
const response = await fetch(MATCHPLAN_URL);

if (!response.ok) {
  throw new Error(
    `fussball.de returned HTTP ${response.status}`
  );
}

const html = await response.text();

// Parse matches from HTML
const $ = cheerio.load(html);

const games = [];

$("tr.row-competition").each((_, element) => {
  const competitionRow = $(element);

  // Read date and kickoff time
  const dateCell = competitionRow.find(".column-date");

  const date = cleanText(
    dateCell
      .find("span")
      .text()
      .replace("|", "")
  );

  const kickoff = cleanText(
    dateCell
      .clone()
      .find("span")
      .remove()
      .end()
      .text()
  );

  // Read competition
  const competition = cleanText(
    competitionRow
      .find(".column-team")
      .text()
  );

  // Read home team and opponent from the next row
  const matchRow = competitionRow.next("tr");

  const teams = matchRow
    .find(".club-name")
    .map((_, el) => cleanText($(el).text()))
    .get();

  const opponent = teams[1];

  // Store parsed match
  games.push({
    date,
    kickoff,
    competition,
    opponent
  });
});

// Print parsed matches for debugging
console.log(JSON.stringify(games, null, 2));

// Generate a UTC timestamp for DTSTAMP
const generatedAt = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .replace(/\.\d{3}/, "");

// Generate ICS events
const events = games.map(game => {
  const date = parseDate(game.date);

  const startTime = parseTime(game.kickoff);
  const endTime = addHours(game.kickoff, 2);

  // Set event title and description
  const summary = "FCN Heimspiel";

  const description =
    `Gegner: ${game.opponent}\n` +
    `Wettbewerb: ${game.competition}`;

  // Create a stable UID for calendar updates
  const uid =
    `${date}-${game.opponent}`
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-") +
    "@fcn-calendar";

  // Build the VEVENT block
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${generatedAt}`,
    `DTSTART;TZID=Europe/Berlin:${date}T${startTime}`,
    `DTEND;TZID=Europe/Berlin:${date}T${endTime}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    "END:VEVENT"
  ].join("\r\n");
});

// Build the complete ICS calendar
const calendar = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//FC Viktoria Neupotz//Spielplan//DE",
  "CALSCALE:GREGORIAN",
  "METHOD:PUBLISH",
  ...events,
  "END:VCALENDAR",
  ""
].join("\r\n");

// Write calendar.ics
fs.writeFileSync(
  OUTPUT_FILE,
  calendar,
  "utf8"
);

console.log(
  `Generated ${OUTPUT_FILE} with ${games.length} home games.`
);