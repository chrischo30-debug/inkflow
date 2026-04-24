import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { DEFAULT_FORM_FIELDS, normalizeFormFields } from "@/lib/form-fields";

const formFieldSchema = z.object({
  field_key: z.enum(["name", "email", "phone", "description", "size", "placement", "reference_images", "budget"]),
  label: z.string().min(1),
  enabled: z.boolean(),
  required: z.boolean(),
  sort_order: z.number().int().nonnegative(),
  placeholder: z.string().optional(),
  description: z.string().optional(),
  input_type: z.enum(["text", "textarea", "number", "select", "checkbox", "date", "url", "file_or_link"]),
  options: z.array(z.string()).optional(),
});

const payloadSchema = z.object({
  fields: z.array(formFieldSchema).min(1),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data } = await supabase
      .from("form_fields")
      .select("field_key, label, enabled, required, sort_order, placeholder, description, input_type, options")
      .eq("artist_id", user.id)
      .order("sort_order", { ascending: true });

    return NextResponse.json({ fields: normalizeFormFields(data ?? DEFAULT_FORM_FIELDS) });
  } catch (error: unknown) {
    console.error("Form fields GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = payloadSchema.parse(body);
    const normalized = normalizeFormFields(parsed.fields).map((field) => {
      if (field.field_key === "email") {
        return {
          artist_id: user.id,
          field_key: field.field_key,
          label: field.label,
          enabled: true,
          required: true,
          sort_order: field.sort_order,
          placeholder: null,
          description: field.description || null,
          input_type: "text",
          options: [],
        };
      }
      if (field.field_key === "phone") {
        return {
          artist_id: user.id,
          field_key: field.field_key,
          label: field.label,
          enabled: field.enabled,
          required: field.enabled ? field.required : false,
          sort_order: field.sort_order,
          placeholder: null,
          description: field.description || null,
          input_type: "text",
          options: [],
        };
      }

      if (field.field_key !== "reference_images" && field.input_type === "file_or_link") {
        return {
          artist_id: user.id,
          field_key: field.field_key,
          label: field.label,
          enabled: field.enabled,
          required: field.enabled ? field.required : false,
          sort_order: field.sort_order,
          placeholder: field.placeholder || null,
          description: field.description || null,
          input_type: "text",
          options: [],
        };
      }

      return {
        artist_id: user.id,
        field_key: field.field_key,
        label: field.label,
        enabled: field.enabled,
        required: field.enabled ? field.required : false,
        sort_order: field.sort_order,
        placeholder: field.placeholder || null,
        description: field.description || null,
        input_type: field.input_type,
        options: field.input_type === "select" ? (field.options ?? []) : [],
      };
    });

    const { error } = await supabase
      .from("form_fields")
      .upsert(normalized, { onConflict: "artist_id,field_key" });

    if (error) {
      const message = error.message || "Failed to save form fields.";
      const details = `${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
      const inputTypeConstraintHit =
        message.toLowerCase().includes("form_fields_input_type_check") ||
        message.toLowerCase().includes("input_type") ||
        details.includes("form_fields_input_type_check");
      if (inputTypeConstraintHit) {
        return NextResponse.json(
          {
            error:
              "Your database is missing the latest form-field type migration. Run `supabase/migrations/20260419_form_fields_input_type_extended.sql` and try again.",
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ success: true, fields: normalized });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid form field config", details: error.flatten() }, { status: 400 });
    }
    console.error("Form fields PUT error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
