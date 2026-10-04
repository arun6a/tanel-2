#!/usr/bin/env node
// tanel-2 poller: runs on your local terminal, polls the sandbox for
// commands, executes them locally, and posts the results back.
//
// Usage:
//   curl -s https://raw.githubusercontent.com/arun6a/tanel-2/main/poll.cjs > poll.cjs
//   TOKEN=<your-secret> BASE_URL=https://preview-chat-xxxx.space-z.ai node poll.cjs
//
// Env vars:
//   TOKEN           (required) bearer token for the tanel-2 API
//   BASE_URL        (required) sandbox url, e.g. https://preview-chat-xxxx.space-z.ai
//   POLL_MS         (optional, default 1500) poll interval in ms
//   CMD_TIMEOUT_MS  (optional, default 60000) per-command timeout in ms
//   XFORM_PORT      (optional) set to route via ?XTransformPort= (for non-3000 setups)

const http = require('http')
const https = require('https')
const { exec } = require('child_process')

const TOKEN = process.env.TOKEN
const BASE_URL = process.env.BASE_URL
const POLL_MS = parseInt(process.env.POLL_MS || '1500', 10)
const CMD_TIMEOUT_MS = parseInt(process.env.CMD_TIMEOUT_MS || '60000', 10)
const XFORM_PORT = process.env.XFORM_PORT // e.g. "3030" if sandbox runs tanel on another port

if (!TOKEN || !BASE_URL) {
  console.error('Missing TOKEN or BASE_URL env var.')
  console.error('Usage: TOKEN=<secret> BASE_URL=https://preview-chat-xxxx.space-z.ai node poll.cjs')
  process.exit(1)
}

const client = BASE_URL.startsWith('https') ? https : http
const url = new URL(BASE_URL)

function buildPath(path) {
  if (XFORM_PORT) {
    return path + (path.includes('?') ? '&' : '?') + 'XTransformPort=' + XFORM_PORT
  }
  return path
}

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: buildPath(path),
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
    const r = client.request(opts, (res) => {
      let d = ''
      res.on('data', (c) => (d += c))
      res.on('end', () => {
        try { resolve(d ? JSON.parse(d) : {}) }
        catch { resolve({ _raw: d }) }
      })
    })
    r.on('error', reject)
    r.on('timeout', () => { r.destroy(); reject(new Error('timeout')) })
    if (body) r.write(JSON.stringify(body))
    r.end()
  })
}

async function loop() {
  console.log('[tanel-poll] polling', BASE_URL, 'every', POLL_MS, 'ms')
  if (XFORM_PORT) console.log('[tanel-poll] using XTransformPort=' + XFORM_PORT)
  while (true) {
    try {
      const next = await req('GET', '/api/remote-cmd/pending')
      if (next && next.cmd) {
        const id = next.id
        console.log('[tanel-poll] run (id=' + id + '):', next.cmd)
        await new Promise((resolve) => {
          exec(next.cmd, { timeout: CMD_TIMEOUT_MS, maxBuffer: 5 * 1024 * 1024 }, async (err, stdout, stderr) => {
            const result = {
              id,
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
