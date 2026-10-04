import { NextRequest } from 'next/server'
import { getQueue, nextCmdId, clearResult, checkAuth, unauthorizedResponse, listChannels, DEFAULT_CHANNEL } from '@/lib/tanel'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/remote-cmd/queue
// Body: { "cmd": "shell command string", "channel": "default" }
// Auth: Bearer token
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) return unauthorizedResponse()
  try {
    const body = await request.json()
    if (!body || typeof body.cmd !== 'string' || !body.cmd.trim()) {
      return Response.json({ error: 'Missing or invalid "cmd" field' }, { status: 400 })
    }
    const channel = typeof body.channel === 'string' && body.channel.trim() ? body.channel.trim() : DEFAULT_CHANNEL
    const queue = getQueue(channel)
    const id = nextCmdId()
    queue.push({ id, cmd: body.cmd, channel })
    clearResult()
    return Response.json({ success: true, id, channel, queued: queue.length })
  } catch (e: unknown) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}

// GET /api/remote-cmd/queue — returns queue length per channel (for debugging)
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return unauthorizedResponse()
  return Response.json({ channels: listChannels() })
}
