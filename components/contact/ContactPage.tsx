"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const PHONE_REGEX = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;

interface ContactPageProps {
  artistSlug: string;
  artistName: string;
  logoUrl: string | null;
  header: string;
  subtext: string;
  buttonText: string;
  confirmationMessage: string;
  phoneEnabled: boolean;
  phoneRequired: boolean;
}

function makeSchema(phoneEnabled: boolean, phoneRequired: boolean) {
  return z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Please enter a valid email address"),
    phone: phoneEnabled && phoneRequired
      ? z.string().min(1, "Phone number is required").refine(v => PHONE_REGEX.test(v.trim()), "Please enter a valid phone number")
      : phoneEnabled
        ? z.string().optional().refine(v => !v || PHONE_REGEX.test(v.trim()), "Please enter a valid phone number")
        : z.string().optional(),
    message: z.string().min(1, "Message is required"),
  });
}

type FormValues = z.infer<ReturnType<typeof makeSchema>>;

const fieldCls = "w-full px-3 py-3 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 transition-colors";
const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";

export function ContactPage({
  artistSlug,
  artistName,
  logoUrl,
  header,
  subtext,
  buttonText,
  confirmationMessage,
  phoneEnabled,
  phoneRequired,
}: ContactPageProps) {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = makeSchema(phoneEnabled, phoneRequired);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const res = await fetch(`/api/contact/${artistSlug}`, {
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

  const displayHeader = header || "Get in touch";
  const displaySubtext = subtext || "Fill out the form and I'll get back to you soon.";
  const displayButton = buttonText || "Send Message";
  const displayConfirmation = confirmationMessage || "Thanks for reaching out! I'll be in touch soon.";

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-white">
      <div className="w-full max-w-lg">
        {/* Logo + header */}
        <div className="mb-10">
          {logoUrl && (
            <img
              src={logoUrl}
              alt={artistName}
              className="h-16 w-auto object-contain mb-8"
            />
          )}
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-2 leading-tight">
            {displayHeader}
          </h1>
          <p className="text-gray-500 text-base leading-relaxed mt-2">{displaySubtext}</p>
        </div>

        {submitted ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-900 font-medium">{displayConfirmation}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Name */}
            <div>
              <label className={labelCls}>
                Name {<span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                {...register("name")}
                className={fieldCls}
              />
              {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
            </div>

            {/* Email */}
            <div>
              <label className={labelCls}>
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                {...register("email")}
                className={fieldCls}
              />
              {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
            </div>

            {/* Phone */}
            {phoneEnabled && (
              <div>
                <label className={labelCls}>
                  Phone Number {phoneRequired && <span className="text-red-500">*</span>}
                  {!phoneRequired && <span className="text-gray-400 font-normal"> (optional)</span>}
                </label>
                <input
                  type="tel"
                  {...register("phone")}
                  className={fieldCls}
                />
                {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone.message}</p>}
              </div>
            )}

            {/* Message */}
            <div>
              <label className={labelCls}>
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                {...register("message")}
                rows={5}
                className={`${fieldCls} resize-none`}
              />
              {errors.message && <p className="text-xs text-red-600 mt-1">{errors.message.message}</p>}
            </div>

            {serverError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{serverError}</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 text-sm font-medium rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Sending…" : displayButton}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
