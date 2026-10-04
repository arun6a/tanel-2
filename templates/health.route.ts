import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/health — public health check (no auth)
export async function GET(_request: NextRequest) {
  return Response.json({ status: 'ok', service: 'tanel-2', host: 'nextjs' })
}
