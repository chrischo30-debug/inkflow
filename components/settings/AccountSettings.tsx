"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Copy, CheckCircle2, XCircle, Loader2, Upload, X as XIcon } from "lucide-react";

const accountSchema = z.object({
  name: z.string().min(2, "Artist name must be at least 2 characters"),
  slug: z
    .string()
    .min(2, "Public URL is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only"),
  studio_name: z.string().optional(),
  studio_address: z.string().optional(),
  gmail_address: z.string().email("Enter a valid email address"),
  email_logo_enabled: z.boolean(),
  email_logo_bg: z.enum(["light", "dark"]),
});

type AccountSettingsValues = z.infer<typeof accountSchema>;

export function AccountSettings({
  initialValues,
}: {
  initialValues: {
    name: string;
    slug: string;
    studio_name: string;
    studio_address: string;
    email: string;
    gmail_address: string;
    email_logo_enabled: boolean;
    email_logo_bg: "light" | "dark";
    has_logo: boolean;
    logo_url: string | null;
  };
}) {
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const slugTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialValues.logo_url);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setOrigin(window.location.origin); }, []);

  const form = useForm<AccountSettingsValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: initialValues.name,
      slug: initialValues.slug,
      studio_name: initialValues.studio_name,
      studio_address: initialValues.studio_address,
      gmail_address: initialValues.gmail_address,
      email_logo_enabled: initialValues.email_logo_enabled,
      email_logo_bg: initialValues.email_logo_bg,
    },
  });

  const slug = form.watch("slug");
  const bookingUrl = `${origin}/${slug}/book`;

  useEffect(() => {
    if (!slug || slug === initialValues.slug) { setSlugStatus("idle"); return; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { setSlugStatus("idle"); return; }
    setSlugStatus("checking");
    if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
    slugTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/check-slug?slug=${encodeURIComponent(slug)}`);
        const data = await res.json();
        setSlugStatus(data.available ? "available" : "taken");
      } catch { setSlugStatus("idle"); }
    }, 400);
    return () => { if (slugTimerRef.current) clearTimeout(slugTimerRef.current); };
  }, [slug, initialValues.slug]);

  const copyUrl = async () => {
    const url = `${window.location.origin}/${slug}/book`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Logo upload — saves immediately so it shows on the public booking page right
  // away (the booking page reads logo_url from the same artists.logo_url column).
  const persistLogo = async (url: string | null) => {
    setLogoError(null);
    const res = await fetch("/api/artist/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.getValues("name"),
        slug: form.getValues("slug"),
        studio_name: form.getValues("studio_name"),
        studio_address: form.getValues("studio_address"),
        gmail_address: form.getValues("gmail_address"),
        email_logo_enabled: form.getValues("email_logo_enabled"),
        email_logo_bg: form.getValues("email_logo_bg"),
        logo_url: url,
      }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setLogoError(b.error || "Failed to save logo");
      return false;
    }
    return true;
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    setLogoError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch("/api/uploads/logo", { method: "POST", body: fd });
      const upBody = await upRes.json();
      if (!upRes.ok) {
        setLogoError(upBody.error || "Upload failed");
        return;
      }
      const newUrl = upBody.url as string;
      if (await persistLogo(newUrl)) setLogoUrl(newUrl);
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  };

  const handleLogoRemove = async () => {
    if (await persistLogo(null)) setLogoUrl(null);
  };

  const onSubmit = async (data: AccountSettingsValues) => {
    setSaveStatus("idle");
    setErrorMsg("");
    const res = await fetch("/api/artist/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const body = await res.json();
    if (!res.ok) {
      setErrorMsg(body.error || "Failed to save settings.");
      setSaveStatus("error");
      return;
    }

    setSaveStatus("success");
    setTimeout(() => setSaveStatus("idle"), 3000);
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-4 md:p-8 shadow-sm">
      <h3 className="text-lg font-heading font-semibold mb-2 text-on-surface">Account Settings</h3>
      <p className="text-sm text-on-surface-variant mb-8 max-w-xl leading-relaxed">
        Manage your artist profile details and public booking URL.
      </p>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6 max-w-2xl"
          suppressHydrationWarning
        >
          <div className="space-y-2" suppressHydrationWarning>
            <FormLabel className="text-sm font-sans tracking-wide text-on-surface-variant">Login Email</FormLabel>
            <Input value={initialValues.email} disabled className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-6" />
          </div>

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-sans tracking-wide text-on-surface-variant">Artist Name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-6 focus-visible:ring-0 focus-visible:border-primary shadow-none transition-colors"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-sans tracking-wide text-on-surface-variant">Public Booking URL Slug</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      {...field}
                      className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-6 pr-10 focus-visible:ring-0 focus-visible:border-primary shadow-none transition-colors"
                    />
                    {slugStatus !== "idle" && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        {slugStatus === "checking" && <Loader2 className="w-4 h-4 text-on-surface-variant/40 animate-spin" />}
                        {slugStatus === "available" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        {slugStatus === "taken" && <XCircle className="w-4 h-4 text-destructive" />}
                      </span>
                    )}
                  </div>
                </FormControl>
                {slugStatus === "available" && <p className="text-xs text-emerald-600 font-medium">"{slug}" is available!</p>}
                {slugStatus === "taken" && <p className="text-xs text-destructive">"{slug}" is already taken. Try another.</p>}
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Live URL display */}
          <div className="flex items-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container px-4 py-3">
            <span className="flex-1 text-sm font-mono text-on-surface-variant truncate">{bookingUrl}</span>
            <button
              type="button"
              onClick={copyUrl}
              className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-on-surface-variant hover:text-on-surface transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <FormField
            control={form.control}
            name="studio_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-sans tracking-wide text-on-surface-variant">Studio Name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-6 focus-visible:ring-0 focus-visible:border-primary shadow-none transition-colors"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="studio_address"
            render={({ field }) => {
              const trimmed = (field.value ?? "").trim();
              const mapsUrl = trimmed
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`
                : null;
              return (
                <FormItem>
                  <FormLabel className="text-sm font-sans tracking-wide text-on-surface-variant">Studio Address</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="123 Main St, Brooklyn, NY 11201"
                      className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-6 focus-visible:ring-0 focus-visible:border-primary shadow-none transition-colors"
                    />
                  </FormControl>
                  <div className="text-sm text-on-surface-variant space-y-1.5 mt-1">
                    <p>Included as a Google Maps link in client confirmation emails. Leave blank to skip.</p>
                    <p>For best results paste the full street address. Partial addresses or business names sometimes resolve to the wrong place.</p>
                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                      >
                        Preview on Google Maps →
                      </a>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <FormField
            control={form.control}
            name="gmail_address"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-sans tracking-wide text-on-surface-variant">Reply-to Email</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-6 focus-visible:ring-0 focus-visible:border-primary shadow-none transition-colors"
                  />
                </FormControl>
                <p className="text-sm text-on-surface-variant mt-1">Where client replies land, and where system notifications are sent. Usually your personal email.</p>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="rounded-lg border border-outline-variant/30 bg-surface-container-high/40 px-4 py-4 space-y-4">
            {/* Logo upload — same logo shows on booking page and in client emails */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-on-surface">Logo</p>
                <p className="text-sm text-on-surface-variant mt-1">
                  Shown on your public booking page and at the top of client emails. Same logo, both places.
                </p>
              </div>
              <div className="flex items-center gap-4">
                {logoUrl && (
                  <div className="relative group shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoUrl} alt="Logo" className="h-14 w-auto max-w-[140px] object-contain rounded border border-outline-variant/30 bg-surface p-1" />
                    <button
                      type="button"
                      onClick={handleLogoRemove}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-surface border border-outline-variant/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove logo"
                    >
                      <XIcon className="w-3 h-3 text-on-surface-variant" />
                    </button>
                  </div>
                )}
                <input ref={logoInputRef} type="file" accept="image/*" className="sr-only" onChange={handleLogoUpload} />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-outline-variant/40 text-sm text-on-surface-variant hover:border-outline-variant hover:text-on-surface transition-colors disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {uploadingLogo ? "Uploading…" : logoUrl ? "Replace" : "Upload logo"}
                </button>
              </div>
              <p className="text-sm text-on-surface-variant">
                PNG or SVG with a transparent background works best. Max 5MB.
              </p>
              {logoError && <p className="text-xs text-destructive">{logoError}</p>}
            </div>

            {/* Email logo toggle */}
            <div className="flex items-center justify-between gap-4 pt-3 border-t border-outline-variant/15">
              <div className="min-w-0">
                <p className="text-sm font-medium text-on-surface">Show logo in client emails</p>
                <p className="text-sm text-on-surface-variant mt-1">
                  {logoUrl
                    ? "Your logo appears at the top of every client email."
                    : "Upload a logo first to enable this."}
                </p>
              </div>
              <FormField
                control={form.control}
                name="email_logo_enabled"
                render={({ field }) => (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={field.value}
                    aria-label="Show logo in client emails"
                    disabled={!logoUrl}
                    onClick={() => field.onChange(!field.value)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 disabled:opacity-40 ${field.value ? "bg-primary" : "bg-outline-variant"}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${field.value ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                )}
              />
            </div>

            {/* Email logo background picker */}
            {logoUrl && form.watch("email_logo_enabled") && (
              <FormField
                control={form.control}
                name="email_logo_bg"
                render={({ field }) => (
                  <div className="pt-3 border-t border-outline-variant/15 space-y-2">
                    <p className="text-xs font-medium text-on-surface-variant">Header background</p>
                    <p className="text-[11px] text-on-surface-variant/70">Pick the one your logo looks best on.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(["light", "dark"] as const).map(bg => {
                        const selected = field.value === bg;
                        const isDark = bg === "dark";
                        return (
                          <button
                            key={bg}
                            type="button"
                            onClick={() => field.onChange(bg)}
                            className={`rounded-lg border-2 overflow-hidden transition-colors ${selected ? "border-on-surface" : "border-outline-variant/30 hover:border-outline-variant/60"}`}
                          >
                            <div className="flex items-center justify-center px-3 py-4" style={{ background: isDark ? "#111111" : "#ffffff" }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={logoUrl} alt="" className="max-h-8 max-w-[100px] object-contain" />
                            </div>
                            <p className="text-[11px] font-medium text-on-surface py-1.5 bg-surface-container-low">
                              {isDark ? "Dark" : "Light"}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              />
            )}
          </div>

          {saveStatus === "success" && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-300/50 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              <Check className="w-4 h-4 shrink-0" />
              Account settings saved successfully.
            </div>
          )}
          {saveStatus === "error" && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
              {errorMsg}
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-auto py-3 text-sm font-medium rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-sm hover:opacity-90 transition-opacity"
          >
            Save Account Settings
          </Button>
        </form>
      </Form>
    </div>
  );
}
