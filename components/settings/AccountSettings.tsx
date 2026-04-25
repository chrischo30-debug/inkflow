"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Copy, CheckCircle2, XCircle, Loader2 } from "lucide-react";

const accountSchema = z.object({
  name: z.string().min(2, "Artist name must be at least 2 characters"),
  slug: z
    .string()
    .min(2, "Public URL is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only"),
  studio_name: z.string().optional(),
  gmail_address: z.string().email("Enter a valid email address"),
});

type AccountSettingsValues = z.infer<typeof accountSchema>;

export function AccountSettings({
  initialValues,
}: {
  initialValues: {
    name: string;
    slug: string;
    studio_name: string;
    email: string;
    gmail_address: string;
  };
}) {
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const slugTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setOrigin(window.location.origin); }, []);

  const form = useForm<AccountSettingsValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: initialValues.name,
      slug: initialValues.slug,
      studio_name: initialValues.studio_name,
      gmail_address: initialValues.gmail_address,
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
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-8 shadow-sm">
      <h3 className="text-lg font-heading font-semibold mb-2 text-on-surface">Account Settings</h3>
      <p className="text-sm text-on-surface-variant mb-8 max-w-xl leading-relaxed">
        Manage your artist profile details and public booking URL.
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
          <div className="space-y-2">
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
                <p className="text-xs text-on-surface-variant">Where client replies land, and where system notifications are sent. Usually your personal email.</p>
                <FormMessage />
              </FormItem>
            )}
          />

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
