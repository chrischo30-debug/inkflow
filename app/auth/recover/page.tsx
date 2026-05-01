'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function AuthRecoverPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const next = params.get('next') || '/reset-password'
    const hash = typeof window !== 'undefined' ? window.location.hash : ''

    async function run() {
      const supabase = createClient()

      // PKCE flow: ?code=... in the query string.
      const code = params.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setError(error.message)
          return
        }
        router.replace(next)
        return
      }

      // Implicit flow: tokens in the URL fragment after #.
      if (hash && hash.length > 1) {
        const frag = new URLSearchParams(hash.slice(1))
        const access_token = frag.get('access_token')
        const refresh_token = frag.get('refresh_token')
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token })
          if (error) {
            setError(error.message)
            return
          }
          // Strip the hash so it doesn't linger in the URL bar.
          window.history.replaceState(null, '', window.location.pathname + window.location.search)
          router.replace(next)
          return
        }
      }

      setError('Reset link expired or invalid. Please request a new one.')
    }

    run()
  }, [params, router])

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-surface">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-error mb-4">{error}</p>
            <a href="/forgot-password" className="text-primary underline">
              Request a new reset link
            </a>
          </>
        ) : (
          <p className="text-on-surface-variant">Verifying reset link…</p>
        )}
      </div>
    </div>
  )
}
