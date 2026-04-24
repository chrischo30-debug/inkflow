import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { DepositSelector } from "@/components/onboarding/DepositSelector"
import { SlugInput } from "@/components/onboarding/SlugInput"
import { SendingMethodChooser } from "@/components/onboarding/SendingMethodChooser"
import type { DepositPolicy, DepositPolicyType } from "@/lib/types"

function StepBar({ step }: { step: 1 | 2 | 3 }) {
  const labels = ["Profile", "Preferences", "Email"]
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

    const styleTagsRaw = (formData.get("style_tags") as string | null)?.trim() ?? ""
    const style_tags = styleTagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
    const depositTypeRaw = formData.get("deposit_type") as string | null
    const depositType: DepositPolicyType = (
      depositTypeRaw === "fixed" || depositTypeRaw === "percentage" || depositTypeRaw === "custom"
    ) ? depositTypeRaw : "fixed"
    const depositAmountRaw = (formData.get("deposit_amount") as string | null)?.trim() ?? ""
    const depositPercentageRaw = (formData.get("deposit_percentage") as string | null)?.trim() ?? ""
    const depositNoteRaw = (formData.get("deposit_note") as string | null)?.trim() ?? ""

    const rp = new URLSearchParams({
      step: "2",
      style_tags: styleTagsRaw,
      deposit_type: depositType,
      deposit_amount: depositAmountRaw,
      deposit_percentage: depositPercentageRaw,
      deposit_note: depositNoteRaw,
    })

    const errors: Record<string, string> = {}
    if (depositType === "fixed") {
      const amount = Number(depositAmountRaw)
      if (!depositAmountRaw || isNaN(amount) || amount < 0) errors.deposit_amount = "Enter a valid deposit amount."
    } else if (depositType === "percentage") {
      const value = Number(depositPercentageRaw)
      if (!depositPercentageRaw || isNaN(value) || value < 1 || value > 100) errors.deposit_percentage = "Enter a percentage between 1 and 100."
    } else if (!depositNoteRaw) {
      errors.deposit_note = "Add a short note describing your deposit policy."
    }

    if (Object.keys(errors).length > 0) {
      for (const [field, error] of Object.entries(errors)) rp.set(`error_${field}`, error)
      rp.set("message", "Please fix the highlighted fields.")
      return redirect(`/onboarding?${rp.toString()}`)
    }

    let deposit_policy: DepositPolicy
    if (depositType === "percentage") {
      deposit_policy = { type: "percentage", value: Number(depositPercentageRaw) }
    } else if (depositType === "custom") {
      deposit_policy = { type: "custom", note: depositNoteRaw }
    } else {
      deposit_policy = { type: "fixed", amount: Number(depositAmountRaw) }
    }

    const { error } = await supabase.from("artists").update({ style_tags, deposit_policy }).eq("id", user.id)
    if (error) {
      rp.set("message", `Could not save: ${error.message}`)
      return redirect(`/onboarding?${rp.toString()}`)
    }

    return redirect("/onboarding?step=3")
  }

  const saveStep3 = async (formData: FormData) => {
    "use server"
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return redirect("/login")

    const method = formData.get("method") as string
    const displayName = (formData.get("display_name") as string | null)?.trim() || null

    const update: Record<string, unknown> = {
      sending_display_name: displayName,
    }

    if (method === "flashbooker") {
      const localPart = (formData.get("local_part") as string | null)?.toLowerCase().replace(/[^a-z0-9._-]/g, "") || null
      update.sending_method = "flashbooker"
      update.sending_local_part = localPart
    } else if (method === "custom_domain") {
      const domain = (formData.get("custom_domain") as string | null)?.toLowerCase().trim() || null
      const localPart = (formData.get("custom_local_part") as string | null)?.toLowerCase().replace(/[^a-z0-9._-]/g, "") || null
      if (!domain || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) {
        return redirect(`/onboarding?step=3&error=${encodeURIComponent("Enter a valid domain (e.g. yourstudio.com)")}`)
      }
      update.sending_method = "custom_domain"
      update.custom_sending_domain = domain
      update.custom_sending_domain_verified = false
      update.sending_local_part = localPart || "hello"
    } else if (method === "gmail_smtp") {
      const email = (formData.get("gmail_email") as string | null)?.trim() || null
      const appPassword = (formData.get("gmail_app_password") as string | null)?.replace(/\s+/g, "") || null
      if (!email || !email.includes("@")) {
        return redirect(`/onboarding?step=3&error=${encodeURIComponent("Enter your Gmail address")}`)
      }
      if (!appPassword || appPassword.length < 16) {
        return redirect(`/onboarding?step=3&error=${encodeURIComponent("Enter your 16-character Gmail App Password")}`)
      }
      update.sending_method = "gmail_smtp"
      update.gmail_smtp_email = email
      update.gmail_smtp_password_encrypted = appPassword // TODO: encrypt at rest before prod
    } else {
      return redirect(`/onboarding?step=3&error=${encodeURIComponent("Please pick one option")}`)
    }

    const { error } = await supabase.from("artists").update(update).eq("id", user.id)
    if (error) {
      return redirect(`/onboarding?step=3&error=${encodeURIComponent(error.message)}`)
    }

    return redirect("/setup?new=1")
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
    const defaultLocalPart = artist?.sending_local_part ?? artist?.slug ?? "bookings"
    const defaultDisplayName = artist?.sending_display_name ?? artist?.name ?? ""

    return (
      <div className="min-h-screen bg-surface">
        {header}
        <div className="max-w-xl mx-auto px-6 py-12">
          <StepBar step={3} />

          <div className="mb-8">
            <h2 className="text-3xl font-heading tracking-tight mb-2">How should we send emails?</h2>
            <p className="text-on-surface-variant">
              Pick how your client messages go out. Replies always come back to your FlashBooker inbox.
            </p>
          </div>

          <SendingMethodChooser
            defaultLocalPart={defaultLocalPart}
            defaultDisplayName={defaultDisplayName}
            formAction={saveStep3}
            errorMessage={params.error}
          />

          <div className="flex items-center justify-between mt-6">
            <Link href="/onboarding?step=2" className="text-sm text-on-surface-variant hover:text-on-surface transition-colors">
              ← Back
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Step 2
  const artistDepositType = artist?.deposit_policy?.type ?? "fixed"
  const defaultStyleTags = params.style_tags ?? (Array.isArray(artist?.style_tags) ? artist.style_tags.join(", ") : "")
  const defaultDepositType = (
    params.deposit_type === "fixed" || params.deposit_type === "percentage" || params.deposit_type === "custom"
  ) ? params.deposit_type : artistDepositType
  const defaultDepositAmount = params.deposit_amount ?? (artistDepositType === "fixed" ? String(artist?.deposit_policy?.amount ?? 0) : "")
  const defaultDepositPercentage = params.deposit_percentage ?? (artistDepositType === "percentage" ? String(artist?.deposit_policy?.value ?? 25) : "")
  const defaultDepositNote = params.deposit_note ?? (artistDepositType === "custom" ? artist?.deposit_policy?.note ?? "" : "")

  return (
    <div className="min-h-screen bg-surface">
      {header}
      <div className="max-w-xl mx-auto px-6 py-12">
        <StepBar step={2} />

        <div className="mb-10">
          <h2 className="text-3xl font-heading tracking-tight mb-2">Booking preferences</h2>
          <p className="text-on-surface-variant">Your style and deposit policy — shown to clients on your booking page.</p>
        </div>

        <form className="flex flex-col w-full gap-8" action={saveStep2}>
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-sans tracking-wide text-on-surface-variant" htmlFor="style_tags">
              Style Tags <span className="text-on-surface-variant/40 text-xs">(optional)</span>
            </Label>
            <Input
              id="style_tags"
              name="style_tags"
              defaultValue={defaultStyleTags}
              placeholder="blackwork, realism, fineline"
              className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-6 focus-visible:ring-0 focus-visible:border-primary shadow-none transition-colors"
            />
            <p className="text-xs text-on-surface-variant/60">Comma-separated. Shown on your public booking page.</p>
          </div>

          <div className="flex flex-col gap-3">
            <Label className="text-sm font-sans tracking-wide text-on-surface-variant">
              Deposit Policy
            </Label>
            <div className="bg-surface-container-high/40 rounded-t-lg border-b border-outline-variant p-4">
              <DepositSelector
                defaultType={defaultDepositType as DepositPolicyType}
                defaultAmount={defaultDepositAmount ? Number(defaultDepositAmount) : 0}
                defaultValue={defaultDepositPercentage ? Number(defaultDepositPercentage) : 25}
                defaultNote={defaultDepositNote}
              />
            </div>
            {params.error_deposit_amount && <p className="text-xs text-error">{params.error_deposit_amount}</p>}
            {params.error_deposit_percentage && <p className="text-xs text-error">{params.error_deposit_percentage}</p>}
            {params.error_deposit_note && <p className="text-xs text-error">{params.error_deposit_note}</p>}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Link
              href="/onboarding"
              className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
            >
              ← Back
            </Link>
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
