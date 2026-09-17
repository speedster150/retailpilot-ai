import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const INTERNAL_DASHBOARD_PATHS = [
  '/dashboard',
  '/products',
  '/inventory',
  '/purchases',
  '/suppliers',
  '/sales',
  '/sales/pos',
  '/payments',
  '/customers',
  '/returns',
  '/expenses',
  '/reports',
  '/goods-receipts',
  '/ai-assistant',
]

const CUSTOMER_PORTAL_PATH = '/customer-portal'

function pathMatches(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`)
}

function isProtectedPath(pathname: string) {
  return (
    pathMatches(pathname, CUSTOMER_PORTAL_PATH) ||
    INTERNAL_DASHBOARD_PATHS.some((path) => pathMatches(pathname, path))
  )
}

function isInternalDashboardPath(pathname: string) {
  return INTERNAL_DASHBOARD_PATHS.some((path) => pathMatches(pathname, path))
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )

          supabaseResponse = NextResponse.next({
            request,
          })

          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'

    return NextResponse.redirect(url)
  }

  if (user && isInternalDashboardPath(request.nextUrl.pathname)) {
    const { data: memberships } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)

    const organizationId = memberships?.[0]?.organization_id

    if (organizationId) {
      const { data: role } = await supabase.rpc('get_user_role', {
        org_id: organizationId,
      })

      if (role === 'customer') {
        const url = request.nextUrl.clone()
        url.pathname = CUSTOMER_PORTAL_PATH
        url.search = ''

        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
