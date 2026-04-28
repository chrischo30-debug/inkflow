import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { SlugInput } from "@/components/onboarding/SlugInput"

function StepBar({ step }: { step: 1 | 2 | 3 }) {
  const labels = ["Profile", "Email", "Next steps"]
  return (
    <div className="flex items-center gap-3 mb-10">
      {labels.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3
        const isActive = step === n
        const isDone = step > n
        return (
          <div key={label} className="flex items-center gap-2 flex-1">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              isDone ? "bg-emerald-500 text-white"
                : isActive ? "bg-on-surface text-surface"
                : "bg-surface-container border border-outline-variant/30 text-on-surface-variant/40"
            }`}>
              {isDone ? "✓" : n}
            </span>
            <span className={`text-sm font-medium ${
              isActive ? "text-on-surface" : isDone ? "text-on-surface-variant" : "text-on-surface-variant/40"
            }`}>
              {label}
            </span>
            {i < labels.length - 1 && (
              <div className={`h-px flex-1 ml-1 ${isDone ? "bg-emerald-400" : "bg-outline-variant/30"}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const step: 1 | 2 | 3 = params.step === "3" ? 3 : params.step === "2" ? 2 : 1

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  const { data: artist } = await supabase
    .from("artists")
    .select("*")
    .eq("id", user.id)
    .single()

  const saveStep1 = async (formData: FormData) => {
    "use server"
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return redirect("/login")

    const name = (formData.get("name") as string | null)?.trim() ?? ""
    const rawSlug = (formData.get("slug") as string | null)?.trim() ?? ""
    const slug = rawSlug.toLowerCase().replace(/[^a-z0-9-]/g, "-")
    const studio_name = (formData.get("studio_name") as string | null)?.trim() ?? ""

    const rp = new URLSearchParams({ step: "1", name, slug, studio_name })

    const errors: Record<string, string> = {}
    if (name.length < 2) errors.name = "Artist name must be at least 2 characters."
    if (!slug) errors.slug = "Booking URL is required."
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      errors.slug = "Use only lowercase letters, numbers, and single hyphens."
    }

    if (Object.keys(errors).length > 0) {
      for (const [field, error] of Object.entries(errors)) rp.set(`error_${field}`, error)
      rp.set("message", "Please fix the highlighted fields.")
      return redirect(`/onboarding?${rp.toString()}`)
    }

    const { error } = await supabase.from("artists").update({ name, slug, studio_name }).eq("id", user.id)
    if (error) {
      if (error.code === "23505") {
        rp.set("error_slug", `The URL "${slug}" is already taken. Try another.`)
        rp.set("message", "Please fix the highlighted fields.")
        return redirect(`/onboarding?${rp.toString()}`)
      }
      rp.set("message", `Could not save: ${error.message}`)
      return redirect(`/onboarding?${rp.toString()}`)
    }

    return redirect("/onboarding?step=2")
  }

  const saveStep2 = async (formData: FormData) => {
    "use server"
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return redirect("/login")

    const replyToRaw = (formData.get("reply_to_email") as string | null)?.trim() ?? ""
    const replyTo = replyToRaw.toLowerCase()

    if (!replyTo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) {
      return redirect(`/onboarding?step=2&error=${encodeURIComponent("Enter a valid email address for client replies.")}`)
    }

    const { error } = await supabase
      .from("artists")
      .update({ gmail_address: replyTo })
      .eq("id", user.id)

    if (error) {
      return redirect(`/onboarding?step=2&error=${encodeURIComponent(error.message)}`)
    }

    return redirect("/onboarding?step=3")
  }

  const safeSlug = artist?.slug?.startsWith("artist-") ? "" : artist?.slug

  const header = (
    <header className="px-8 py-6 border-b border-outline-variant/20 flex items-center gap-3">
      <img src="/logo.png" alt="FlashBooker logo" className="w-8 h-8 object-contain" />
      <div>
        <p className="text-base font-heading font-bold tracking-tight text-on-surface">FlashBooker</p>
        <p className="text-xs text-on-surface-variant">{user.email}</p>
      </div>
    </header>
  )

  if (step === 1) {
    const defaultName = params.name ?? (artist?.name?.startsWith("Artist ") ? "" : artist?.name ?? "")
    const defaultSlug = params.slug ?? (safeSlug ?? "")
    const defaultStudio = params.studio_name ?? (artist?.studio_name ?? "")

    return (
      <div className="min-h-screen bg-surface">
        {header}
        <div className="max-w-xl mx-auto px-6 py-12">
          <StepBar step={1} />

          <div className="mb-10">
            <h2 className="text-3xl font-heading tracking-tight mb-2">Your profile</h2>
            <p className="text-on-surface-variant">How clients will find and identify you.</p>
          </div>

          <form className="flex flex-col w-full gap-8" action={saveStep1}>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-sans tracking-wide text-on-surface-variant" htmlFor="name">
                Artist Name <span className="text-error">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={defaultName}
                className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-6 focus-visible:ring-0 focus-visible:border-primary shadow-none transition-colors"
              />
              {params.error_name && <p className="text-xs text-error">{params.error_name}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-sans tracking-wide text-on-surface-variant" htmlFor="slug">
                Booking URL <span className="text-error">*</span>
              </Label>
              <SlugInput defaultValue={defaultSlug} errorFromServer={params.error_slug} />
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-sans tracking-wide text-on-surface-variant" htmlFor="studio_name">
                Studio Name <span className="text-on-surface-variant/40 text-xs">(optional)</span>
              </Label>
              <Input
                id="studio_name"
                name="studio_name"
                defaultValue={defaultStudio}
                className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-6 focus-visible:ring-0 focus-visible:border-primary shadow-none transition-colors"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                className="px-10 h-auto py-3 text-sm font-medium rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-sm hover:opacity-90 transition-opacity"
              >
                Continue →
              </Button>
            </div>

            {params.message && (
              <p className="p-4 bg-error-container/30 text-error text-sm rounded-lg border-b border-error">
                {params.message}
              </p>
            )}
          </form>
        </div>
      </div>
    )
  }

  if (step === 3) {
    return (
      <div className="min-h-screen bg-surface">
        {header}
        <div className="max-w-xl mx-auto px-6 py-12">
          <StepBar step={3} />

          <div className="mb-8">
            <h2 className="text-3xl font-heading tracking-tight mb-2">You&apos;re set up.</h2>
            <p className="text-on-surface-variant">A few things worth doing next so your booking page is ready for clients.</p>
          </div>

          <div className="space-y-4 mb-8">
            <Link
              href="/form-builder"
              className="block bg-surface-container-low rounded-2xl border border-outline-variant/20 p-5 hover:border-outline-variant/40 transition-colors"
            >
              <p className="text-base font-semibold text-on-surface mb-1">Customize your booking form →</p>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Pick which questions clients answer when they request a booking. Add your own fields, change the header copy, set a confirmation message.
              </p>
            </Link>

            <div className="bg-surface-container-low rounded-2xl border border-outline-variant/20 p-5">
              <p className="text-base font-semibold text-on-surface mb-3">Recommended on the next page</p>
              <ul className="space-y-2.5 text-sm text-on-surface-variant leading-relaxed">
                <li className="flex gap-2">
                  <span className="text-on-surface-variant/50 shrink-0">•</span>
                  <span><span className="text-on-surface font-medium">Connect Google Calendar</span> so confirmed bookings sync to your personal calendar.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-on-surface-variant/50 shrink-0">•</span>
                  <span><span className="text-on-surface font-medium">Connect Stripe or Square</span> so deposits get marked paid automatically.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-on-surface-variant/50 shrink-0">•</span>
                  <span><span className="text-on-surface font-medium">Save reusable payment and scheduling links</span> so you can drop them into emails with one click.</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex items-center justify-end pt-2">
            <Link
              href="/setup?new=1"
              className="px-10 h-auto py-3 text-sm font-medium rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-sm hover:opacity-90 transition-opacity inline-flex items-center"
            >
              Go to setup guide →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Step 2 — email
  const defaultReplyTo = artist?.gmail_address ?? user.email ?? ""
  const displayName = artist?.name || artist?.studio_name || "Your Name"

  return (
    <div className="min-h-screen bg-surface">
      {header}
      <div className="max-w-xl mx-auto px-6 py-12">
        <StepBar step={2} />

        <div className="mb-8">
          <h2 className="text-3xl font-heading tracking-tight mb-2">How email works</h2>
          <p className="text-on-surface-variant">Here&apos;s what happens when you send a client an email — confirm your reply-to address below to finish.</p>
        </div>

        {/* Visual explainer */}
        <div className="bg-surface-container-low rounded-2xl border border-outline-variant/15 p-5 mb-6 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-on-surface-variant font-semibold mb-1.5">1. You send a message</p>
            <p className="text-sm text-on-surface leading-relaxed">
              You click <span className="font-medium">Send email</span>{" "}on a booking. We send it for you — you don&apos;t need to log into Gmail or anything else.
            </p>
          </div>

          <div className="border-t border-outline-variant/15 pt-4">
            <p className="text-xs uppercase tracking-wide text-on-surface-variant font-semibold mb-1.5">2. Your client sees</p>
            <div className="bg-surface rounded-lg border border-outline-variant/20 p-3 font-mono text-xs">
              <p className="text-on-surface-variant/70">From:</p>
              <p className="text-on-surface font-semibold">{displayName} via FlashBooker</p>
              <p className="text-on-surface-variant mt-0.5">&lt;bookings@flashbooker.app&gt;</p>
            </div>
            <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
              Your name is on the email, so it feels personal — but it&apos;s sent from our system so it always gets delivered.
            </p>
          </div>

          <div className="border-t border-outline-variant/15 pt-4">
            <p className="text-xs uppercase tracking-wide text-on-surface-variant font-semibold mb-1.5">3. When they reply</p>
            <p className="text-sm text-on-surface leading-relaxed">
              Their reply goes <span className="font-semibold">straight to your personal email below</span> — just like a normal email. You can reply from your inbox, phone, wherever. FlashBooker isn&apos;t in the middle of your conversations.
            </p>
          </div>
        </div>

        <form className="flex flex-col w-full gap-5" action={saveStep2}>
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-sans tracking-wide text-on-surface-variant" htmlFor="reply_to_email">
              Your email (where client replies will land) <span className="text-error">*</span>
            </Label>
            <Input
              id="reply_to_email"
              name="reply_to_email"
              type="email"
              required
              defaultValue={defaultReplyTo}
              className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-5 focus-visible:ring-0 focus-visible:border-primary shadow-none transition-colors"
            />
            <p className="text-xs text-on-surface-variant/70">
              Usually your Gmail, Outlook, or whatever email you check most. You can change this later in Settings.
            </p>
            {params.error && <p className="text-xs text-error">{params.error}</p>}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Link href="/onboarding" className="text-sm text-on-surface-variant hover:text-on-surface transition-colors">
              ← Back
            </Link>
            <Button
              type="submit"
              className="px-10 h-auto py-3 text-sm font-medium rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-sm hover:opacity-90 transition-opacity"
            >
              Finish setup →
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
