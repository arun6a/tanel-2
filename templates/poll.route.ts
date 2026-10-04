import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/poll — serves the hardened poller script (text/plain).
// The script is useless without TANEL_TOKEN on the user's side, so it's safe to serve publicly.
const POLL_CJS = `#!/usr/bin/env node
// tanel-2 poller (served from sandbox /api/poll)
// Usage:
//   curl -s https://<your-sandbox-url>/api/poll > poll.cjs
//   TOKEN=<your-secret> BASE_URL=https://<your-sandbox-url> CHANNEL=default node poll.cjs
//
// Env vars:
//   TOKEN           (required) bearer token for the tanel-2 API
//   BASE_URL        (required) sandbox url, e.g. https://preview-chat-xxxx.space-z.ai
//   CHANNEL         (optional, default "default") poller channel name
//   POLL_MS         (optional, default 1500) poll interval in ms
//   CMD_TIMEOUT_MS  (optional, default 60000) per-command timeout in ms
const http = require('http')
const https = require('https')
const { exec } = require('child_process')

const TOKEN = process.env.TOKEN
const BASE_URL = process.env.BASE_URL
const CHANNEL = process.env.CHANNEL || 'default'
const POLL_MS = parseInt(process.env.POLL_MS || '1500', 10)
const CMD_TIMEOUT_MS = parseInt(process.env.CMD_TIMEOUT_MS || '60000', 10)

if (!TOKEN || !BASE_URL) {
  console.error('Missing TOKEN or BASE_URL env var.')
  console.error('Usage: TOKEN=<secret> BASE_URL=https://preview-chat-xxxx.space-z.ai CHANNEL=default node poll.cjs')
  process.exit(1)
}

const client = BASE_URL.startsWith('https') ? https : http
const url = new URL(BASE_URL)

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: path,
      headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      timeout: 30000,
    }
    const r = client.request(opts, (res) => {
      let d = ''
      res.on('data', (c) => d += c)
      res.on('end', () => { try { resolve(d ? JSON.parse(d) : {}) } catch { resolve({}) } })
    })
    r.on('error', reject)
    r.on('timeout', () => { r.destroy(); reject(new Error('timeout')) })
    if (body) r.write(JSON.stringify(body))
    r.end()
  })
}

async function loop() {
  console.log('[tanel-poll] polling', BASE_URL, 'channel=' + CHANNEL, 'every', POLL_MS, 'ms')
  while (true) {
    try {
      const next = await req('GET', '/api/remote-cmd/pending?channel=' + encodeURIComponent(CHANNEL))
      if (next && next.cmd) {
        const id = next.id
        console.log('[tanel-poll] run (id=' + id + ', ch=' + CHANNEL + '):', next.cmd)
        await new Promise((resolve) => {
          exec(next.cmd, { timeout: CMD_TIMEOUT_MS, maxBuffer: 5 * 1024 * 1024 }, async (err, stdout, stderr) => {
            const result = {
              id,
              channel: CHANNEL,
              result: stdout ? stdout.toString() : '',
              error: stderr ? stderr.toString() : (err ? err.message : ''),
              exitCode: err ? (err.code || 1) : 0,
            }
            try { await req('POST', '/api/remote-cmd/result', result) }
            catch (e) { console.error('[tanel-poll] post-result failed:', e.message) }
            resolve()
          })
        })
      }
    } catch (e) {
      console.error('[tanel-poll] poll error:', e.message)
    }
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
}

loop()
`

export async function GET(_request: NextRequest) {
  return new Response(POLL_CJS, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
