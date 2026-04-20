"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  BaseFieldInputType,
  CustomFieldType,
  DEFAULT_FORM_FIELDS,
  FormFieldConfig,
  FormFieldKey,
  CustomFormFieldConfig,
} from "@/lib/form-fields";

const FIELD_LABELS: Record<FormFieldKey, string> = {
  name: "Full Name",
  email: "Email Address",
  phone: "Phone Number",
  description: "Tattoo Description",
  size: "Size",
  placement: "Placement",
  reference_images: "Reference Images",
  budget: "Budget",
};

const CUSTOM_TYPES: CustomFieldType[] = [
  "text",
  "textarea",
  "number",
  "select",
  "checkbox",
  "date",
  "url",
  "file_or_link",
];

const CUSTOM_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: "Short text",
  textarea: "Long text",
  number: "Number",
  select: "Dropdown",
  checkbox: "Checkbox",
  date: "Date",
  url: "Website link",
  file_or_link: "File upload or links",
};

const BASE_INPUT_TYPES: BaseFieldInputType[] = [
  "text",
  "textarea",
  "number",
  "select",
  "checkbox",
  "date",
  "url",
  "file_or_link",
];
const BASE_INPUT_TYPE_LABELS: Record<BaseFieldInputType, string> = CUSTOM_TYPE_LABELS;

const baseRef = (key: FormFieldKey) => `base:${key}`;
const customRef = (key: string) => `custom:${key}`;
type ItemRef = string;


