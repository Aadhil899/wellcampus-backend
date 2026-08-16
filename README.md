# WellCampus watch bridge

Closes the loop from your original diagram:

```
Watch -> Titan app -> Google Fit -> Health Connect
       -> WatchSyncWorker.kt (Android, reads HC)
       -> this backend (POST /api/health/summary)
       -> WellCampus web app (GET /api/health/summary, polls every 30s)
```

## Run it locally

```
cd wellcampus-backend
npm install
WRITE_KEY=some-long-random-string npm start
```

Server listens on port 8787 by default (override with `PORT`).

## Deploy it somewhere reachable from your phone

The Android app and the web app both need to reach this server over the
network, so `localhost` only works if everything is on the same machine.
Cheapest options for a student project:

- **Render / Railway / Fly.io** — free tier, push this folder, set the
  `WRITE_KEY` env var in their dashboard, get a public HTTPS URL.
- **Your own machine + ngrok** — `npm start` locally, then
  `ngrok http 8787` for a temporary public URL. Good for a demo, not for
  anything long-lived (the URL changes every restart on the free tier).

## Wire up the other two pieces once deployed

1. **Android app** (`WatchSyncWorker.kt`): set `BACKEND_URL` to
   `https://your-deployed-host/api/health/summary` and `WRITE_KEY` to the
   same value you set on the server. Call `WatchSyncWorker.schedule(context)`
   once (e.g. in `Application.onCreate`) to sync every 15 minutes, or
   `WatchSyncWorker.syncNow(context)` from a manual "Sync now" button.

2. **Web app** (`WellCampus.jsx`): set `WATCH_BRIDGE_URL` at the top of the
   file to `https://your-deployed-host/api/health/summary`. It polls every
   30 seconds and falls back to demo data automatically if the backend is
   unreachable — the watch status bar on the Physical tab shows "Demo Data"
   vs "Watch Connected" so it's obvious which mode you're in.

## Endpoints

- `POST /api/health/summary` — Android posts here. Requires header
  `x-write-key: <WRITE_KEY>`. Body must include `water`, `run`, `sleep` keys
  (see `src/server.js` for the exact shape).
- `GET /api/health/summary` — web app polls here. No auth (read-only demo
  data). Returns 404 until the Android app has posted at least once.
- `GET /api/health/status` — quick check for whether any data has arrived.

## Known limitations (be upfront about these in your report/demo)

- **In-memory storage** — data is lost on server restart, and there's only
  ever one "latest" summary (fine for a single-student demo, not multi-user).
- **No auth on the read endpoint** — anyone with the URL can read the
  summary. Add a read key too before this touches real health data.
- **Water intake has no Health Connect record type** — Titan likely doesn't
  report it via Fit/Health Connect at all, so the worker currently sends 0.
  Confirm this with `DiagnosticActivity.kt` from the earlier Kotlin bundle;
  if it's genuinely unavailable, that's worth stating explicitly rather than
  faking a number.
- **Duration/pace/route fields are placeholders** (`"—"`) — Health Connect's
  `ExerciseSessionRecord` has this data but the worker doesn't parse it yet;
  the current mapping only computes distance, calories, and heart rate from
  the record types read in `HealthConnectManager.kt`.
