import { NextResponse } from 'next/server'

/**
 * Health check endpoint for cloud infrastructure, load balancers, and container orchestrators.
 * Does not require authentication or session cookies.
 * Does not leak secrets, database structure, or internal credentials.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'retailpilot-ai',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  )
}
