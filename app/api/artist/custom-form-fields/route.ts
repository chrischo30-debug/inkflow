import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { normalizeCustomFormFields } from "@/lib/form-fields";

const customFieldSchema = z.object({
  id: z.string().uuid().optional(),
  field_key: z.string().min(2).regex(/^[a-z0-9_]+$/),
  label: z.string().min(1),
  type: z.enum(["text", "textarea", "number", "select", "checkbox", "date", "url", "file_or_link"]),
  enabled: z.boolean(),
  required: z.boolean(),
  sort_order: z.number().int().nonnegative(),
  placeholder: z.string().optional(),
  description: z.string().optional(),
  options: z.array(z.string()).optional(),
});

const payloadSchema = z.object({
  fields: z.array(customFieldSchema),
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
      .from("custom_form_fields")
      .select("id, field_key, label, type, enabled, required, sort_order, placeholder, description, options")
      .eq("artist_id", user.id)
      .order("sort_order", { ascending: true });

    const fields = normalizeCustomFormFields(data ?? []);
    return NextResponse.json({ fields });
  } catch (error: unknown) {
    console.error("Custom form fields GET error:", error);
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
    const normalized = normalizeCustomFormFields(parsed.fields);

    const rows = normalized.map((field) => ({
      artist_id: user.id,
      field_key: field.field_key,
      label: field.label,
      type: field.type,
      enabled: field.enabled,
      required: field.enabled ? field.required : false,
      sort_order: field.sort_order,
      placeholder: field.placeholder || null,
      description: field.description || null,
      options: field.type === "select" ? (field.options ?? []) : [],
    }));

    const { error: upsertError } = await supabase
      .from("custom_form_fields")
      .upsert(rows, { onConflict: "artist_id,field_key" });

    if (upsertError) {
      const message = upsertError.message || "Failed to save custom form fields.";
      const details = `${upsertError.details ?? ""} ${upsertError.hint ?? ""}`.toLowerCase();
      const typeConstraintHit =
        message.toLowerCase().includes("custom_form_fields_type_check") ||
        message.toLowerCase().includes("type") ||
        details.includes("custom_form_fields_type_check");
      if (typeConstraintHit) {
        return NextResponse.json(
          {
            error:
              "Your database is missing the latest custom-field type migration. Run `supabase/migrations/20260419_custom_form_fields_file_or_link.sql` and try again.",
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { data: existingRows } = await supabase
      .from("custom_form_fields")
      .select("field_key")
      .eq("artist_id", user.id);
    const keepKeys = new Set(rows.map((row) => row.field_key));
    const deleteKeys = (existingRows ?? [])
      .map((row) => row.field_key as string)
      .filter((key) => !keepKeys.has(key));

    if (deleteKeys.length > 0) {
      const { error: deleteError } = await supabase
        .from("custom_form_fields")
        .delete()
        .eq("artist_id", user.id)
        .in("field_key", deleteKeys);
      if (deleteError) {
        return NextResponse.json({ error: deleteError.message || "Failed to delete old custom fields." }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true, fields: rows });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid custom field config", details: error.flatten() }, { status: 400 });
    }
    console.error("Custom form fields PUT error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