export function FormBuilderSettings({
  initialFields,
  initialCustomFields,
  initialFormHeader,
  initialFormSubtext,
  initialFormButtonText,
  onPreviewReady,
}: {
  initialFields: FormFieldConfig[];
  initialCustomFields: CustomFormFieldConfig[];
  initialFormHeader: string;
  initialFormSubtext: string;
  initialFormButtonText: string;
  onPreviewReady?: (open: () => void) => void;
}) {
  const [fields, setFields] = useState<FormFieldConfig[]>(
    initialFields.length ? initialFields : DEFAULT_FORM_FIELDS
  );
  const [customFields, setCustomFields] = useState<CustomFormFieldConfig[]>(initialCustomFields);
  const [formHeader, setFormHeader] = useState(initialFormHeader);
  const [formSubtext, setFormSubtext] = useState(initialFormSubtext);
  const [formButtonText, setFormButtonText] = useState(initialFormButtonText);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [draggingRef, setDraggingRef] = useState<ItemRef | null>(null);
  const openPreviewRef = useRef<() => void>(() => {});
  const openPreview = () => {
    const state = { form_header: formHeader, form_subtext: formSubtext, form_button_text: formButtonText };
    window.open(`/form-builder/preview?s=${btoa(JSON.stringify(state))}`, "_blank");
  };
  openPreviewRef.current = openPreview;
  useEffect(() => { onPreviewReady?.(() => openPreviewRef.current()); }, []);
  const [showAddComposer, setShowAddComposer] = useState(false);
  const [expandedBaseKey, setExpandedBaseKey] = useState<FormFieldKey | null>(null);
  const [expandedCustomKey, setExpandedCustomKey] = useState<string | null>(null);

  const [draftField, setDraftField] = useState<CustomFormFieldConfig>({
    field_key: "",
    label: "",
    type: "text",
    enabled: true,
    required: false,
    sort_order: 0,
    placeholder: "",
    options: [],
  });

  const [fieldOrder, setFieldOrder] = useState<ItemRef[]>(() => {
    const baseSorted = [...(initialFields.length ? initialFields : DEFAULT_FORM_FIELDS)].sort(
      (a, b) => a.sort_order - b.sort_order
    );
    const customSorted = [...initialCustomFields].sort((a, b) => a.sort_order - b.sort_order);
    return [
      ...baseSorted.map((f) => baseRef(f.field_key)),
      ...customSorted.map((f) => customRef(f.field_key)),
    ];
  });

  const baseMap = useMemo(() => new Map(fields.map((field) => [field.field_key, field])), [fields]);
  const customMap = useMemo(
    () => new Map(customFields.map((field) => [field.field_key, field])),
    [customFields]
  );

  const isEnabledRef = (ref: ItemRef) => {
    const [kind, key] = ref.split(":");
    if (kind === "base") return Boolean(baseMap.get(key as FormFieldKey)?.enabled);
    return Boolean(customMap.get(key)?.enabled);
  };

  const updateField = (key: FormFieldKey, patch: Partial<FormFieldConfig>) => {
    setFields((prev) =>
      prev.map((field) => {
        if (field.field_key !== key) return field;
        const next = { ...field, ...patch };
        if (!next.enabled) next.required = false;
        return next;
      })
    );
  };

  const updateCustom = (key: string, patch: Partial<CustomFormFieldConfig>) => {
    setCustomFields((prev) =>
      prev.map((field) => {
        if (field.field_key !== key) return field;
        const next = { ...field, ...patch };
        if (!next.enabled) next.required = false;
        if (next.type !== "select") next.options = [];
        return next;
      })
    );
  };

  const setEnabledRef = (ref: ItemRef, enabled: boolean) => {
    const [kind, key] = ref.split(":");
    if (kind === "base") {
      const field = baseMap.get(key as FormFieldKey);
      if (!field) return;
      updateField(field.field_key, { enabled, required: enabled ? field.required : false });
      return;
    }
    const field = customMap.get(key);
    if (!field) return;
    updateCustom(field.field_key, { enabled, required: enabled ? field.required : false });
  };

  const moveRef = (fromRef: ItemRef, toRef: ItemRef, targetEnabled?: boolean) => {
    if (fromRef === toRef) return;
    setFieldOrder((prev) => {
      const fromIdx = prev.indexOf(fromRef);
      const toIdx = prev.indexOf(toRef);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
      return next;
    });
    if (typeof targetEnabled === "boolean") setEnabledRef(fromRef, targetEnabled);
  };

  const moveRefToSectionEnd = (fromRef: ItemRef, enabled: boolean) => {
    setFieldOrder((prev) => {
      const without = prev.filter((ref) => ref !== fromRef);
      if (enabled) {
        const firstInactiveIdx = without.findIndex((ref) => !isEnabledRef(ref));
        const insertAt = firstInactiveIdx === -1 ? without.length : firstInactiveIdx;
        const next = [...without];
        next.splice(insertAt, 0, fromRef);
        return next;
      }
      return [...without, fromRef];
    });
    setEnabledRef(fromRef, enabled);
  };

  const toggleRequiredRef = (ref: ItemRef) => {
    const [kind, key] = ref.split(":");
    if (kind === "base") {
      const field = baseMap.get(key as FormFieldKey);
      if (!field || !field.enabled) return;
      updateField(field.field_key, { required: !field.required });
      return;
    }
    const field = customMap.get(key);
    if (!field || !field.enabled) return;
    updateCustom(field.field_key, { required: !field.required });
  };

  const confirmRemoveFromForm = (label: string) =>
    window.confirm(`Remove "${label}" from the form? You can add it back from Inactive Fields.`);

  const confirmDeleteCustomField = (label: string) =>
    window.confirm(`Delete custom field "${label}" permanently? This cannot be undone.`);

  const removeCustom = (key: string) => {
    setCustomFields((prev) => prev.filter((field) => field.field_key !== key));
    setFieldOrder((prev) => prev.filter((ref) => ref !== customRef(key)));
    if (expandedCustomKey === key) setExpandedCustomKey(null);
  };

  const addOption = (key: string) => {
    setCustomFields((prev) =>
      prev.map((field) =>
        field.field_key === key
          ? { ...field, options: [...(field.options ?? []), `Option ${(field.options?.length ?? 0) + 1}`] }
          : field
      )
    );
  };

  const updateOption = (key: string, index: number, value: string) => {
    setCustomFields((prev) =>
      prev.map((field) => {
        if (field.field_key !== key) return field;
        const options = [...(field.options ?? [])];
        options[index] = value;
        return { ...field, options };
      })
    );
  };

  const removeOption = (key: string, index: number) => {
    setCustomFields((prev) =>
      prev.map((field) => {
        if (field.field_key !== key) return field;
        const options = [...(field.options ?? [])];
        options.splice(index, 1);
        return { ...field, options };
      })
    );
  };

  const addBaseOption = (key: FormFieldKey) => {
    setFields((prev) =>
      prev.map((field) =>
        field.field_key === key
          ? { ...field, options: [...(field.options ?? []), `Option ${(field.options?.length ?? 0) + 1}`] }
          : field
      )
    );
  };

  const updateBaseOption = (key: FormFieldKey, index: number, value: string) => {
    setFields((prev) =>
      prev.map((field) => {
        if (field.field_key !== key) return field;
        const options = [...(field.options ?? [])];
        options[index] = value;
        return { ...field, options };
      })
    );
  };

  const removeBaseOption = (key: FormFieldKey, index: number) => {
    setFields((prev) =>
      prev.map((field) => {
        if (field.field_key !== key) return field;
        const options = [...(field.options ?? [])];
        options.splice(index, 1);
        return { ...field, options };
      })
    );
  };

  const addDraftOption = () => {
    setDraftField((prev) => ({
      ...prev,
      options: [...(prev.options ?? []), `Option ${(prev.options?.length ?? 0) + 1}`],
    }));
  };

  const updateDraftOption = (index: number, value: string) => {
    setDraftField((prev) => {
      const options = [...(prev.options ?? [])];
      options[index] = value;
      return { ...prev, options };
    });
  };

  const removeDraftOption = (index: number) => {
    setDraftField((prev) => {
      const options = [...(prev.options ?? [])];
      options.splice(index, 1);
      return { ...prev, options };
    });
  };

  const resetDraftField = () => {
    setDraftField({
      field_key: "",
      label: "",
      type: "text",
      enabled: true,
      required: false,
      sort_order: 0,
      placeholder: "",
      options: [],
    });
  };

  const addCustomFieldToForm = () => {
    const label = draftField.label.trim();
    if (!label) {
      setMessage("Add a label before adding the custom field.");
      return;
    }
    const generatedKeyBase =
      label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 40) || "custom_field";
    const key = `${generatedKeyBase}_${Date.now().toString().slice(-6)}`;

    const newField: CustomFormFieldConfig = {
      field_key: key,
      label,
      type: draftField.type,
      enabled: true,
      required: draftField.required,
      sort_order: fieldOrder.length,
      placeholder: draftField.placeholder?.trim() ?? "",
      options:
        draftField.type === "select"
          ? (draftField.options ?? []).map((o) => o.trim()).filter(Boolean)
          : [],
    };

    setCustomFields((prev) => [...prev, newField]);
    setFieldOrder((prev) => [...prev, customRef(newField.field_key)]);
    setShowAddComposer(false);
    resetDraftField();
    setMessage("Custom field added. Drag to reorder, then Save Form Builder.");
  };

  const save = async () => {
    setMessage("");
    setMessageType(null);
    setIsSaving(true);
    const orderedBase: FormFieldConfig[] = [];
    const orderedCustom: CustomFormFieldConfig[] = [];
    fieldOrder.forEach((ref, index) => {
      const [kind, key] = ref.split(":");
      if (kind === "base") {
        const field = baseMap.get(key as FormFieldKey);
        if (field) orderedBase.push({ ...field, sort_order: index });
      } else if (kind === "custom") {
        const field = customMap.get(key);
        if (field) orderedCustom.push({ ...field, sort_order: index });
      }
    });

    const appearanceRes = await fetch("/api/artist/form-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        form_header: formHeader.trim() || null,
        form_subtext: formSubtext.trim() || null,
        form_button_text: formButtonText.trim() || null,
      }),
    });
    if (!appearanceRes.ok) {
      const body = await appearanceRes.json();
      setMessage(body.error || "Failed to save form appearance.");
      setMessageType("error");
      setIsSaving(false);
      return;
    }

    const baseRes = await fetch("/api/artist/form-fields", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: orderedBase }),
    });
    const baseBody = await baseRes.json();
    if (!baseRes.ok) {
      setMessage(baseBody.error || "Failed to save base form settings.");
      setMessageType("error");
      setIsSaving(false);
      return;
    }

    const customRes = await fetch("/api/artist/custom-form-fields", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: orderedCustom }),
    });
    const customBody = await customRes.json();
    if (!customRes.ok) {
      setMessage(customBody.error || "Failed to save custom field settings.");
      setMessageType("error");
      setIsSaving(false);
      return;
    }

    setMessage("Saved. Your form changes are now live.");
    setMessageType("success");
    setIsSaving(false);
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 1800);
  };

  const renderFieldCard = (ref: ItemRef, index: number) => {
    const [kind, key] = ref.split(":");

    if (kind === "base") {
      const field = baseMap.get(key as FormFieldKey);
      if (!field) return null;
      const isEmailField = field.field_key === "email";
      const isPhoneField = field.field_key === "phone";
      const isLockedContactField = isEmailField || isPhoneField;
      const baseTypeOptions = BASE_INPUT_TYPES.filter(
        (type) => type !== "file_or_link" || field.field_key === "reference_images"
      );
      const isExpanded = expandedBaseKey === field.field_key;
      return (
        <div
          key={ref}
          draggable
          onDragStart={() => setDraggingRef(ref)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (draggingRef) moveRef(draggingRef, ref, field.enabled);
            setDraggingRef(null);
          }}
          onDragEnd={() => setDraggingRef(null)}
          className={`rounded-lg border p-3 cursor-move ${
            draggingRef === ref
              ? "border-primary/60 bg-surface-container-high"
              : "border-outline-variant/20 bg-surface-container-low"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-on-surface">{field.label || FIELD_LABELS[field.field_key]}</p>
            <p className="text-xs text-on-surface-variant">#{index + 1}</p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {field.enabled && !isEmailField && (
                <Button
                  type="button"
                  size="lg"
                  variant={field.required ? "default" : "outline"}
                  onClick={() => toggleRequiredRef(ref)}
                >
                  {field.required ? "Required: On" : "Required: Off"}
                </Button>
              )}
              {isEmailField && (
                <span className="text-xs font-medium text-on-surface-variant">
                  Always required
                </span>
              )}
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setExpandedBaseKey((prev) =>
                    prev === field.field_key ? null : field.field_key
                  )
                }
              >
                {isExpanded ? "Done" : "Edit"}
              </Button>
            </div>
            <Button
              type="button"
              size="lg"
              variant={field.enabled ? "destructive" : "secondary"}
              disabled={isEmailField}
              onClick={() => {
                if (field.enabled && !confirmRemoveFromForm(FIELD_LABELS[field.field_key])) return;
                moveRefToSectionEnd(ref, !field.enabled);
              }}
            >
              {field.enabled ? "Remove from Form" : "Add to Form"}
            </Button>
          </div>

          {isExpanded && (
            <div className="pt-2 mt-3 border-t border-outline-variant/20 space-y-3">
              <label className="text-sm font-semibold text-on-surface block">
                Label
                <input
                  className="mt-1 w-full rounded border border-outline-variant/40 bg-surface px-2 py-1"
                  value={field.label}
                  onChange={(e) =>
                    updateField(field.field_key, { label: e.target.value })
                  }
                />
              </label>
              {isLockedContactField ? (
                <p className="text-sm text-on-surface-variant rounded-md border border-outline-variant/20 bg-surface-container px-3 py-2">
                  Built-in validation is always enabled for this field type.
                </p>
              ) : (
                <>
                  <label className="text-sm font-semibold text-on-surface block">
                    Placeholder
                    <input
                      className="mt-1 w-full rounded border border-outline-variant/40 bg-surface px-2 py-1"
                      value={field.placeholder ?? ""}
                      onChange={(e) =>
                        updateField(field.field_key, { placeholder: e.target.value })
                      }
                      placeholder="Optional hint for clients"
                    />
                  </label>
                  <label className="text-sm font-semibold text-on-surface block">
                    Field Type
                    <select
                      className="mt-1 w-full rounded border border-outline-variant/40 bg-surface px-2 py-1"
                      value={field.input_type}
                      onChange={(e) =>
                        updateField(field.field_key, {
                          input_type: e.target.value as BaseFieldInputType,
                          options: e.target.value === "select" ? field.options ?? [] : [],
                        })
                      }
                    >
                      {baseTypeOptions.map((type) => (
                        <option key={type} value={type}>
                          {BASE_INPUT_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              {!isLockedContactField && field.input_type === "select" && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-on-surface">Dropdown Choices</p>
                  {(field.options ?? []).map((option, optionIndex) => (
                    <div key={`${field.field_key}-base-opt-${optionIndex}`} className="flex items-center gap-2">
                      <input
                        className="w-full rounded border border-outline-variant/40 bg-surface px-2 py-1"
                        value={option}
                        onChange={(e) =>
                          updateBaseOption(field.field_key, optionIndex, e.target.value)
                        }
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => removeBaseOption(field.field_key, optionIndex)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => addBaseOption(field.field_key)}
                  >
                    Add Choice
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    const field = customMap.get(key);
    if (!field) return null;
    const isExpanded = expandedCustomKey === field.field_key;

    return (
      <div
        key={ref}
        draggable
        onDragStart={() => setDraggingRef(ref)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => {
          if (draggingRef) moveRef(draggingRef, ref, field.enabled);
          setDraggingRef(null);
        }}
        onDragEnd={() => setDraggingRef(null)}
        className={`rounded-lg border p-4 cursor-move space-y-3 ${
          draggingRef === ref
            ? "border-primary/60 bg-surface-container-high"
            : "border-outline-variant/20 bg-surface-container-low"
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="font-semibold text-on-surface">Custom: {field.label}</p>
          <p className="text-xs text-on-surface-variant">#{index + 1}</p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {field.enabled && (
              <Button
                type="button"
                size="lg"
                variant={field.required ? "default" : "outline"}
                onClick={() => toggleRequiredRef(ref)}
              >
                {field.required ? "Required: On" : "Required: Off"}
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={() => setExpandedCustomKey((prev) => (prev === field.field_key ? null : field.field_key))}
            >
              {isExpanded ? "Done" : "Edit"}
            </Button>
          </div>
          <Button
            type="button"
            size="lg"
            variant={field.enabled ? "destructive" : "secondary"}
            onClick={() => {
              if (field.enabled && !confirmRemoveFromForm(field.label)) return;
              moveRefToSectionEnd(ref, !field.enabled);
            }}
          >
            {field.enabled ? "Remove from Form" : "Add to Form"}
          </Button>
        </div>

        {isExpanded && (
          <div className="pt-2 border-t border-outline-variant/20 space-y-3">
            <p className="text-sm font-semibold text-on-surface">Custom Field Editor</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm font-semibold text-on-surface">
                Label
                <input
                  className="mt-1 w-full rounded border border-outline-variant/40 bg-surface px-2 py-1"
                  value={field.label}
                  onChange={(e) => updateCustom(field.field_key, { label: e.target.value })}
                />
              </label>
              <label className="text-sm font-semibold text-on-surface">
                Type
                <select
                  className="mt-1 w-full rounded border border-outline-variant/40 bg-surface px-2 py-1"
                  value={field.type}
                  onChange={(e) => updateCustom(field.field_key, { type: e.target.value as CustomFieldType })}
                >
                  {CUSTOM_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {CUSTOM_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="text-sm font-semibold text-on-surface block">
              Placeholder
              <input
                className="mt-1 w-full rounded border border-outline-variant/40 bg-surface px-2 py-1"
                value={field.placeholder ?? ""}
                onChange={(e) => updateCustom(field.field_key, { placeholder: e.target.value })}
                placeholder="Optional hint for clients"
              />
            </label>

            {field.type === "select" && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-on-surface">Dropdown Choices</p>
                {(field.options ?? []).map((option, optionIndex) => (
                  <div key={`${field.field_key}-opt-${optionIndex}`} className="flex items-center gap-2">
                    <input
                      className="w-full rounded border border-outline-variant/40 bg-surface px-2 py-1"
                      value={option}
                      onChange={(e) => updateOption(field.field_key, optionIndex, e.target.value)}
                    />
                    <Button type="button" variant="destructive" onClick={() => removeOption(field.field_key, optionIndex)}>
                      Remove
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="secondary" onClick={() => addOption(field.field_key)}>
                  Add Choice
                </Button>
              </div>
            )}

            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!confirmDeleteCustomField(field.label)) return;
                removeCustom(field.field_key);
              }}
            >
              Delete Field
            </Button>
          </div>
        )}
      </div>
    );
  };

  const activeRefs = fieldOrder.filter((ref) => isEnabledRef(ref));
  const inactiveRefs = fieldOrder.filter((ref) => !isEnabledRef(ref));

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-8 shadow-sm">
      <h3 className="text-lg font-heading font-semibold mb-2 text-on-surface">Public Form Builder</h3>
      <p className="text-sm text-on-surface-variant mb-8 w-full leading-relaxed">
        Toggle which fields appear on your public booking form and choose which ones are required.
      </p>

      <div className="mb-8 space-y-4 rounded-lg border border-outline-variant/20 bg-surface-container-low p-4">
        <h4 className="font-heading font-semibold text-on-surface">Form Appearance</h4>
        <label className="text-sm font-semibold text-on-surface block">
          Header
          <input
            className="mt-1 w-full rounded border border-outline-variant/40 bg-surface px-2 py-1"
            value={formHeader}
            onChange={(e) => setFormHeader(e.target.value)}
            placeholder="Book with {your name}"
          />
        </label>
        <label className="text-sm font-semibold text-on-surface block">
          Subtext
          <textarea
            className="mt-1 w-full rounded border border-outline-variant/40 bg-surface px-2 py-1 min-h-[64px] resize-y"
            value={formSubtext}
            onChange={(e) => setFormSubtext(e.target.value)}
            placeholder="Fill out the form below to request an appointment..."
          />
        </label>
        <label className="text-sm font-semibold text-on-surface block">
          Submit Button Text
          <input
            className="mt-1 w-full rounded border border-outline-variant/40 bg-surface px-2 py-1"
            value={formButtonText}
            onChange={(e) => setFormButtonText(e.target.value)}
            placeholder="Submit Inquiry"
          />
        </label>
      </div>

      <div className="space-y-3 mb-6">
        <h4 className="font-heading font-semibold text-on-surface">Active Fields</h4>
        <div
          className="space-y-3 rounded-lg border border-dashed border-outline-variant/30 p-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (draggingRef) moveRefToSectionEnd(draggingRef, true);
            setDraggingRef(null);
          }}
        >
          {activeRefs.length > 0 ? (
            activeRefs.map((ref, index) => renderFieldCard(ref, index))
          ) : (
            <p className="text-sm text-on-surface-variant">No active fields.</p>
          )}
        </div>
      </div>

      {!showAddComposer ? (
        <Button
          type="button"
          onClick={() => {
            setShowAddComposer(true);
            setMessage("");
          }}
          variant="outline"
          className="mb-6 w-full h-auto py-4 bg-transparent border-primary text-primary hover:bg-primary/10"
        >
          Add Custom Field
        </Button>
      ) : (
        <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4 space-y-3 mb-6">
          <p className="font-heading font-semibold text-on-surface">New Custom Field</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm font-semibold text-on-surface">
              Label
              <input
                className="mt-1 w-full rounded border border-outline-variant/40 bg-surface px-2 py-1"
                value={draftField.label}
                onChange={(e) => setDraftField((prev) => ({ ...prev, label: e.target.value }))}
                placeholder="Field label"
              />
            </label>
            <label className="text-sm font-semibold text-on-surface">
              Type
              <select
                className="mt-1 w-full rounded border border-outline-variant/40 bg-surface px-2 py-1"
                value={draftField.type}
                onChange={(e) =>
                  setDraftField((prev) => ({
                    ...prev,
                    type: e.target.value as CustomFieldType,
                    options: e.target.value === "select" ? prev.options : [],
                  }))
                }
              >
                {CUSTOM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {CUSTOM_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="text-sm font-semibold text-on-surface block">
            Placeholder
            <input
              className="mt-1 w-full rounded border border-outline-variant/40 bg-surface px-2 py-1"
              value={draftField.placeholder ?? ""}
              onChange={(e) => setDraftField((prev) => ({ ...prev, placeholder: e.target.value }))}
              placeholder="Optional hint for clients"
            />
          </label>
          {draftField.type === "select" && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-on-surface">Dropdown Choices</p>
              {(draftField.options ?? []).map((option, optionIndex) => (
                <div key={`draft-opt-${optionIndex}`} className="flex items-center gap-2">
                  <input
                    className="w-full rounded border border-outline-variant/40 bg-surface px-2 py-1"
                    value={option}
                    onChange={(e) => updateDraftOption(optionIndex, e.target.value)}
                  />
                  <Button type="button" variant="destructive" onClick={() => removeDraftOption(optionIndex)}>
                    Remove
                  </Button>
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={addDraftOption}>
                Add Choice
              </Button>
            </div>
          )}
          <label className="inline-flex items-center gap-2 text-sm text-on-surface-variant">
            <input
              type="checkbox"
              checked={draftField.required}
              onChange={(e) => setDraftField((prev) => ({ ...prev, required: e.target.checked }))}
            />
            Required
          </label>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowAddComposer(false);
                resetDraftField();
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={addCustomFieldToForm}>
              Add to Form
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h4 className="font-heading font-semibold text-on-surface">Inactive Fields</h4>
        <div
          className="space-y-3 rounded-lg border border-dashed border-outline-variant/30 p-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (draggingRef) moveRefToSectionEnd(draggingRef, false);
            setDraggingRef(null);
          }}
        >
          {inactiveRefs.length > 0 ? (
            inactiveRefs.map((ref, index) => renderFieldCard(ref, activeRefs.length + index))
          ) : (
            <p className="text-sm text-on-surface-variant">No inactive fields.</p>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`mt-5 rounded-lg border px-3 py-2 text-sm font-medium ${
            messageType === "success"
              ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-700"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
          role="status"
          aria-live="polite"
        >
          {message}
        </div>
      )}
      <Button
        type="button"
        onClick={save}
        disabled={isSaving}
        className="mt-5 w-full h-auto py-3 text-sm font-medium rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-sm hover:opacity-90 transition-opacity"
      >
        {isSaving ? "Saving..." : justSaved ? "Saved" : "Save Form Builder"}
      </Button>
    </div>
  );
}
