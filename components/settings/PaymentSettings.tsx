"use client";

import { useForm } from "react-hook-form";
import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const paymentSchema = z.object({
  Stripe: z.string().url({ message: "Must be a valid URL" }).or(z.literal("")),
  Venmo: z.string().url({ message: "Must be a valid URL" }).or(z.literal("")),
  CashApp: z.string().url({ message: "Must be a valid URL" }).or(z.literal("")),
  Squarespace: z.string().url({ message: "Must be a valid URL" }).or(z.literal("")),
  Other: z.string().url({ message: "Must be a valid URL" }).or(z.literal("")),
});

export function PaymentSettings({ initialLinks }: { initialLinks?: Record<string, string> }) {
  const [saveMessage, setSaveMessage] = useState("");
  const form = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      Stripe: initialLinks?.Stripe || "",
      Venmo: initialLinks?.Venmo || "",
      CashApp: initialLinks?.CashApp || "",
      Squarespace: initialLinks?.Squarespace || "",
      Other: initialLinks?.Other || "",
    },
  });

  const onSubmit = async (data: z.infer<typeof paymentSchema>) => {
    setSaveMessage("");
    const res = await fetch("/api/artist/payment-links", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      setSaveMessage("Failed to save payment links.");
      return;
    }

    setSaveMessage("Payment links saved.");
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-8 shadow-sm">
      <h3 className="text-lg font-heading font-semibold mb-2 text-on-surface">Payment Settings</h3>
      <p className="text-sm text-on-surface-variant mb-8 max-w-md leading-relaxed">
        This link will be automatically sent to clients when you transition their inquiry to <strong className="text-on-surface">Deposit Sent</strong>.
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
          {(["Stripe", "Venmo", "CashApp", "Squarespace", "Other"] as const).map((provider) => (
            <FormField
              key={provider}
              control={form.control}
              name={provider}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-sans tracking-wide text-on-surface-variant">
                    {provider} Link
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={`https://${provider.toLowerCase()}.com/...`}
                      className="border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-t-lg rounded-b-none px-4 py-6 focus-visible:ring-0 focus-visible:border-primary shadow-none transition-colors"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
          {saveMessage && <p className="text-sm text-on-surface-variant">{saveMessage}</p>}
          <Button
            type="submit"
            className="w-full h-auto py-3 text-sm font-medium rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-sm hover:opacity-90 transition-opacity"
          >
            Save Changes
          </Button>
        </form>
      </Form>
    </div>
  );
}
