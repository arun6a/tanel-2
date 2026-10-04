import { NextRequest } from 'next/server'
import { lastResult, setResult, checkAuth, unauthorizedResponse, type CmdResult } from '@/lib/tanel'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/remote-cmd/result
// Body: { id, channel, result, error, exitCode }
// Auth: Bearer token
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) return unauthorizedResponse()
  try {
    const body = await request.json()
    const r: CmdResult = {
      id: body?.id ?? null,
      channel: body?.channel ?? null,
      result: body?.result ?? null,
      error: body?.error ?? null,
      exitCode: body?.exitCode ?? null,
      ts: Date.now(),
    }
    setResult(r)
    return Response.json({ success: true })
  } catch (e: unknown) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}

// GET /api/remote-cmd/result
// Returns the latest result posted by any poller (includes channel field).
// Auth: Bearer token
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return unauthorizedResponse()
  return Response.json(lastResult)
}
