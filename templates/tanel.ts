// tanel-2 shared state and auth for the remote-cmd command queue.
// Multi-channel support: each poller declares a channel, commands can be
// targeted to a specific channel. Default channel is "default" (backward compatible).

export interface QueuedCmd {
  id: number
  cmd: string
  channel: string
}

export interface CmdResult {
  id: number | null
  channel: string | null
  result: string | null
  error: string | null
  exitCode: number | null
  ts: number
}

const DEFAULT_CHANNEL = 'default'

// Module-level state — persists across requests within the same server process.
// Uses globalThis to survive HMR in dev.
const globalForTanel = globalThis as unknown as {
  __tanelQueues?: Map<string, QueuedCmd[]>
  __tanelResult?: CmdResult
  __tanelCounter?: number
}

if (!globalForTanel.__tanelQueues) {
  globalForTanel.__tanelQueues = new Map<string, QueuedCmd[]>()
  globalForTanel.__tanelQueues.set(DEFAULT_CHANNEL, [])
  globalForTanel.__tanelResult = { id: null, channel: null, result: null, error: null, exitCode: null, ts: 0 }
  globalForTanel.__tanelCounter = 0
}

export const cmdQueues = globalForTanel.__tanelQueues!
export let lastResult = globalForTanel.__tanelResult!
export let cmdCounter = globalForTanel.__tanelCounter!

export function getQueue(channel: string): QueuedCmd[] {
  if (!cmdQueues.has(channel)) cmdQueues.set(channel, [])
  return cmdQueues.get(channel)!
}

export function listChannels(): { channel: string; queued: number }[] {
  return Array.from(cmdQueues.entries()).map(([channel, q]) => ({ channel, queued: q.length }))
}

export function nextCmdId(): number {
  cmdCounter += 1
  globalForTanel.__tanelCounter = cmdCounter
  return cmdCounter
}

export function clearResult(): void {
  lastResult = { id: null, channel: null, result: null, error: null, exitCode: null, ts: 0 }
  globalForTanel.__tanelResult = lastResult
}

export function setResult(r: CmdResult): void {
  lastResult = r
  globalForTanel.__tanelResult = r
}

export function getToken(): string | null {
  return process.env.TANEL_TOKEN || null
}

// Constant-time-ish token comparison
export function checkAuth(request: Request): boolean {
  const token = getToken()
  if (!token) return false
  const auth = request.headers.get('authorization') || ''
  if (!auth.startsWith('Bearer ')) return false
  const provided = auth.slice(7)
  if (provided.length !== token.length) return false
  let diff = 0
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ token.charCodeAt(i)
  }
  return diff === 0
}

export function unauthorizedResponse(): Response {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}

export { DEFAULT_CHANNEL }
