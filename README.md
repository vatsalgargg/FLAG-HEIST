# Flag Heist

A static challenge guide for the Flag Heist CTF. The Next.js site hosts the
briefings, story and hints for all 13 challenges. The hands-on challenges
themselves are solved in the TryHackMe room:

https://tryhackme.com/room/flagheistchallenges

A live countdown on the landing page and in the arena reveals the room link to
everyone when it reaches zero (12 November 2026, 1:00 PM IST).

## Run locally

Requires Node 22.12+.

```sh
npm ci
npm run dev
```

Open http://localhost:3000.

## Pages

- `/` — event landing page with the room countdown.
- `/arena` — all 13 challenge briefings, navigation and hints. Requires a team login.
- `/leaderboard` — points visitors to the TryHackMe leaderboard.
- `/login` — team login for registered teams.
- `/admin` — notes that the self-hosted backend has been removed.

## Team login

Team accounts are hardcoded in `src/data/credentials.ts`, generated from the
registration spreadsheet. The username is the team name. The password is the
first four characters of the team name followed by the last four digits of the
team's contact number, with spaces removed. Login matching ignores spaces,
punctuation, and letter case. Sessions are stored in the browser, and `/arena`
redirects to `/login` when there is no active session.

## Hints

Hints are stored with the challenge data in `src/data/challenges.ts`. Each hint
keeps its point cost and is revealed on demand; revealed hints are remembered
in the browser via `localStorage`. There is no scoring backend.

## Build

```sh
npm run lint
npm run build
```
