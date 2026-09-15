# TV Showdown

TV Showdown is a shared film-night decision app for web, iOS and Android. Each person has their own account and watchlist, joins a group by invite link or room code, and can take part in a fair two-stage spin: first a person, then a film or series from that person's eligible titles.

The app uses UK English and shows viewing options for the United Kingdom. `Want to watch` films and series, and `Watching` series, are eligible for the wheel.

The personal watchlist is split into **Want to watch**, **Watching**, and **Watched** tabs with live counts and clear wheel-eligibility guidance. Moving a title to another status updates its tab immediately.

## What is in this repository

- `app/` — one Expo/React Native interface for web, iOS and Android.
- `server/` — Node API, SQLite persistence, account authentication, groups, watchlists and spinning.
- `PROJECT_SPEC.md` — product requirements and acceptance scenarios.

## Run locally

1. Use Node.js 22 or newer and run `npm install` inside `app/`.
2. Copy `.env.example` to `.env`. Set `TMDB_API_TOKEN` to a TMDB API read-access token if you want catalogue search and UK viewing options. Do not commit that token.
3. Start the API from the repository root with `node --env-file-if-exists=.env server/index.mjs`.
4. Start the app from `app/` with `npm start`. Press `w` for web, `i` for the iOS simulator, or `a` for Android. Expo Go can open it on a physical phone.
5. For a physical phone, set `HOST=0.0.0.0` in the root `.env` and `EXPO_PUBLIC_API_URL=http://<your-computer-LAN-IP>:4000` in `app/.env`. Your phone and computer must be on the same network. The API is for development; use HTTPS and a proper deployment before inviting people outside your network.

The web app defaults to `http://localhost:8081`, and the API to `http://localhost:4000`. Set `APP_ORIGIN` and `PUBLIC_APP_URL` in `.env` if those addresses change. `PUBLIC_APP_URL` is used for invite links.

Run `npm run check` from the repository root to type-check the app and run core API tests. Run `npm --prefix app run build:web` to export the web bundle.

## Catalogue and availability

TMDB supplies title search and poster metadata. UK viewing options are provided by JustWatch through TMDB. The TMDB watch-provider endpoint identifies services and access types but does not provide direct links to individual provider titles; **View options on TMDB** opens TMDB's listing for the title. Availability can change. Without a TMDB token, manual watchlist entry and the wheel still work, while search and viewing options show an honest unavailable state.

This product uses the TMDB API but is not endorsed or certified by TMDB. A production release must include TMDB's approved logo and comply with TMDB and JustWatch attribution and licensing rules. Do not assume the developer API covers commercial use.

## Deployment status

This repository is a runnable development build, not a public multi-user service yet. The SQLite API needs a persistent host and HTTPS before real-world use; the web bundle needs hosting; and store builds for iOS/Android require Apple/Google signing and distribution set-up. The app and API deliberately contain no live credentials.
