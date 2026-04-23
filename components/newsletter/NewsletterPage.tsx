"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const schema = z.object({
  first_name: z.string().optional(),
  email: z.string().email("Please enter a valid email address"),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  artistSlug: string;
  artistName: string;
  logoUrl: string | null;
  header: string;
  subtext: string;
  buttonText: string;
  confirmationMessage: string;
}

export function NewsletterPage({
  artistSlug,
  artistName,
  logoUrl,
  header,
  subtext,
  buttonText,
  confirmationMessage,
}: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const res = await fetch(`/api/newsletter/${artistSlug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setServerError(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setServerError("Something went wrong. Please try again.");
    }
  };

  const displayHeader = header || "Stay in the loop";
  const displaySubtext = subtext || `Subscribe to get updates from ${artistName}.`;
  const displayButton = buttonText || "Subscribe";
  const displayConfirmation = confirmationMessage || "You're subscribed! Check your inbox to confirm.";

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-white">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {logoUrl && (
            <img
              src={logoUrl}
              alt={artistName}
              className="w-16 h-16 object-contain rounded-xl mx-auto mb-4"
            />
          )}
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{displayHeader}</h1>
          {displaySubtext && (
            <p className="text-gray-600 text-sm leading-relaxed">{displaySubtext}</p>
          )}
        </div>

        {submitted ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-900 font-medium">{displayConfirmation}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="rounded-2xl border border-gray-200 p-6 space-y-4 bg-white shadow-sm">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-900">First name</label>
              <input
                type="text"
                {...register("first_name")}
                placeholder="Optional"
                className="w-full px-3 py-2.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 placeholder:text-gray-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-900">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                {...register("email")}
                placeholder="your@email.com"
                className="w-full px-3 py-2.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-gray-900 placeholder:text-gray-400"
              />
              {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
            </div>

            {serverError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{serverError}</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 text-sm font-medium rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Subscribing…" : displayButton}
            </button>

            <p className="text-xs text-gray-400 text-center">
              Powered by Kit. You can unsubscribe at any time.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
