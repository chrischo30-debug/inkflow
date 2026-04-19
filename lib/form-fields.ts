export type FormFieldKey =
  | "name"
  | "email"
  | "phone"
  | "description"
  | "size"
  | "placement"
  | "reference_images"
  | "budget";

export type BaseFieldInputType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "checkbox"
  | "date"
  | "url"
  | "file_or_link";

export interface FormFieldConfig {
  field_key: FormFieldKey;
  label: string;
  enabled: boolean;
  required: boolean;
  sort_order: number;
  placeholder?: string;
  input_type: BaseFieldInputType;
  options?: string[];
}

export type CustomFieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "checkbox"
  | "date"
  | "url"
  | "file_or_link";

export interface CustomFormFieldConfig {
  id?: string;
  field_key: string;
  label: string;
  type: CustomFieldType;
  enabled: boolean;
  required: boolean;
  sort_order: number;
  placeholder?: string;
  options?: string[];
}

export const DEFAULT_FORM_FIELDS: FormFieldConfig[] = [
  { field_key: "name", label: "Full Name", enabled: true, required: true, sort_order: 0, placeholder: "Jane Doe", input_type: "text", options: [] },
  { field_key: "email", label: "Email Address", enabled: true, required: true, sort_order: 1, placeholder: "jane@example.com", input_type: "text", options: [] },
  { field_key: "phone", label: "Phone Number", enabled: true, required: true, sort_order: 2, placeholder: "(555) 123-4567", input_type: "text", options: [] },
  { field_key: "description", label: "Tattoo Description", enabled: true, required: true, sort_order: 3, placeholder: "Describe placement, size, style, and details...", input_type: "textarea", options: [] },
  { field_key: "size", label: "Size", enabled: true, required: false, sort_order: 4, placeholder: "Palm-sized, half sleeve, etc.", input_type: "text", options: [] },
  { field_key: "placement", label: "Placement", enabled: true, required: false, sort_order: 5, placeholder: "Forearm, shoulder, back, etc.", input_type: "text", options: [] },
  { field_key: "reference_images", label: "Reference Images", enabled: true, required: false, sort_order: 6, placeholder: "Paste links or upload images", input_type: "file_or_link", options: [] },
  { field_key: "budget", label: "Budget", enabled: true, required: false, sort_order: 7, placeholder: "300", input_type: "number", options: [] },
];

export function normalizeFormFields(rows: Partial<FormFieldConfig>[] | null | undefined): FormFieldConfig[] {
  const byKey = new Map<FormFieldKey, FormFieldConfig>();
  for (const fallback of DEFAULT_FORM_FIELDS) {
    byKey.set(fallback.field_key, fallback);
  }

  for (const row of rows ?? []) {
    const key = row.field_key;
    if (!key || !byKey.has(key)) continue;
    const fallback = byKey.get(key)!;
    const isEmailField = key === "email";
    const isPhoneField = key === "phone";
    const isLockedContactField = isEmailField || isPhoneField;
    byKey.set(key, {
      field_key: key,
      label: typeof row.label === "string" && row.label.trim() ? row.label : fallback.label,
      enabled: isEmailField ? true : typeof row.enabled === "boolean" ? row.enabled : fallback.enabled,
      required: isEmailField ? true : typeof row.required === "boolean" ? row.required : fallback.required,
      sort_order: typeof row.sort_order === "number" ? row.sort_order : fallback.sort_order,
      placeholder:
        isLockedContactField
          ? fallback.placeholder
          : typeof row.placeholder === "string"
            ? row.placeholder
            : fallback.placeholder,
      input_type:
        isLockedContactField
          ? "text"
          : row.input_type === "text" ||
        row.input_type === "textarea" ||
        row.input_type === "number" ||
        row.input_type === "select" ||
        row.input_type === "checkbox" ||
        row.input_type === "date" ||
        row.input_type === "url" ||
        row.input_type === "file_or_link"
          ? row.input_type
          : fallback.input_type,
      options: Array.isArray(row.options)
        ? row.options.map((opt) => String(opt)).filter(Boolean)
        : fallback.options,
    });
  }

  return [...byKey.values()].sort((a, b) => a.sort_order - b.sort_order);
}

export function normalizeCustomFormFields(rows: Partial<CustomFormFieldConfig>[] | null | undefined): CustomFormFieldConfig[] {
  return (rows ?? [])
    .filter((row): row is Partial<CustomFormFieldConfig> & { field_key: string; label: string; type: CustomFieldType } =>
      Boolean(row.field_key && row.label && row.type)
    )
    .map((row, index) => ({
      id: row.id,
      field_key: row.field_key!,
      label: row.label!,
      type: row.type!,
      enabled: typeof row.enabled === "boolean" ? row.enabled : true,
      required: typeof row.required === "boolean" ? row.required : false,
      sort_order: typeof row.sort_order === "number" ? row.sort_order : index,
      placeholder: row.placeholder || "",
      options: Array.isArray(row.options) ? row.options.map((opt) => String(opt)).filter(Boolean) : [],
    }))
    .sort((a, b) => a.sort_order - b.sort_order);
}
