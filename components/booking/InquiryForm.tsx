"use client";

import { useTransition, useState } from "react";
import { useForm, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CustomFormFieldConfig, FormFieldConfig, FormFieldKey } from "@/lib/form-fields";

const labelMap: Record<FormFieldKey, string> = {
  name: "Full Name",
  email: "Email Address",
  phone: "Phone Number",
  description: "Tattoo Idea / Description",
  size: "Size",
  placement: "Placement",
  reference_images: "Reference Images",
  budget: "Budget",
};

function makeFieldSchema(required: boolean, key: FormFieldKey, cfg?: FormFieldConfig) {
  if (key === "email") {
    return required
      ? z.string().email("Please enter a valid email address")
      : z.union([z.literal(""), z.string().email("Please enter a valid email address")]).optional();
  }
  if (key === "phone") {
    return required
      ? z
          .string()
          .min(1, "Phone Number is required")
          .refine((value) => PHONE_REGEX.test(value.trim()), "Please enter a valid phone number")
      : z
          .string()
          .optional()
          .refine((value) => !value || PHONE_REGEX.test(value.trim()), "Please enter a valid phone number");
  }
  if (key === "budget" && cfg?.input_type === "number") {
    return z
      .string()
      .optional()
      .refine((value) => !value || (/^\d+$/.test(value.trim()) && Number(value) >= 0), "Budget must be a whole dollar amount")
      .refine((value) => !required || Boolean(value && value.trim()), "Budget is required");
  }
  if (key === "reference_images" && cfg?.input_type === "file_or_link") {
    return z.string().optional();
  }
  if (key === "description") {
    return required
      ? z.string().min(10, "Please provide more details about your idea")
      : z.string().optional();
  }
  return required
    ? z.string().min(1, `${labelMap[key]} is required`)
    : z.string().optional();
}

function buildInquirySchema(formFields: FormFieldConfig[]) {
  const byKey = new Map<FormFieldKey, FormFieldConfig>();
  for (const field of formFields) byKey.set(field.field_key, field);

  const nameField = byKey.get("name");
  const emailField = byKey.get("email");
  const phoneField = byKey.get("phone");
  const descriptionField = byKey.get("description");
  const sizeField = byKey.get("size");
  const placementField = byKey.get("placement");
  const refField = byKey.get("reference_images");
  const budgetField = byKey.get("budget");

  return z.object({
    client_name: makeFieldSchema(Boolean(nameField?.required), "name", nameField),
    client_email: makeFieldSchema(Boolean(emailField?.required), "email", emailField),
    client_phone: makeFieldSchema(Boolean(phoneField?.required), "phone", phoneField),
    description: makeFieldSchema(Boolean(descriptionField?.required), "description", descriptionField),
    size: makeFieldSchema(Boolean(sizeField?.required), "size", sizeField),
    placement: makeFieldSchema(Boolean(placementField?.required), "placement", placementField),
    budget: makeFieldSchema(Boolean(budgetField?.required), "budget", budgetField),
    reference_urls: makeFieldSchema(Boolean(refField?.required), "reference_images", refField),
  });
}

type InquiryFormValues = {
  client_name: string;
  client_email: string;
  client_phone: string;
  description: string;
  size: string;
  placement: string;
  budget: string;
  reference_urls: string;
};

type CustomAnswerValue = string | number | boolean | string[];

const PHONE_REGEX = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;

function parseUrlList(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((url) => url.trim())
    .filter(Boolean)
    .filter((url) => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    });
}

function mergeUniqueUrls(...lists: string[][]): string[] {
  return [...new Set(lists.flat().map((url) => url.trim()).filter(Boolean))];
}

