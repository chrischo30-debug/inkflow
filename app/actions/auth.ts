'use server'

import { createClient } from '@/utils/supabase/server'
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
  const email = formData.get('email') as string
  if (!email) return redirect('/forgot-password?message=Email+is+required')

  const supabase = await createClient()

  const { headers } = await import('next/headers')
  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const proto = headersList.get('x-forwarded-proto') ?? 'http'
  const origin = `${proto}://${host}`
  const redirectTo = `${origin}/auth/callback?next=/reset-password`

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

  if (error) {
    return redirect(`/forgot-password?message=${encodeURIComponent(error.message)}`)
  }

  return redirect('/forgot-password?message=Check+your+email+for+a+password+reset+link.')
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
