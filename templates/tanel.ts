// tanel-2 shared state and auth for the remote-cmd command queue.
// Lives inside the Next.js dev server process — resets on server restart,
// which is fine for our use case.

export interface QueuedCmd {
  id: number
  cmd: string
}

export interface CmdResult {
  id: number | null
  result: string | null
  error: string | null
  exitCode: number | null
  ts: number
}

// Module-level state — persists across requests within the same server process.
// Uses globalThis to survive HMR in dev.
const globalForTanel = globalThis as unknown as {
  __tanelQueue?: QueuedCmd[]
  __tanelResult?: CmdResult
  __tanelCounter?: number
}

if (!globalForTanel.__tanelQueue) {
  globalForTanel.__tanelQueue = []
  globalForTanel.__tanelResult = { id: null, result: null, error: null, exitCode: null, ts: 0 }
  globalForTanel.__tanelCounter = 0
}

export const cmdQueue = globalForTanel.__tanelQueue!
export let lastResult = globalForTanel.__tanelResult!
export let cmdCounter = globalForTanel.__tanelCounter!

export function nextCmdId(): number {
  cmdCounter += 1
  globalForTanel.__tanelCounter = cmdCounter
  return cmdCounter
}

export function clearResult(): void {
  lastResult = { id: null, result: null, error: null, exitCode: null, ts: 0 }
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
