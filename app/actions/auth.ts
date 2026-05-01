'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTransactionalEmail } from '@/lib/email'
import { redirect } from 'next/navigation'

export async function signUp(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) {
    return redirect(`/signup?message=${encodeURIComponent(error.message)}`)
  }

  // If session is null, email confirmation is still required in Supabase
  if (!data.session) {
    return redirect(`/signup?message=${encodeURIComponent('Check your email to confirm your account before continuing.')}`)
  }

  return redirect('/onboarding')
}

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return redirect(`/login?message=${encodeURIComponent(error.message)}`)
  }

  return redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return redirect('/login')
}

export async function resetPassword(formData: FormData) {
  const rawEmail = formData.get('email')
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''
  if (!email) return redirect('/forgot-password?message=Email+is+required')

  const { headers } = await import('next/headers')
  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const proto = headersList.get('x-forwarded-proto') ?? 'http'
  const origin = `${proto}://${host}`
  const redirectTo = `${origin}/auth/callback?next=/reset-password`

  // Always show the same message — don't leak which addresses have accounts.
  const successUrl = '/forgot-password?message=Check+your+email+for+a+password+reset+link.'

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  })

  if (error || !data?.properties?.action_link) {
    return redirect(successUrl)
  }

  const { data: artist } = await admin
    .from('artists')
    .select('name, email, logo_url, email_logo_enabled, email_logo_bg')
    .eq('email', email)
    .maybeSingle()

  const artistName = (artist as { name?: string | null } | null)?.name ?? null
  const greeting = artistName ? `Hi ${artistName.split(' ')[0]},` : 'Hi,'
  const body = `${greeting}\n\nSomeone requested a password reset for your FlashBooker account. Click the link below to set a new password. The link expires in 1 hour.\n\n[Reset password](${data.properties.action_link})\n\nIf you didn't request this, you can safely ignore this email.`

  await sendTransactionalEmail({
    toEmail: email,
    subject: 'Reset your FlashBooker password',
    body,
    fromName: artistName ?? 'FlashBooker',
    branding: artist
      ? {
          logoUrl: (artist as { logo_url?: string | null }).logo_url ?? null,
          logoEnabled:
            (artist as { email_logo_enabled?: boolean | null }).email_logo_enabled !== false,
          logoBg:
            ((artist as { email_logo_bg?: 'light' | 'dark' | null }).email_logo_bg ?? 'light') as
              | 'light'
              | 'dark',
        }
      : undefined,
  })

  return redirect(successUrl)
}

export async function updatePassword(formData: FormData) {
  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string

  if (!password || password.length < 6) {
    return redirect('/reset-password?message=Password+must+be+at+least+6+characters.')
  }
  if (password !== confirm) {
    return redirect('/reset-password?message=Passwords+do+not+match.')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return redirect(`/reset-password?message=${encodeURIComponent(error.message)}`)
  }

  return redirect('/?message=Password+updated+successfully.')
}
