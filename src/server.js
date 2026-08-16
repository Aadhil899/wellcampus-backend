import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

// ─── Config ───────────────────────────────────────────────────────────────
// Shared secret the Android app must send when pushing data. Change this
// before deploying anywhere real, and set the same value as an env var
// (WRITE_KEY) on both this server and in the Android app's config.
const WRITE_KEY = process.env.WRITE_KEY || 'dev-write-key-change-me'
const PORT = process.env.PORT || 8787

// ─── In-memory store ─────────────────────────────────────────────────────
// Good enough for a single-student SDP project. Swap for a real DB (SQLite,
// Postgres) if this needs to survive server restarts or serve multiple users.
let latestSummary = null // shape documented below
let lastReceivedAt = null

// Expected summary shape posted by the Android app, matching what the
// WellCampus dashboard renders:
// {
//   water: { consumed, goal, lastSync, hourly: number[] },
//   run:   { distance, duration, pace, calories, heartRate, avgHR, date, route, splits: [{km, pace}] },
//   sleep: { duration, hours, start, end, quality, deep, rem, light, hr, avoidStart, avoidEnd, stages: [{t, stage, val}] }
// }

// ─── Auth middleware for write endpoint ─────────────────────────────────
function requireWriteKey(req, res, next) {
  const key = req.header('x-write-key')
  if (key !== WRITE_KEY) {
    return res.status(401).json({ error: 'invalid or missing x-write-key header' })
  }
  next()
}

// ─── Routes ───────────────────────────────────────────────────────────────

// Android app posts here after reading Health Connect.
app.post('/api/health/summary', requireWriteKey, (req, res) => {
  const body = req.body
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'expected a JSON object body' })
  }
  // Minimal shape check — don't silently accept garbage.
  const required = ['water', 'run', 'sleep']
  const missing = required.filter(k => !(k in body))
  if (missing.length) {
    return res.status(400).json({ error: `missing keys: ${missing.join(', ')}` })
  }

  latestSummary = body
  lastReceivedAt = new Date().toISOString()
  res.json({ ok: true, receivedAt: lastReceivedAt })
})

// Web app polls this. No auth — read-only, non-sensitive demo data.
// Add auth here too before this ever holds a real person's health data.
app.get('/api/health/summary', (req, res) => {
  if (!latestSummary) {
    return res.status(404).json({ error: 'no data received yet from the watch bridge' })
  }
  res.json({ ...latestSummary, lastReceivedAt })
})

app.get('/api/health/status', (req, res) => {
  res.json({
    hasData: latestSummary !== null,
    lastReceivedAt,
  })
})

app.get('/', (req, res) => {
  res.json({ service: 'wellcampus-watch-bridge', status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`WellCampus watch bridge listening on port ${PORT}`)
  console.log(`Write key (set WRITE_KEY env var to change): ${WRITE_KEY}`)
})