export function InquiryForm({
  artistId,
  formFields,
  customFormFields,
  buttonText = "Submit",
  confirmationMessage,
  successRedirectUrl,
  prefill,
}: {
  artistId: string;
  formFields: FormFieldConfig[];
  customFormFields: CustomFormFieldConfig[];
  buttonText?: string;
  confirmationMessage?: string;
  successRedirectUrl?: string;
  prefill?: { name?: string; email?: string; phone?: string };
}) {
  const [isPending, startTransition] = useTransition();
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsgs, setErrorMsgs] = useState<string[]>([]);
  const [customAnswers, setCustomAnswers] = useState<Record<string, CustomAnswerValue>>({});
  const [referenceUploads, setReferenceUploads] = useState<string[]>([]);
  const [customUploads, setCustomUploads] = useState<Record<string, string[]>>({});
  const [uploadingReference, setUploadingReference] = useState(false);
  const [uploadingCustomField, setUploadingCustomField] = useState<string | null>(null);
  const baseFieldMap = new Map(formFields.map((field) => [field.field_key, field]));
  const isRequired = (key: FormFieldKey) => formFields.some((f) => f.field_key === key && f.enabled && f.required);
  const enabledCustomFields = customFormFields.filter((field) => field.enabled);
  const enabledBaseFields = formFields.filter((field) => field.enabled).sort((a, b) => a.sort_order - b.sort_order);
  const orderedFields = [
    ...enabledBaseFields.map((field) => ({ kind: "base" as const, sort_order: field.sort_order, key: field.field_key })),
    ...enabledCustomFields.map((field) => ({ kind: "custom" as const, sort_order: field.sort_order, field })),
  ].sort((a, b) => a.sort_order - b.sort_order);
  const inquirySchema = buildInquirySchema(formFields);

  const form = useForm<InquiryFormValues>({
    resolver: zodResolver(inquirySchema) as Resolver<InquiryFormValues>,
    defaultValues: {
      client_name: prefill?.name ?? "",
      client_email: prefill?.email ?? "",
      client_phone: prefill?.phone ?? "",
      description: "",
      size: "",
      placement: "",
      budget: "",
      reference_urls: "",
    },
  });

  const uploadReferenceFiles = async (files: FileList | null, customKey?: string) => {
    if (!files || files.length === 0) return;

    if (customKey) {
      setUploadingCustomField(customKey);
    } else {
      setUploadingReference(true);
    }

    try {
      const formData = new FormData();
      formData.append("artist_id", artistId);
      Array.from(files).forEach((file) => formData.append("files", file));

      const res = await fetch("/api/uploads/reference-images", {
        method: "POST",
        body: formData,
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Failed to upload reference images.");
      }

      const uploadedUrls = Array.isArray(body.urls) ? body.urls : [];
      if (customKey) {
        setCustomUploads((prev) => ({
          ...prev,
          [customKey]: mergeUniqueUrls(prev[customKey] ?? [], uploadedUrls),
        }));
      } else {
        setReferenceUploads((prev) => mergeUniqueUrls(prev, uploadedUrls));
      }
    } catch (error: unknown) {
      setErrorMsgs([error instanceof Error ? error.message : "Failed to upload files."]);
    } finally {
      if (customKey) {
        setUploadingCustomField((prev) => (prev === customKey ? null : prev));
      } else {
        setUploadingReference(false);
      }
    }
  };

  async function onSubmit(data: InquiryFormValues) {
    setErrorMsgs([]);
    const manualReferenceUrls = parseUrlList(data.reference_urls || "");
    const allReferenceUrls = mergeUniqueUrls(manualReferenceUrls, referenceUploads);

    const validationErrors: string[] = [];
    if (isRequired("reference_images") && allReferenceUrls.length === 0) {
      validationErrors.push("Reference Images is required.");
    }
    for (const field of enabledCustomFields) {
      const value = customAnswers[field.field_key];
      const customFileLinks =
        field.type === "file_or_link"
          ? mergeUniqueUrls(
              typeof value === "string" ? parseUrlList(value) : [],
              customUploads[field.field_key] ?? []
            )
          : [];
      if (field.required) {
        const hasValue =
          field.type === "file_or_link"
            ? customFileLinks.length > 0
            : typeof value === "boolean"
              ? value
              : typeof value === "number"
                ? !Number.isNaN(value)
                : Boolean(String(value ?? "").trim());
        if (!hasValue) validationErrors.push(`${field.label} is required.`);
      }
    }
    if (validationErrors.length > 0) {
      setErrorMsgs(validationErrors);
      return;
    }

    startTransition(async () => {
      try {
        const customPayload: Record<string, CustomAnswerValue> = { ...customAnswers };
        for (const field of enabledCustomFields) {
          if (field.type !== "file_or_link") continue;
          const currentValue = customAnswers[field.field_key];
          customPayload[field.field_key] = mergeUniqueUrls(
            typeof currentValue === "string" ? parseUrlList(currentValue) : [],
            customUploads[field.field_key] ?? []
          );
        }

        const res = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            artist_id: artistId,
            client_name: data.client_name,
            client_email: data.client_email,
            client_phone: data.client_phone || undefined,
            description: data.description,
            size: data.size || undefined,
            placement: data.placement || undefined,
            budget: data.budget || undefined,
            reference_urls: allReferenceUrls,
            custom_answers: customPayload,
          }),
        });

        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error || "Failed to submit inquiry");
        }

        if (successRedirectUrl) {
          window.location.href = successRedirectUrl;
        } else {
          setIsSuccess(true);
        }
      } catch (err: unknown) {
        setErrorMsgs([err instanceof Error ? err.message : "An unexpected error occurred."]);
      }
    });
  }

  if (isSuccess) {
    return (
      <div className="py-14 text-center space-y-3">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: `color-mix(in srgb, var(--primary) 12%, transparent)` }}>
          <svg className="w-7 h-7" style={{ color: 'var(--primary)' }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="font-semibold text-lg mt-2" style={{ color: 'var(--primary)' }}>You're all set!</p>
        <p className="text-sm" style={{ color: 'inherit', opacity: 0.6 }}>
          {confirmationMessage || "Thanks for reaching out! I'll review your request and get back to you shortly."}
        </p>
      </div>
    );
  }

  // Shared upload zone
  const UploadZone = ({ uploading, onFiles, id }: { uploading: boolean; onFiles: (files: FileList | null) => void; id: string }) => (
    <label htmlFor={id} className="block cursor-pointer">
      <input id={id} type="file" multiple accept="image/*" className="sr-only" disabled={uploading}
        onChange={(e) => { onFiles(e.target.files); e.currentTarget.value = ''; }} />
      <div style={{ border: '1.5px dashed rgba(0,0,0,0.18)', borderRadius: 10, padding: '20px 16px', textAlign: 'center', transition: 'border-color 0.15s, background 0.15s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--primary)'; (e.currentTarget as HTMLDivElement).style.background = 'color-mix(in srgb, var(--primary) 4%, transparent)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,0,0,0.18)'; (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}>
        <svg className="w-5 h-5 mx-auto mb-2" style={{ color: 'var(--primary)', opacity: 0.7 }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <p className="text-sm" style={{ color: 'var(--primary)', opacity: 0.8, fontWeight: 500 }}>
          {uploading ? 'Uploading…' : 'Click to upload images'}
        </p>
      </div>
    </label>
  );

  // Uploaded URLs list
  const UploadedList = ({ urls, onRemove }: { urls: string[]; onRemove: (url: string) => void }) =>
    urls.length === 0 ? null : (
      <div className="space-y-1.5 mt-2">
        {urls.map((url) => (
          <div key={url} className="flex items-center gap-2 text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(0,0,0,0.04)' }}>
            <span className="truncate flex-1 opacity-70">{url.split('/').pop()}</span>
            <button type="button" onClick={() => onRemove(url)} style={{ color: '#999', lineHeight: 1 }} className="shrink-0 hover:text-red-500 transition-colors text-base leading-none">×</button>
          </div>
        ))}
      </div>
    );

  // Divider between upload and link textarea
  const OrDivider = () => (
    <div className="flex items-center gap-3 my-1">
      <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.1)' }} />
      <span className="text-xs" style={{ color: 'inherit', opacity: 0.4, fontWeight: 500 }}>or paste a link below</span>
      <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.1)' }} />
    </div>
  );

  const renderBaseField = (key: FormFieldKey) => {
    const cfg = baseFieldMap.get(key);
    const label = cfg?.label || labelMap[key];
    const placeholder = cfg?.placeholder || "";
    const inputType = cfg?.input_type || "text";
    const inputOptions = cfg?.options ?? [];

    const renderControl = (
      field: { value?: string; onChange: (...event: unknown[]) => void; onBlur: () => void; name: string; ref: (instance: unknown) => void }
    ) => {
      if (inputType === "textarea") {
        return (
          <Textarea
            placeholder={placeholder}
            className={key === "description" ? "min-h-[120px] resize-y" : "min-h-[90px] resize-y"}
            {...field}
          />
        );
      }
      if (inputType === "select") {
        return (
          <div className="bk-select-wrap">
            <select
              value={field.value ?? ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref as (instance: HTMLSelectElement | null) => void}
            >
              <option value="">Select an option</option>
              {inputOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        );
      }
      if (inputType === "number") {
        return (
          <div style={{ display: "flex", alignItems: "center", background: "#fff", border: "1.5px solid rgba(0,0,0,0.13)", borderRadius: 10, padding: "13px 16px", gap: 6 }}>
            <span style={{ color: "#111", fontWeight: 500, flexShrink: 0, lineHeight: 1 }}>$</span>
            <input type="number" min="0" step="1" placeholder={placeholder || "0"}
              style={{ border: "none", padding: 0, margin: 0, background: "transparent", outline: "none", width: "100%", color: "#111", fontWeight: 400, fontSize: "inherit" }}
              value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} name={field.name}
              ref={field.ref as (instance: HTMLInputElement | null) => void} />
          </div>
        );
      }
      if (inputType === "date") {
        return <Input type="date" {...field} />;
      }
      if (inputType === "url") {
        return <Input type="url" placeholder={placeholder || "https://"} {...field} />;
      }
      if (inputType === "checkbox") {
        return (
          <label className="inline-flex items-center gap-3 cursor-pointer" style={{ fontSize: 'inherit' }}>
            <span className="relative flex items-center justify-center w-5 h-5 rounded-md flex-shrink-0"
              style={{ border: '1.5px solid rgba(0,0,0,0.2)', background: 'white' }}>
              <input
                type="checkbox"
                checked={field.value === "true"}
                onChange={(e) => field.onChange(e.target.checked ? "true" : "")}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref as (instance: HTMLInputElement | null) => void}
                className="sr-only"
              />
              {field.value === "true" && <svg className="w-3 h-3" style={{ color: 'var(--primary)' }} fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
            </span>
            <span style={{ opacity: 0.8 }}>{placeholder || "Check if true"}</span>
          </label>
        );
      }
      return (
        <Input
          type={key === "email" ? "email" : key === "phone" ? "tel" : "text"}
          placeholder={placeholder}
          {...field}
        />
      );
    };

    switch (key) {
      case "name":
        return (
          <FormField
            key={key}
            control={form.control}
            name="client_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="bk-label">{label} {isRequired("name") ? <span style={{ color: 'var(--primary)' }}>*</span> : <span style={{ fontSize: '0.75em', opacity: 0.5, fontWeight: 400, marginLeft: 4 }}>optional</span>}</FormLabel>
                {cfg?.description && <p className="text-xs text-on-surface-variant -mt-1">{cfg.description}</p>}
                <FormControl>
                  {renderControl(field)}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      case "email":
        return (
          <FormField
            key={key}
            control={form.control}
            name="client_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="bk-label">{label} {isRequired("email") ? <span style={{ color: 'var(--primary)' }}>*</span> : <span style={{ fontSize: '0.75em', opacity: 0.5, fontWeight: 400, marginLeft: 4 }}>optional</span>}</FormLabel>
                {cfg?.description && <p className="text-xs text-on-surface-variant -mt-1">{cfg.description}</p>}
                <FormControl>
                  {renderControl(field)}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      case "phone":
        return (
          <FormField
            key={key}
            control={form.control}
            name="client_phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="bk-label">{label} {isRequired("phone") ? <span style={{ color: 'var(--primary)' }}>*</span> : <span style={{ fontSize: '0.75em', opacity: 0.5, fontWeight: 400, marginLeft: 4 }}>optional</span>}</FormLabel>
                {cfg?.description && <p className="text-xs text-on-surface-variant -mt-1">{cfg.description}</p>}
                <FormControl>
                  {renderControl(field)}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      case "description":
        return (
          <FormField
            key={key}
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="bk-label">{label} {isRequired("description") ? <span style={{ color: 'var(--primary)' }}>*</span> : <span style={{ fontSize: '0.75em', opacity: 0.5, fontWeight: 400, marginLeft: 4 }}>optional</span>}</FormLabel>
                {cfg?.description && <p className="text-xs text-on-surface-variant -mt-1">{cfg.description}</p>}
                <FormControl>
                  {renderControl(field)}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      case "size":
        return (
          <FormField
            key={key}
            control={form.control}
            name="size"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="bk-label">{label} {isRequired("size") ? <span style={{ color: 'var(--primary)' }}>*</span> : <span style={{ fontSize: '0.75em', opacity: 0.5, fontWeight: 400, marginLeft: 4 }}>optional</span>}</FormLabel>
                {cfg?.description && <p className="text-xs text-on-surface-variant -mt-1">{cfg.description}</p>}
                <FormControl>
                  {renderControl(field)}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      case "placement":
        return (
          <FormField
            key={key}
            control={form.control}
            name="placement"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="bk-label">{label} {isRequired("placement") ? <span style={{ color: 'var(--primary)' }}>*</span> : <span style={{ fontSize: '0.75em', opacity: 0.5, fontWeight: 400, marginLeft: 4 }}>optional</span>}</FormLabel>
                {cfg?.description && <p className="text-xs text-on-surface-variant -mt-1">{cfg.description}</p>}
                <FormControl>
                  {renderControl(field)}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      case "budget":
        return (
          <FormField
            key={key}
            control={form.control}
            name="budget"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="bk-label">{label} {isRequired("budget") ? <span style={{ color: 'var(--primary)' }}>*</span> : <span style={{ fontSize: '0.75em', opacity: 0.5, fontWeight: 400, marginLeft: 4 }}>optional</span>}</FormLabel>
                {cfg?.description && <p className="text-xs text-on-surface-variant -mt-1">{cfg.description}</p>}
                <FormControl>
                  {renderControl(field)}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      case "reference_images":
        return (
          <FormField
            key={key}
            control={form.control}
            name="reference_urls"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="bk-label">{label} {isRequired("reference_images") ? <span style={{ color: 'var(--primary)' }}>*</span> : <span style={{ fontSize: '0.75em', opacity: 0.5, fontWeight: 400, marginLeft: 4 }}>optional</span>}</FormLabel>
                {cfg?.description && <p className="text-xs text-on-surface-variant -mt-1">{cfg.description}</p>}
                <FormControl>
                  {inputType === "file_or_link" ? (
                    <div className="space-y-3">
                      <UploadZone
                        id="reference_images_upload"
                        uploading={uploadingReference}
                        onFiles={(files) => uploadReferenceFiles(files)}
                      />
                      <UploadedList
                        urls={referenceUploads}
                        onRemove={(url) => setReferenceUploads(prev => prev.filter(u => u !== url))}
                      />
                      <OrDivider />
                      <Textarea
                        placeholder={placeholder || "https://example.com/ref1.jpg\nhttps://example.com/ref2.jpg"}
                        className="min-h-[72px] resize-y text-xs"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref as (instance: HTMLTextAreaElement | null) => void}
                      />
                    </div>
                  ) : (
                    renderControl(field)
                  )}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {errorMsgs.length > 0 && (
          <div className="rounded-xl p-4 text-sm space-y-1" style={{ background: 'rgba(186,26,26,0.08)', border: '1px solid rgba(186,26,26,0.2)', color: '#ba1a1a' }}>
            {errorMsgs.map((msg, i) => <p key={i}>{msg}</p>)}
          </div>
        )}

        <div className="space-y-5">
          {orderedFields.map((item) => {
            if (item.kind === "base") {
              return <div key={`base-${item.key}`}>{renderBaseField(item.key)}</div>;
            }
            const field = item.field;
            return (
              <div key={field.field_key} className="space-y-2">
                <label className="bk-label">
                  {field.label} {field.required ? <span style={{ color: 'var(--primary)' }}>*</span> : <span style={{ fontSize: '0.75em', opacity: 0.5, fontWeight: 400, marginLeft: 4 }}>optional</span>}
                </label>
                {field.description && <p className="text-xs text-on-surface-variant -mt-1">{field.description}</p>}

                {field.type === "text" && (
                  <Input
                    value={String(customAnswers[field.field_key] ?? "")}
                    placeholder={field.placeholder || ""}
                    onChange={(e) =>
                      setCustomAnswers((prev) => ({ ...prev, [field.field_key]: e.target.value }))
                    }
                  />
                )}

                {field.type === "url" && (
                  <Input
                    type="url"
                    value={String(customAnswers[field.field_key] ?? "")}
                    placeholder={field.placeholder || "https://..."}
                    onChange={(e) =>
                      setCustomAnswers((prev) => ({ ...prev, [field.field_key]: e.target.value }))
                    }
                  />
                )}

                {field.type === "number" && (
                  <Input
                    type="number"
                    value={String(customAnswers[field.field_key] ?? "")}
                    placeholder={field.placeholder || ""}
                    onChange={(e) =>
                      setCustomAnswers((prev) => ({
                        ...prev,
                        [field.field_key]: e.target.value === "" ? "" : Number(e.target.value),
                      }))
                    }
                  />
                )}

                {field.type === "date" && (
                  <Input
                    type="date"
                    value={String(customAnswers[field.field_key] ?? "")}
                    onChange={(e) =>
                      setCustomAnswers((prev) => ({ ...prev, [field.field_key]: e.target.value }))
                    }
                  />
                )}

                {field.type === "textarea" && (
                  <Textarea
                    value={String(customAnswers[field.field_key] ?? "")}
                    placeholder={field.placeholder || ""}
                    className="min-h-[90px] resize-y"
                    onChange={(e) =>
                      setCustomAnswers((prev) => ({ ...prev, [field.field_key]: e.target.value }))
                    }
                  />
                )}

                {field.type === "select" && (
                  <div className="bk-select-wrap">
                    <select
                      value={String(customAnswers[field.field_key] ?? "")}
                      onChange={(e) =>
                        setCustomAnswers((prev) => ({ ...prev, [field.field_key]: e.target.value }))
                      }
                    >
                      <option value="">Select an option</option>
                      {(field.options ?? []).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {field.type === "checkbox" && (
                  <label className="inline-flex items-center gap-3 cursor-pointer" style={{ fontSize: 'inherit' }}>
                    <span className="relative flex items-center justify-center w-5 h-5 rounded-md flex-shrink-0"
                      style={{ border: '1.5px solid rgba(0,0,0,0.2)', background: 'white' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(customAnswers[field.field_key])}
                        onChange={(e) =>
                          setCustomAnswers((prev) => ({ ...prev, [field.field_key]: e.target.checked }))
                        }
                        className="sr-only"
                      />
                      {Boolean(customAnswers[field.field_key]) && <svg className="w-3 h-3" style={{ color: 'var(--primary)' }} fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                    </span>
                    <span style={{ opacity: 0.8 }}>{field.placeholder || "Yes"}</span>
                  </label>
                )}

                {field.type === "file_or_link" && (
                  <div className="space-y-3">
                    <UploadZone
                      id={`upload_${field.field_key}`}
                      uploading={uploadingCustomField === field.field_key}
                      onFiles={(files) => uploadReferenceFiles(files, field.field_key)}
                    />
                    <UploadedList
                      urls={customUploads[field.field_key] ?? []}
                      onRemove={(url) =>
                        setCustomUploads(prev => ({
                          ...prev,
                          [field.field_key]: (prev[field.field_key] ?? []).filter(u => u !== url),
                        }))
                      }
                    />
                    <OrDivider />
                    <Textarea
                      value={String(customAnswers[field.field_key] ?? '')}
                      placeholder={field.placeholder || 'https://example.com/image.jpg'}
                      className="min-h-[72px] resize-y text-xs"
                      onChange={(e) =>
                        setCustomAnswers((prev) => ({ ...prev, [field.field_key]: e.target.value }))
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button type="submit" disabled={isPending}>
          {isPending ? "Submitting…" : buttonText}
        </button>
      </form>
    </Form>
  );
}
