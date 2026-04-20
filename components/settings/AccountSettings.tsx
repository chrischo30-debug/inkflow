"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";

const accountSchema = z.object({
  name: z.string().min(2, "Artist name must be at least 2 characters"),
  slug: z
    .string()
    .min(2, "Public URL is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only"),
  studio_name: z.string().optional(),
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
  };
}) {
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);

  const form = useForm<AccountSettingsValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: initialValues.name,
      slug: initialValues.slug,
      studio_name: initialValues.studio_name,
    },
  });

  const slug = form.watch("slug");
  const bookingUrl = `${origin}/${slug}/book`;

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
                  <Input
                    {...field}
                    className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-6 focus-visible:ring-0 focus-visible:border-primary shadow-none transition-colors"
                  />
                </FormControl>
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
            className="w-full py-6 text-base font-medium rounded-2xl bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-sm hover:opacity-90 transition-opacity"
          >
            Save Account Settings
          </Button>
        </form>
      </Form>
    </div>
  );
}
