import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
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

  const safePaths = [
    '/login',
    '/signup',
    '/onboarding',
    '/forgot-password',
    '/auth/callback',
    '/admin/access-relay',
    '/api/bookings',
    '/api/auth/google/callback',
    '/api/uploads/reference-images',
  ]

  if (
    !user &&
    !safePaths.some((path) => request.nextUrl.pathname.startsWith(path)) &&
    !request.nextUrl.pathname.includes('/book') // Public Artist Intake Forms
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Protect /admin routes — require is_superuser flag
  if (user && request.nextUrl.pathname.startsWith('/admin')) {
    const { data: artistData } = await supabase
      .from('artists')
      .select('is_superuser')
      .eq('id', user.id)
      .single()
    if (!artistData?.is_superuser) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
