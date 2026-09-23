import * as cheerio from "cheerio";
import fs from "node:fs";

// Configuration
const FCN = {
  teamId: "011MIAOB5G000000VTVG0001VTR8C1K7",
  teamName: "FC Viktoria Neupotz",
  matchType: 1,
  outputFile: "FCN-Heim.ics",
  calendarName: "FCN Heimspiele",
  calendarDescription: "Heimspiele des FC Viktoria Neupotz",
  eventTitle: "FCN Heimspiel"
};

const FCK = {
  teamId: "011MICQO1C000000VTVG0001VTR8C1K7",
  teamName: "1. FC Kaiserslautern",
  matchType: -1,
  outputFile: "FCK.ics",
  calendarName: "FCK Spiele",
  calendarDescription: "Spiele des 1. FC Kaiserslautern",
  eventTitle: "FCK Spiel"
};

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

// Load and parse matches for one club
async function getGames(club) {
  const url =
    `https://www.fussball.de/ajax.team.matchplan/-/mode/PAGE/max/999/match-type/${club.matchType}/team-id/${club.teamId}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `fussball.de returned HTTP ${response.status} for ${club.teamName}`
    );
  }

  const html = await response.text();
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

    // Skip games without a proper kickoff time
    if (!/^\d{2}:\d{2}$/.test(kickoff)) {
      console.warn(
        `Skipping ${club.teamName} game on ${date}: no valid kickoff time`
      );
      return;
    }

    // Read competition
    const competition = cleanText(
      competitionRow
        .find(".column-team")
        .text()
    );

    // Read both teams from the next row
    const matchRow = competitionRow.next("tr");

    const clubElements = matchRow.find(".column-club");

    const teams = clubElements
      .find(".club-name")
      .map((_, el) => cleanText($(el).text()))
      .get();

    // Skip rows that do not contain two teams
    if (teams.length < 2) {
      console.warn(
        `Skipping incomplete match row for ${club.teamName} on ${date}`
      );
      return;
    }

    const homeTeam = teams[0];
    const awayTeam = teams[1];

    // Determine home/away using the team ID in the home-team link
    const homeTeamUrl =
      clubElements
        .first()
        .find("a.club-wrapper")
        .attr("href") || "";

    const isHome = homeTeamUrl.includes(
      `/team-id/${club.teamId}`
    );

    const opponent = isHome
      ? awayTeam
      : homeTeam;

    const location = isHome
      ? "Heim"
      : "Auswärts";

    games.push({
      date,
      kickoff,
      competition,
      opponent,
      location
    });
  });

  return games;
}

// Generate an ICS file for one club
function generateCalendar(club, games) {
  const generatedAt = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

  const events = games.map(game => {
    const date = parseDate(game.date);

    const startTime = parseTime(game.kickoff);
    const endTime = addHours(game.kickoff, 2);

    // Build description depending on club
    const description =
      club === FCN
        ? `Gegner: ${game.opponent}\nWettbewerb: ${game.competition}`
        : `Gegner: ${game.opponent}\nWettbewerb: ${game.competition}\nOrt: ${game.location}`;

    // Create a stable UID
    const uid =
      `${club.teamId}-${date}-${game.opponent}`
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-") +
      "@football-ics";

    // Build the VEVENT block
    return [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${generatedAt}`,
      `DTSTART;TZID=Europe/Berlin:${date}T${startTime}`,
      `DTEND;TZID=Europe/Berlin:${date}T${endTime}`,
      `SUMMARY:${escapeIcs(club.eventTitle)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      "END:VEVENT"
    ].join("\r\n");
  });

  // Build the complete ICS calendar
  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${club.teamName}//Spielplan//DE`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(club.calendarName)}`,
    `X-WR-CALDESC:${escapeIcs(club.calendarDescription)}`,
    ...events,
    "END:VCALENDAR",
    ""
  ].join("\r\n");

  fs.writeFileSync(
    club.outputFile,
    calendar,
    "utf8"
  );

  console.log(
    `Generated ${club.outputFile} with ${games.length} games.`
  );
}

// Generate FCN calendar
const fcnGames = await getGames(FCN);

console.log("FCN games:");
console.log(JSON.stringify(fcnGames, null, 2));

generateCalendar(
  FCN,
  fcnGames
);

// Generate FCK calendar
const fckGames = await getGames(FCK);

console.log("FCK games:");
console.log(JSON.stringify(fckGames, null, 2));

generateCalendar(
  FCK,
  fckGames
);
