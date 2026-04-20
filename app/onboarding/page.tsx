import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { DepositSelector } from "@/components/onboarding/DepositSelector"
import type { DepositPolicy, DepositPolicyType } from "@/lib/types"

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams;

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return redirect("/login")

  const { data: artist } = await supabase
    .from("artists")
    .select("*")
    .eq("id", user.id)
    .single()

  const safeSlug = artist?.slug?.startsWith("artist-") ? "" : artist?.slug
  const artistDepositType = artist?.deposit_policy?.type ?? "fixed"

  const defaultValues = {
    name: params.name ?? (artist?.name?.startsWith("Artist ") ? "" : artist?.name ?? ""),
    slug: params.slug ?? (safeSlug ?? ""),
    studio_name: params.studio_name ?? (artist?.studio_name ?? ""),
    style_tags: params.style_tags ?? (Array.isArray(artist?.style_tags) ? artist.style_tags.join(", ") : ""),
    deposit_type: (
      params.deposit_type === "fixed" ||
      params.deposit_type === "percentage" ||
      params.deposit_type === "custom"
    )
      ? params.deposit_type
      : artistDepositType,
    deposit_amount: params.deposit_amount ?? (
      artistDepositType === "fixed" ? String(artist?.deposit_policy.amount ?? 0) : ""
    ),
    deposit_percentage: params.deposit_percentage ?? (
      artistDepositType === "percentage" ? String(artist?.deposit_policy.value ?? 25) : ""
    ),
    deposit_note: params.deposit_note ?? (
      artistDepositType === "custom" ? artist?.deposit_policy.note ?? "" : ""
    ),
  }

  const errors = {
    name: params.error_name,
    slug: params.error_slug,
    studio_name: params.error_studio_name,
    style_tags: params.error_style_tags,
    deposit_amount: params.error_deposit_amount,
    deposit_percentage: params.error_deposit_percentage,
    deposit_note: params.error_deposit_note,
  }

  const message = params.message

  const submitProfile = async (formData: FormData) => {
    "use server"

    const actionSupabase = await createClient()
    const { data: { user: actionUser } } = await actionSupabase.auth.getUser()
    if (!actionUser) return redirect("/login")

    const name = (formData.get("name") as string | null)?.trim() ?? ""
    const rawSlug = (formData.get("slug") as string | null)?.trim() ?? ""
    const slug = rawSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const studio_name = (formData.get("studio_name") as string | null)?.trim() ?? ""
    const styleTagsRaw = (formData.get("style_tags") as string | null)?.trim() ?? ""
    const style_tags = styleTagsRaw
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
    const depositTypeRaw = formData.get("deposit_type") as string | null
    const depositType: DepositPolicyType = (
      depositTypeRaw === "fixed" ||
      depositTypeRaw === "percentage" ||
      depositTypeRaw === "custom"
    ) ? depositTypeRaw : "fixed"
    const depositAmountRaw = (formData.get("deposit_amount") as string | null)?.trim() ?? ""
    const depositPercentageRaw = (formData.get("deposit_percentage") as string | null)?.trim() ?? ""
    const depositNoteRaw = (formData.get("deposit_note") as string | null)?.trim() ?? ""

    const redirectParams = new URLSearchParams({
      name,
      slug,
      studio_name,
      style_tags: styleTagsRaw,
      deposit_type: depositType,
      deposit_amount: depositAmountRaw,
      deposit_percentage: depositPercentageRaw,
      deposit_note: depositNoteRaw,
    })

    const validationErrors: Record<string, string> = {}
    if (name.length < 2) validationErrors.name = "Artist name must be at least 2 characters."
    if (!slug) validationErrors.slug = "Booking URL is required."
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      validationErrors.slug = "Use only lowercase letters, numbers, and single hyphens."
    }

    if (depositType === "fixed") {
      const amount = Number(depositAmountRaw)
      if (!depositAmountRaw || Number.isNaN(amount) || amount < 0) {
        validationErrors.deposit_amount = "Enter a valid fixed deposit amount."
      }
    } else if (depositType === "percentage") {
      const value = Number(depositPercentageRaw)
      if (!depositPercentageRaw || Number.isNaN(value) || value < 1 || value > 100) {
        validationErrors.deposit_percentage = "Enter a percentage between 1 and 100."
      }
    } else if (!depositNoteRaw) {
      validationErrors.deposit_note = "Add a short note for your custom deposit policy."
    }

    if (Object.keys(validationErrors).length > 0) {
      for (const [field, error] of Object.entries(validationErrors)) {
        redirectParams.set(`error_${field}`, error)
      }
      redirectParams.set("message", "Please fix the highlighted fields.")
      return redirect(`/onboarding?${redirectParams.toString()}`)
    }

    let deposit_policy: DepositPolicy

    if (depositType === 'percentage') {
      const value = Number(depositPercentageRaw)
      deposit_policy = { type: 'percentage', value }
    } else if (depositType === 'custom') {
      const note = depositNoteRaw
      deposit_policy = { type: 'custom', note }
    } else {
      const amount = Number(depositAmountRaw)
      deposit_policy = { type: 'fixed', amount }
    }

    const { error } = await actionSupabase
      .from("artists")
      .update({ name, slug, studio_name, style_tags, deposit_policy })
      .eq("id", actionUser.id)

    if (error) {
      if (error.code === '23505') {
        redirectParams.set("error_slug", `The URL "${slug}" is already taken. Try another.`)
        redirectParams.set("message", "Please fix the highlighted fields.")
        return redirect(`/onboarding?${redirectParams.toString()}`)
      }
      redirectParams.set("message", `Could not save profile: ${error.message}`)
      return redirect(`/onboarding?${redirectParams.toString()}`)
    }

    return redirect("/")
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Minimal top bar */}
      <header className="px-8 py-6 border-b border-outline-variant/20 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-3">
          <img src="/logo.png" alt="FlashBook logo" className="w-8 h-8 object-contain" />
          <div>
            <p className="text-base font-heading font-bold tracking-tight text-on-surface">
              {artist?.name?.startsWith("Artist ") ? "Your Setup" : (artist?.name || "Your Setup")}
            </p>
            <p className="text-xs text-on-surface-variant">{user.email}</p>
          </div>
        </Link>
      </header>

      {/* Centered form */}
      <div className="max-w-xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h2 className="text-3xl font-heading tracking-tight mb-2">Set up your profile</h2>
          <p className="text-on-surface-variant">Just a few details so clients can find and book you.</p>
        </div>

        <form className="animate-in flex flex-col w-full gap-8 text-foreground" action={submitProfile}>

            {/* Artist Name */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-sans tracking-wide text-on-surface-variant" htmlFor="name">
                Artist Name <span className="text-error">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={defaultValues.name}
                className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-6 focus-visible:ring-0 focus-visible:border-primary shadow-none transition-colors"
              />
              {errors.name && <p className="text-xs text-error">{errors.name}</p>}
              <p className="text-xs text-on-surface-variant/60">This is how clients will see you.</p>
            </div>

            {/* Booking URL */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-sans tracking-wide text-on-surface-variant" htmlFor="slug">
                Public Booking URL <span className="text-error">*</span>
              </Label>
              <div className="flex items-stretch">
                <span className="flex items-center bg-surface-container-high text-on-surface-variant/70 px-3 text-sm border-b border-outline-variant rounded-tl-lg rounded-bl-none whitespace-nowrap">
                  flashbook.app/book/
                </span>
                <Input
                  id="slug"
                  name="slug"
                  required
                  defaultValue={defaultValues.slug}
                  className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-none rounded-tr-lg px-4 py-6 focus-visible:ring-0 focus-visible:border-primary shadow-none transition-colors flex-1"
                />
              </div>
              {errors.slug && <p className="text-xs text-error">{errors.slug}</p>}
              <p className="text-xs text-on-surface-variant/60">Letters, numbers, and hyphens only.</p>
            </div>

            {/* Studio Name */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-sans tracking-wide text-on-surface-variant" htmlFor="studio_name">
                Studio Name <span className="text-on-surface-variant/40 text-xs">(optional)</span>
              </Label>
              <Input
                id="studio_name"
                name="studio_name"
                defaultValue={defaultValues.studio_name}
                className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-6 focus-visible:ring-0 focus-visible:border-primary shadow-none transition-colors"
              />
              {errors.studio_name && <p className="text-xs text-error">{errors.studio_name}</p>}
            </div>

            {/* Style Tags */}
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-sans tracking-wide text-on-surface-variant" htmlFor="style_tags">
                Style Tags <span className="text-on-surface-variant/40 text-xs">(optional)</span>
              </Label>
              <Input
                id="style_tags"
                name="style_tags"
                defaultValue={defaultValues.style_tags}
                placeholder="blackwork, realism, fineline"
                className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-6 focus-visible:ring-0 focus-visible:border-primary shadow-none transition-colors"
              />
              {errors.style_tags && <p className="text-xs text-error">{errors.style_tags}</p>}
              <p className="text-xs text-on-surface-variant/60">Comma-separated styles shown on your public profile.</p>
            </div>

            {/* Deposit Policy */}
            <div className="flex flex-col gap-3">
              <Label className="text-sm font-sans tracking-wide text-on-surface-variant">
                Deposit Policy
              </Label>
              <div className="bg-surface-container-high/40 rounded-t-lg border-b border-outline-variant p-4">
                <DepositSelector
                  defaultType={defaultValues.deposit_type as DepositPolicyType}
                  defaultAmount={defaultValues.deposit_amount ? Number(defaultValues.deposit_amount) : 0}
                  defaultValue={defaultValues.deposit_percentage ? Number(defaultValues.deposit_percentage) : 25}
                  defaultNote={defaultValues.deposit_note}
                />
              </div>
              {errors.deposit_amount && <p className="text-xs text-error">{errors.deposit_amount}</p>}
              {errors.deposit_percentage && <p className="text-xs text-error">{errors.deposit_percentage}</p>}
              {errors.deposit_note && <p className="text-xs text-error">{errors.deposit_note}</p>}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                className="px-10 h-auto py-3 text-sm font-medium rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-sm hover:opacity-90 transition-opacity"
              >
                Complete Setup
              </Button>
            </div>

          {message && (
              <p className="p-4 bg-error-container/30 text-error text-sm rounded-lg border-b border-error">
                {message}
              </p>
            )}
        </form>
      </div>
    </div>
  )
}
