import { NextRequest } from 'next/server'
import { getQueue, checkAuth, unauthorizedResponse, DEFAULT_CHANNEL } from '@/lib/tanel'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/remote-cmd/pending?channel=<name>
// Returns the next queued command for that channel, or { cmd: null } if empty.
// Auth: Bearer token
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return unauthorizedResponse()
  const channel = request.nextUrl.searchParams.get('channel') || DEFAULT_CHANNEL
  const queue = getQueue(channel)
  const cmd = queue.shift()
  return Response.json(cmd || { cmd: null, channel })
}
