import { NextResponse } from "next/server";
import { BookingState } from "@/lib/types";
import { z, ZodError } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCustomFormFields, normalizeFormFields } from "@/lib/form-fields";

const createBookingSchema = z.object({
  artist_id: z.string().min(1),
  client_name: z.string().optional(),
  client_email: z.string().optional(),
  client_phone: z.string().optional(),
  description: z.string().optional(),
  size: z.string().optional(),
  placement: z.string().optional(),
  budget: z.union([z.number().nonnegative(), z.string()]).optional(),
  reference_urls: z.array(z.string().url()).default([]),
  custom_answers: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string().url()), z.null()]))
    .optional(),
});

const PHONE_REGEX = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;

export async function POST(req: Request) {
  try {
    const admin = createAdminClient();
    const body = await req.json();
    const parsed = createBookingSchema.parse(body);
    const { data: rawFields } = await admin
      .from("form_fields")
      .select("field_key, enabled, required, sort_order")
      .eq("artist_id", parsed.artist_id)
      .order("sort_order", { ascending: true });
    const formFields = normalizeFormFields(rawFields ?? []);
    const config = new Map(formFields.map((f) => [f.field_key, f]));
    const { data: rawCustomFields } = await admin
      .from("custom_form_fields")
      .select("field_key, label, type, enabled, required, options")
      .eq("artist_id", parsed.artist_id);
    const customFields = normalizeCustomFormFields(rawCustomFields ?? []).filter((field) => field.enabled);
    const customAnswers = parsed.custom_answers ?? {};

    const ensureRequired = (field: "name" | "email" | "phone" | "description" | "size" | "placement" | "reference_images" | "budget", value: unknown) => {
      const fieldCfg = config.get(field);
      if (fieldCfg?.enabled && fieldCfg.required) {
        const hasValue =
          typeof value === "number" ? true : typeof value === "string" ? value.trim().length > 0 : Array.isArray(value) ? value.length > 0 : Boolean(value);
        if (!hasValue) {
          throw new ZodError([
            {
              code: "custom",
              message: `${field} is required`,
              path: [field],
            },
          ]);
        }
      }
    };

    ensureRequired("name", parsed.client_name);
    ensureRequired("email", parsed.client_email);
    ensureRequired("phone", parsed.client_phone);
    ensureRequired("description", parsed.description);
    ensureRequired("size", parsed.size);
    ensureRequired("placement", parsed.placement);
    ensureRequired("reference_images", parsed.reference_urls);
    ensureRequired("budget", parsed.budget);

    for (const field of customFields) {
      const value = customAnswers[field.field_key];
      if (field.required) {
        const hasValue =
          field.type === "file_or_link"
            ? Array.isArray(value)
              ? value.length > 0
              : Boolean(String(value ?? "").trim())
            : typeof value === "boolean"
              ? value
              : typeof value === "number"
                ? !Number.isNaN(value)
                : Boolean(String(value ?? "").trim());
        if (!hasValue) {
          throw new ZodError([
            {
              code: "custom",
              message: `${field.label} is required`,
              path: ["custom_answers", field.field_key],
            },
          ]);
        }
      }

      if (value !== undefined && value !== null) {
        if (field.type === "number" && !(typeof value === "number" || (typeof value === "string" && value.trim() === ""))) {
          throw new ZodError([{ code: "custom", message: `${field.label} must be a number`, path: ["custom_answers", field.field_key] }]);
        }
        if (field.type === "checkbox" && typeof value !== "boolean") {
          throw new ZodError([{ code: "custom", message: `${field.label} must be true or false`, path: ["custom_answers", field.field_key] }]);
        }
        if (
          (field.type === "text" ||
            field.type === "textarea" ||
            field.type === "date" ||
            field.type === "select" ||
            field.type === "url") &&
          typeof value !== "string"
        ) {
          throw new ZodError([{ code: "custom", message: `${field.label} has invalid value`, path: ["custom_answers", field.field_key] }]);
        }
        if (field.type === "file_or_link") {
          if (Array.isArray(value)) {
            for (const url of value) {
              z.string().url().parse(url);
            }
          } else if (typeof value === "string" && value.trim()) {
            z.string().url().parse(value);
          } else if (typeof value !== "string" && !Array.isArray(value)) {
            throw new ZodError([{ code: "custom", message: `${field.label} has invalid files or links`, path: ["custom_answers", field.field_key] }]);
          }
        }
        if (field.type === "url" && typeof value === "string" && value.trim()) {
          z.string().url().parse(value);
        }
        if (field.type === "select" && typeof value === "string" && value.trim()) {
          const opts = field.options ?? [];
          if (!opts.includes(value)) {
            throw new ZodError([{ code: "custom", message: `${field.label} option is invalid`, path: ["custom_answers", field.field_key] }]);
          }
        }
      }
    }

    const clientName = parsed.client_name?.trim() ?? "";
    const clientEmail = parsed.client_email?.trim() ?? "";
    const description = parsed.description?.trim() ?? "";
    const safeName = clientName || "Client";
    const safeEmail = clientEmail || "no-email-provided@example.com";
    if (clientEmail) {
      z.string().email().parse(clientEmail);
    }
    if (parsed.client_phone?.trim()) {
      if (!PHONE_REGEX.test(parsed.client_phone.trim())) {
        throw new ZodError([{ code: "custom", message: "Phone number is invalid", path: ["client_phone"] }]);
      }
    }

    const parsedBudget =
      typeof parsed.budget === "number"
        ? parsed.budget
        : typeof parsed.budget === "string" && parsed.budget.trim() !== "" && !Number.isNaN(Number(parsed.budget))
          ? Number(parsed.budget)
          : null;

    const { data, error } = await admin
      .from("bookings")
      .insert({
        artist_id: parsed.artist_id,
        client_name: safeName,
        client_email: safeEmail,
        client_phone: parsed.client_phone || null,
        description,
        size: parsed.size || null,
        placement: parsed.placement || null,
        budget: parsedBudget,
        reference_urls: parsed.reference_urls,
        custom_answers: customAnswers,
        state: "inquiry" as BookingState,
      })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    // TODO: Send automated confirmation email via lib/email.ts if configured

    return NextResponse.json({ success: true, bookingId: data.id }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid form data", details: error.flatten() }, { status: 400 });
    }
    console.error("Booking API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
