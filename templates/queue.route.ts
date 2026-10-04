import { NextRequest } from 'next/server'
import { cmdQueue, nextCmdId, clearResult, checkAuth, unauthorizedResponse } from '@/lib/tanel'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/remote-cmd/queue
// Body: { "cmd": "shell command string" }
// Auth: Bearer token
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) return unauthorizedResponse()
  try {
    const body = await request.json()
    if (!body || typeof body.cmd !== 'string' || !body.cmd.trim()) {
      return Response.json({ error: 'Missing or invalid "cmd" field' }, { status: 400 })
    }
    const id = nextCmdId()
    cmdQueue.push({ id, cmd: body.cmd })
    clearResult()
    return Response.json({ success: true, id, queued: cmdQueue.length })
  } catch (e: unknown) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}

// GET /api/remote-cmd/queue — returns queue length (for debugging)
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return unauthorizedResponse()
  return Response.json({ queued: cmdQueue.length })
}
