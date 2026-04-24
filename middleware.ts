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

  // Paths an authenticated user can always reach — even if their setup is incomplete.
  // These are the places they'd go to *finish* setup, or to manage auth.
  const setupExemptPaths = [
    '/setup',
    '/settings',
    '/onboarding',
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/auth',
    '/api',
    '/admin',
    '/past-clients', // ok to access read-only clients while in partial state
  ]

  if (user) {
    const pathname = request.nextUrl.pathname
    const isExempt = setupExemptPaths.some((p) => pathname.startsWith(p))
    const isBookingPublic = pathname.includes('/book') || pathname.includes('/contact') || pathname.includes('/newsletter')

    // Gate + superuser check in one artist fetch
    const needsSetupCheck = !isExempt && !isBookingPublic
    const needsSuperuserCheck = pathname.startsWith('/admin')

    if (needsSetupCheck || needsSuperuserCheck) {
      const { data: artistData } = await supabase
        .from('artists')
        .select('name, slug, gmail_address, is_superuser')
        .eq('id', user.id)
        .single()

      if (needsSuperuserCheck && !artistData?.is_superuser) {
        const url = request.nextUrl.clone()
        url.pathname = '/'
        return NextResponse.redirect(url)
      }

      if (needsSetupCheck) {
        // Placeholder detection — the DB trigger seeds default name
        // 'Artist XXXXXX' and default slug 'artist-XXXXXXXX' on signup.
        const nameOk = Boolean(artistData?.name) && !artistData!.name!.startsWith('Artist ')
        const slugOk = Boolean(artistData?.slug) && !artistData!.slug!.startsWith('artist-')
        const replyToOk = Boolean(artistData?.gmail_address)

        if (!nameOk || !slugOk || !replyToOk) {
          const url = request.nextUrl.clone()
          url.pathname = '/onboarding'
          // Land them on the step that still needs attention
          if (!nameOk || !slugOk) {
            // Step 1 is default; no param needed
            url.search = ''
          } else if (!replyToOk) {
            url.search = '?step=3'
          }
          return NextResponse.redirect(url)
        }
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
