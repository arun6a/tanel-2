import { NextRequest } from 'next/server'
import { cmdQueue, checkAuth, unauthorizedResponse } from '@/lib/tanel'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/remote-cmd/pending
// Returns the next queued command, or { cmd: null } if empty.
// Auth: Bearer token
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return unauthorizedResponse()
  const cmd = cmdQueue.shift()
  return Response.json(cmd || { cmd: null })
}
