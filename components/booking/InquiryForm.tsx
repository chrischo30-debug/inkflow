"use client";

import { useTransition, useState } from "react";
import { useForm } from "react-hook-form";
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
      .refine((value) => !value || !Number.isNaN(Number(value)), "Budget must be a number")
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
}: {
  artistId: string;
  formFields: FormFieldConfig[];
  customFormFields: CustomFormFieldConfig[];
}) {
  const [isPending, startTransition] = useTransition();
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
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
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      client_name: "",
      client_email: "",
      client_phone: "",
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
      setErrorMsg(error instanceof Error ? error.message : "Failed to upload files.");
    } finally {
      if (customKey) {
        setUploadingCustomField((prev) => (prev === customKey ? null : prev));
      } else {
        setUploadingReference(false);
      }
    }
  };

  async function onSubmit(data: InquiryFormValues) {
    setErrorMsg("");
    const manualReferenceUrls = parseUrlList(data.reference_urls || "");
    const allReferenceUrls = mergeUniqueUrls(manualReferenceUrls, referenceUploads);
    if (isRequired("reference_images") && allReferenceUrls.length === 0) {
      setErrorMsg("Reference Images is required.");
      return;
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
        if (!hasValue) {
          setErrorMsg(`${field.label} is required.`);
          return;
        }
      }
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

        setIsSuccess(true);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : "An unexpected error occurred.");
      }
    });
  }

  if (isSuccess) {
    return (
      <div className="p-8 text-center space-y-4 border border-border rounded-md bg-card">
        <h3 className="text-xl font-heading font-semibold text-primary">Inquiry Sent!</h3>
        <p className="text-muted-foreground text-sm">
          Thank you for reaching out. The artist will review your request and get back to you shortly.
        </p>
      </div>
    );
  }

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
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
        );
      }
      if (inputType === "number") {
        return <Input type="number" min="0" step="1" placeholder={placeholder || "0"} {...field} />;
      }
      if (inputType === "date") {
        return <Input type="date" {...field} />;
      }
      if (inputType === "url") {
        return <Input type="url" placeholder={placeholder || "https://"} {...field} />;
      }
      if (inputType === "checkbox") {
        return (
          <label className="inline-flex items-center gap-3 text-sm text-on-surface">
            <input
              type="checkbox"
              checked={field.value === "true"}
              onChange={(e) => field.onChange(e.target.checked ? "true" : "")}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref as (instance: HTMLInputElement | null) => void}
            />
            {placeholder || "Check if true"}
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
                <FormLabel>{label} {isRequired("name") ? "*" : "(Optional)"}</FormLabel>
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
                <FormLabel>{label} {isRequired("email") ? "*" : "(Optional)"}</FormLabel>
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
                <FormLabel>{label} {isRequired("phone") ? "*" : "(Optional)"}</FormLabel>
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
                <FormLabel>{label} {isRequired("description") ? "*" : "(Optional)"}</FormLabel>
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
                <FormLabel>{label} {isRequired("size") ? "*" : "(Optional)"}</FormLabel>
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
                <FormLabel>{label} {isRequired("placement") ? "*" : "(Optional)"}</FormLabel>
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
                <FormLabel>{label} {isRequired("budget") ? "*" : "(Optional)"}</FormLabel>
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
                <FormLabel>{label} {isRequired("reference_images") ? "*" : "(Optional)"}</FormLabel>
                <FormControl>
                  {inputType === "file_or_link" ? (
                    <div className="space-y-3">
                      <Textarea
                        placeholder={placeholder || "Paste image links, one per line"}
                        className="min-h-[100px] resize-y"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref as (instance: HTMLTextAreaElement | null) => void}
                      />
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-on-surface">
                          Upload reference files
                          <Input
                            type="file"
                            multiple
                            accept="image/*"
                            className="mt-1"
                            onChange={(e) => {
                              uploadReferenceFiles(e.target.files);
                              e.currentTarget.value = "";
                            }}
                          />
                        </label>
                        {uploadingReference && (
                          <p className="text-xs text-on-surface-variant">Uploading files...</p>
                        )}
                        {referenceUploads.length > 0 && (
                          <ul className="space-y-1">
                            {referenceUploads.map((url) => (
                              <li key={url}>
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm text-primary underline break-all"
                                >
                                  {url}
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {errorMsg && (
          <div className="p-3 text-sm font-medium text-destructive-foreground bg-destructive/90 rounded-md">
            {errorMsg}
          </div>
        )}

        <div className="space-y-4">
          {orderedFields.map((item) => {
            if (item.kind === "base") {
              return <div key={`base-${item.key}`}>{renderBaseField(item.key)}</div>;
            }
            const field = item.field;
            return (
              <div key={field.field_key} className="space-y-2">
                <FormLabel>
                  <span className="font-semibold">
                    {field.label} {field.required ? "*" : "(Optional)"}
                  </span>
                </FormLabel>

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
                  <select
                    value={String(customAnswers[field.field_key] ?? "")}
                    onChange={(e) =>
                      setCustomAnswers((prev) => ({ ...prev, [field.field_key]: e.target.value }))
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select an option</option>
                    {(field.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}

                {field.type === "checkbox" && (
                  <label className="inline-flex items-center gap-2 text-sm text-on-surface-variant">
                    <input
                      type="checkbox"
                      checked={Boolean(customAnswers[field.field_key])}
                      onChange={(e) =>
                        setCustomAnswers((prev) => ({ ...prev, [field.field_key]: e.target.checked }))
                      }
                    />
                    {field.placeholder || "Yes"}
                  </label>
                )}

                {field.type === "file_or_link" && (
                  <div className="space-y-3">
                    <Textarea
                      value={String(customAnswers[field.field_key] ?? "")}
                      placeholder={field.placeholder || "Paste links, one per line"}
                      className="min-h-[100px] resize-y"
                      onChange={(e) =>
                        setCustomAnswers((prev) => ({ ...prev, [field.field_key]: e.target.value }))
                      }
                    />
                    <label className="text-sm font-medium text-on-surface">
                      Upload files
                      <Input
                        type="file"
                        multiple
                        accept="image/*"
                        className="mt-1"
                        onChange={(e) => {
                          uploadReferenceFiles(e.target.files, field.field_key);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                    {uploadingCustomField === field.field_key && (
                      <p className="text-xs text-on-surface-variant">Uploading files...</p>
                    )}
                    {(customUploads[field.field_key] ?? []).length > 0 && (
                      <ul className="space-y-1">
                        {(customUploads[field.field_key] ?? []).map((url) => (
                          <li key={`${field.field_key}-${url}`}>
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-primary underline break-all"
                            >
                              {url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Button type="submit" className="w-full font-semibold" disabled={isPending}>
          {isPending ? "Submitting..." : "Submit Inquiry"}
        </Button>
      </form>
    </Form>
  );
}
