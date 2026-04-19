"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const accountSchema = z.object({
  name: z.string().min(2, "Artist name must be at least 2 characters"),
  slug: z
    .string()
    .min(2, "Public URL is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only"),
  studio_name: z.string().optional(),
  style_tags: z.string().optional(),
});

type AccountSettingsValues = z.infer<typeof accountSchema>;

export function AccountSettings({
  initialValues,
}: {
  initialValues: {
    name: string;
    slug: string;
    studio_name: string;
    style_tags: string;
    email: string;
  };
}) {
  const [saveMessage, setSaveMessage] = useState("");
  const form = useForm<AccountSettingsValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: initialValues.name,
      slug: initialValues.slug,
      studio_name: initialValues.studio_name,
      style_tags: initialValues.style_tags,
    },
  });

  const onSubmit = async (data: AccountSettingsValues) => {
    setSaveMessage("");
    const res = await fetch("/api/artist/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const body = await res.json();
    if (!res.ok) {
      setSaveMessage(body.error || "Failed to save settings.");
      return;
    }

    setSaveMessage("Account settings saved.");
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
                <FormLabel className="text-sm font-sans tracking-wide text-on-surface-variant">Public Booking URL</FormLabel>
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
            name="style_tags"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-sans tracking-wide text-on-surface-variant">Style Tags</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="blackwork, realism, fineline"
                    className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-6 focus-visible:ring-0 focus-visible:border-primary shadow-none transition-colors"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {saveMessage && <p className="text-sm text-on-surface-variant">{saveMessage}</p>}
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
