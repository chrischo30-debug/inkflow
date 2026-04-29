"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { GripVertical, Trash2, Plus, X } from "lucide-react";
import {
  BaseFieldInputType,
  CustomFieldType,
  DEFAULT_FORM_FIELDS,
  FormFieldConfig,
  FormFieldKey,
  CustomFormFieldConfig,
} from "@/lib/form-fields";
import { useLocalDraft } from "@/lib/use-local-draft";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

type EditDraft =
  | {
      kind: "base";
      key: FormFieldKey;
      label: string;
      placeholder: string;
      description: string;
      input_type: BaseFieldInputType;
      options: string[];
      required: boolean;
    }
  | {
      kind: "custom";
      key: string;
      label: string;
      type: CustomFieldType;
      placeholder: string;
      description: string;
      options: string[];
      required: boolean;
    };

function SortableItem({
  id,
  children,
}: {
  id: string;
  children: (api: {
    setNodeRef: (node: HTMLElement | null) => void;
    style: React.CSSProperties;
    listeners: ReturnType<typeof useSortable>["listeners"];
    attributes: ReturnType<typeof useSortable>["attributes"];
    isDragging: boolean;
  }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return <>{children({ setNodeRef, style, listeners, attributes, isDragging })}</>;
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative flex w-9 h-5 rounded-full transition-colors shrink-0 cursor-pointer ${on ? "bg-primary" : "bg-outline-variant/35"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${on ? "translate-x-4" : ""}`} />
    </button>
  );
}

const inputCls = "w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary";
const labelHeadingCls = "block text-xs font-semibold text-on-surface-variant uppercase tracking-wide";

export function FormBuilderSettings({
  initialFields,
  initialCustomFields,
  initialFormHeader,
  initialFormSubtext,
  initialFormButtonText,
  initialConfirmationMessage,
  initialSuccessRedirectUrl,
  onPreviewReady,
}: {
  initialFields: FormFieldConfig[];
  initialCustomFields: CustomFormFieldConfig[];
  initialFormHeader: string;
  initialFormSubtext: string;
  initialFormButtonText: string;
  initialConfirmationMessage: string;
  initialSuccessRedirectUrl: string;
  onPreviewReady?: (open: () => void) => void;
}) {
  const [fields, setFields] = useState<FormFieldConfig[]>(
    initialFields.length ? initialFields : DEFAULT_FORM_FIELDS
  );
  const [customFields, setCustomFields] = useState<CustomFormFieldConfig[]>(initialCustomFields);
  const [formHeader, setFormHeader] = useState(initialFormHeader);
  const [formSubtext, setFormSubtext] = useState(initialFormSubtext);
  const [formButtonText, setFormButtonText] = useState(initialFormButtonText);
  const [confirmationMessage, setConfirmationMessage] = useState(initialConfirmationMessage);
  const [successRedirectUrl, setSuccessRedirectUrl] = useState(initialSuccessRedirectUrl);
  const [afterSubmit, setAfterSubmit] = useState<"message" | "redirect">(initialSuccessRedirectUrl ? "redirect" : "message");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const openPreviewRef = useRef<() => void>(() => {});
  const [showAddComposer, setShowAddComposer] = useState(false);

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

  // Persist the in-progress custom field while the composer is open. Survives
  // a tab refresh; cleared explicitly when the field is added or discarded.
  const draftFieldStorageKey = showAddComposer ? "fb:custom-field-draft" : null;
  const draftFieldStore = useLocalDraft({
    key: draftFieldStorageKey,
    storage: "session",
    value: draftField,
    onRestore: saved => {
      if (saved && typeof saved === "object" && "type" in saved) {
        setDraftField(prev => ({ ...prev, ...saved }));
      }
    },
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

  const openPreview = () => {
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
    const state = {
      form_header: formHeader,
      form_subtext: formSubtext,
      form_button_text: formButtonText,
      form_confirmation_message: confirmationMessage,
      form_success_redirect_url: afterSubmit === "redirect" ? successRedirectUrl : "",
      fields: orderedBase,
      custom_fields: orderedCustom,
    };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
    window.open(`/form-builder/preview?s=${encoded}`, "_blank");
  };
  openPreviewRef.current = openPreview;
  useEffect(() => { onPreviewReady?.(() => openPreviewRef.current()); }, []);

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const fromRef = String(active.id) as ItemRef;
    const toRef = String(over.id) as ItemRef;
    if (fromRef === toRef) return;
    const fromIdx = fieldOrder.indexOf(fromRef);
    const toIdx = fieldOrder.indexOf(toRef);
    if (fromIdx === -1 || toIdx === -1) return;
    setFieldOrder((prev) => arrayMove(prev, fromIdx, toIdx));
    const fromEnabled = isEnabledRef(fromRef);
    const toEnabled = isEnabledRef(toRef);
    if (fromEnabled !== toEnabled) {
      setEnabledRef(fromRef, toEnabled);
    }
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

  const confirmRemoveFromForm = (label: string) =>
    window.confirm(`Remove "${label}" from the form? You can add it back from Inactive Fields.`);

  const confirmDeleteCustomField = (label: string) =>
    window.confirm(`Delete custom field "${label}" permanently? This cannot be undone.`);

  const removeCustom = (key: string) => {
    setCustomFields((prev) => prev.filter((field) => field.field_key !== key));
    setFieldOrder((prev) => prev.filter((ref) => ref !== customRef(key)));
    if (editDraft?.kind === "custom" && editDraft.key === key) setEditDraft(null);
  };

  const openEdit = (ref: ItemRef) => {
    const [kind, key] = ref.split(":");
    if (kind === "base") {
      const field = baseMap.get(key as FormFieldKey);
      if (!field) return;
      setEditDraft({
        kind: "base",
        key: key as FormFieldKey,
        label: field.label,
        placeholder: field.placeholder ?? "",
        description: field.description ?? "",
        input_type: field.input_type,
        options: [...(field.options ?? [])],
        required: field.required,
      });
    } else {
      const field = customMap.get(key);
      if (!field) return;
      setEditDraft({
        kind: "custom",
        key,
        label: field.label,
        type: field.type,
        placeholder: field.placeholder ?? "",
        description: field.description ?? "",
        options: [...(field.options ?? [])],
        required: field.required,
      });
    }
  };

  const cancelEdit = () => setEditDraft(null);

  const saveEdit = () => {
    if (!editDraft) return;
    if (editDraft.kind === "base") {
      updateField(editDraft.key, {
        label: editDraft.label,
        placeholder: editDraft.placeholder,
        description: editDraft.description,
        input_type: editDraft.input_type,
        options: editDraft.options,
        required: editDraft.required,
      });
    } else {
      updateCustom(editDraft.key, {
        label: editDraft.label,
        type: editDraft.type,
        placeholder: editDraft.placeholder,
        description: editDraft.description,
        options: editDraft.options,
        required: editDraft.required,
      });
    }
    setEditDraft(null);
  };

  const patchDraft = (patch: Partial<EditDraft>) =>
    setEditDraft((prev) => (prev ? { ...prev, ...patch } as EditDraft : null));

  const addDraftOption = () =>
    setEditDraft((prev) => prev ? { ...prev, options: [...prev.options, `Option ${prev.options.length + 1}`] } : null);

  const updateDraftOption = (index: number, value: string) =>
    setEditDraft((prev) => {
      if (!prev) return null;
      const options = [...prev.options];
      options[index] = value;
      return { ...prev, options };
    });

  const removeDraftOption = (index: number) =>
    setEditDraft((prev) => {
      if (!prev) return null;
      const options = [...prev.options];
      options.splice(index, 1);
      return { ...prev, options };
    });

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

  const resetDraftField = () => {
    setDraftField({ field_key: "", label: "", type: "text", enabled: true, required: false, sort_order: 0, placeholder: "", options: [] });
    draftFieldStore.clear();
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

    const redirectRaw = successRedirectUrl.trim();
    const redirectNormalized =
      afterSubmit === "redirect" && redirectRaw
        ? /^https?:\/\//i.test(redirectRaw) ? redirectRaw : `https://${redirectRaw}`
        : null;
    if (afterSubmit === "redirect" && redirectNormalized && redirectNormalized !== successRedirectUrl) {
      setSuccessRedirectUrl(redirectNormalized);
    }

    const appearanceRes = await fetch("/api/artist/form-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        form_header: formHeader.trim() || null,
        form_subtext: formSubtext.trim() || null,
        form_button_text: formButtonText.trim() || null,
        form_confirmation_message: confirmationMessage.trim() || null,
        form_success_redirect_url: redirectNormalized,
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

  const renderFieldCard = (ref: ItemRef) => {
    const [kind, key] = ref.split(":");
    const isEditing = editDraft !== null && (
      (editDraft.kind === "base" && kind === "base" && editDraft.key === key) ||
      (editDraft.kind === "custom" && kind === "custom" && editDraft.key === key)
    );

    if (kind === "base") {
      const field = baseMap.get(key as FormFieldKey);
      if (!field) return null;
      const isEmailField = field.field_key === "email";
      const isLockedContactField = isEmailField || field.field_key === "phone";
      const baseTypeOptions = BASE_INPUT_TYPES.filter(
        (type) => type !== "file_or_link" || field.field_key === "reference_images"
      );
      const isActive = field.enabled;

      return (
        <SortableItem key={ref} id={ref}>
          {({ setNodeRef, style, listeners, attributes, isDragging }) => (
        <div
          ref={setNodeRef}
          style={style}
          {...attributes}
          className={`rounded-xl border transition-all ${
            isDragging
              ? "border-primary/60 bg-primary/5 shadow-md"
              : isActive
              ? "border-outline-variant/25 bg-surface-container-low"
              : "border-outline-variant/15 bg-surface-container-lowest"
          }`}
        >
          {/* Header row — click to expand */}
          <div
            className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none ${isEditing ? "border-b border-outline-variant/15" : ""}`}
            onClick={() => isEditing ? cancelEdit() : openEdit(ref)}
          >
            <button
              type="button"
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              className="touch-none p-1 -m-1 cursor-grab active:cursor-grabbing text-outline-variant/35 hover:text-on-surface-variant"
              aria-label="Drag to reorder"
            >
              <GripVertical className="w-4 h-4 shrink-0" />
            </button>
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <span className={`text-sm font-semibold truncate ${isActive ? "text-on-surface" : "text-on-surface-variant"}`}>
                {field.label || FIELD_LABELS[field.field_key]}
              </span>
              <span className="text-[10px] font-medium text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded-full border border-outline-variant/15 shrink-0 hidden sm:inline">
                {BASE_INPUT_TYPE_LABELS[field.input_type] ?? field.input_type}
              </span>
            </div>
            {!isEmailField && (
              <div onClick={(e) => e.stopPropagation()}>
                <Toggle
                  on={isActive}
                  onChange={(v) => {
                    if (!v && !confirmRemoveFromForm(FIELD_LABELS[field.field_key])) return;
                    if (isEditing) cancelEdit();
                    moveRefToSectionEnd(ref, v);
                  }}
                />
              </div>
            )}
          </div>

          {/* Expanded edit panel */}
          {isEditing && editDraft.kind === "base" && (
            <div className="px-4 py-4 space-y-3">
              <label className={labelHeadingCls}>
                Label
                <input className={`${inputCls} mt-1 font-normal normal-case tracking-normal`}
                  value={editDraft.label}
                  onChange={(e) => patchDraft({ label: e.target.value })}
                />
              </label>
              {isLockedContactField ? (
                <p className="text-xs text-on-surface-variant rounded-lg border border-outline-variant/20 bg-surface-container px-3 py-2">
                  Built-in validation is always enabled for this field type.
                </p>
              ) : (
                <>
                  <label className={labelHeadingCls}>
                    Placeholder
                    <input className={`${inputCls} mt-1 font-normal normal-case tracking-normal`}
                      value={editDraft.placeholder}
                      onChange={(e) => patchDraft({ placeholder: e.target.value })}
                      placeholder="Optional hint for clients"
                    />
                  </label>
                  <label className={labelHeadingCls}>
                    Description
                    <textarea className={`${inputCls} mt-1 font-normal normal-case tracking-normal resize-none`}
                      rows={2}
                      value={editDraft.description}
                      onChange={(e) => patchDraft({ description: e.target.value })}
                      placeholder="Optional subtext shown below the label"
                    />
                  </label>
                  <label className={labelHeadingCls}>
                    Field Type
                    <select className={`${inputCls} mt-1 font-normal normal-case tracking-normal`}
                      value={editDraft.input_type}
                      onChange={(e) => patchDraft({
                        input_type: e.target.value as BaseFieldInputType,
                        options: e.target.value === "select" ? editDraft.options : [],
                      })}>
                      {baseTypeOptions.map((type) => (
                        <option key={type} value={type}>{BASE_INPUT_TYPE_LABELS[type]}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              {!isLockedContactField && editDraft.input_type === "select" && (
                <div className="space-y-2">
                  <p className={labelHeadingCls}>Dropdown Choices</p>
                  {editDraft.options.map((option, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input className={inputCls} value={option} onChange={(e) => updateDraftOption(i, e.target.value)} />
                      <button type="button" onClick={() => removeDraftOption(i)}
                        className="p-1.5 rounded-lg text-on-surface-variant hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={addDraftOption}
                    className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-on-surface transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add choice
                  </button>
                </div>
              )}
              {!isEmailField && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <Toggle on={editDraft.required} onChange={(v) => patchDraft({ required: v })} />
                  <span className="text-sm text-on-surface-variant">Required</span>
                </label>
              )}
              <div className="flex justify-end gap-2 pt-1 border-t border-outline-variant/15">
                <button type="button" onClick={cancelEdit}
                  className="px-3 py-1.5 rounded-lg text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors">
                  Cancel
                </button>
                <button type="button" onClick={saveEdit}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-on-surface text-surface hover:opacity-80 transition-opacity">
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
          )}
        </SortableItem>
      );
    }

    const field = customMap.get(key);
    if (!field) return null;
    const isActive = field.enabled;

    return (
      <SortableItem key={ref} id={ref}>
        {({ setNodeRef, style, listeners, attributes, isDragging }) => (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        className={`rounded-xl border transition-all ${
          isDragging
            ? "border-primary/60 bg-primary/5 shadow-md"
            : isActive
            ? "border-outline-variant/25 bg-surface-container-low"
            : "border-outline-variant/15 bg-surface-container-lowest"
        }`}
      >
        {/* Header row — click to expand */}
        <div
          className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none ${isEditing ? "border-b border-outline-variant/15" : ""}`}
          onClick={() => isEditing ? cancelEdit() : openEdit(ref)}
        >
          <button
            type="button"
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="touch-none p-1 -m-1 cursor-grab active:cursor-grabbing text-outline-variant/35 hover:text-on-surface-variant"
            aria-label="Drag to reorder"
          >
            <GripVertical className="w-4 h-4 shrink-0" />
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className={`text-sm font-semibold truncate ${isActive ? "text-on-surface" : "text-on-surface-variant"}`}>
              {field.label}
            </span>
            <span className="text-[10px] font-medium text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded-full border border-outline-variant/15 shrink-0 hidden sm:inline">
              custom
            </span>
            <span className="text-[10px] font-medium text-on-surface-variant/60 bg-surface-container px-1.5 py-0.5 rounded-full border border-outline-variant/15 shrink-0 hidden md:inline">
              {CUSTOM_TYPE_LABELS[field.type]}
            </span>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <Toggle
              on={isActive}
              onChange={(v) => {
                if (!v && !confirmRemoveFromForm(field.label)) return;
                if (isEditing) cancelEdit();
                moveRefToSectionEnd(ref, v);
              }}
            />
          </div>
        </div>

        {/* Expanded edit panel */}
        {isEditing && editDraft.kind === "custom" && (
          <div className="px-4 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className={labelHeadingCls}>
                Label
                <input className={`${inputCls} mt-1 font-normal normal-case tracking-normal`}
                  value={editDraft.label}
                  onChange={(e) => patchDraft({ label: e.target.value })}
                />
              </label>
              <label className={labelHeadingCls}>
                Type
                <select className={`${inputCls} mt-1 font-normal normal-case tracking-normal`}
                  value={editDraft.type}
                  onChange={(e) => patchDraft({
                    type: e.target.value as CustomFieldType,
                    options: e.target.value === "select" ? editDraft.options : [],
                  })}>
                  {CUSTOM_TYPES.map((type) => (
                    <option key={type} value={type}>{CUSTOM_TYPE_LABELS[type]}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className={labelHeadingCls}>
              Placeholder
              <input className={`${inputCls} mt-1 font-normal normal-case tracking-normal`}
                value={editDraft.placeholder}
                onChange={(e) => patchDraft({ placeholder: e.target.value })}
                placeholder="Optional hint for clients"
              />
            </label>
            <label className={labelHeadingCls}>
              Description
              <textarea className={`${inputCls} mt-1 font-normal normal-case tracking-normal resize-none`}
                rows={2}
                value={editDraft.description}
                onChange={(e) => patchDraft({ description: e.target.value })}
                placeholder="Optional subtext shown below the label"
              />
            </label>
            {editDraft.type === "select" && (
              <div className="space-y-2">
                <p className={labelHeadingCls}>Dropdown Choices</p>
                {editDraft.options.map((option, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input className={inputCls} value={option} onChange={(e) => updateDraftOption(i, e.target.value)} />
                    <button type="button" onClick={() => removeDraftOption(i)}
                      className="p-1.5 rounded-lg text-on-surface-variant hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addDraftOption}
                  className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-on-surface transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add choice
                </button>
              </div>
            )}
            <label className="flex items-center gap-3 cursor-pointer">
              <Toggle on={editDraft.required} onChange={(v) => patchDraft({ required: v })} />
              <span className="text-sm text-on-surface-variant">Required</span>
            </label>
            <div className="flex items-center justify-between pt-1 border-t border-outline-variant/15">
              <button type="button"
                onClick={() => { if (!confirmDeleteCustomField(field.label)) return; removeCustom(field.field_key); }}
                className="flex items-center gap-1.5 text-xs text-destructive/70 hover:text-destructive transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
                Delete field
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={cancelEdit}
                  className="px-3 py-1.5 rounded-lg text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors">
                  Cancel
                </button>
                <button type="button" onClick={saveEdit}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-on-surface text-surface hover:opacity-80 transition-opacity">
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
        )}
      </SortableItem>
    );
  };

  const activeRefs = fieldOrder.filter((ref) => isEnabledRef(ref));
  const inactiveRefs = fieldOrder.filter((ref) => !isEnabledRef(ref));

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-4 md:p-8 shadow-sm space-y-8">
      <div>
        <h3 className="text-lg font-heading font-semibold mb-1 text-on-surface">Public Form Builder</h3>
        <p className="text-sm text-on-surface-variant leading-relaxed">
          Toggle which fields appear on your public booking form and choose which ones are required.
        </p>
      </div>

      {/* Form Appearance */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-on-surface">Form Appearance</h4>
        <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low overflow-hidden divide-y divide-outline-variant/15">
          <div className="p-4 space-y-1.5">
            <label className={labelHeadingCls}>Header</label>
            <input className={inputCls} value={formHeader} onChange={(e) => setFormHeader(e.target.value)}
              placeholder="Book with {your name}" />
          </div>
          <div className="p-4 space-y-1.5">
            <label className={labelHeadingCls}>Subtext</label>
            <textarea className={`${inputCls} min-h-[64px] resize-y`}
              value={formSubtext} onChange={(e) => setFormSubtext(e.target.value)}
              placeholder={"Fill out the form below to request an appointment.\nI'll review your idea and get back to you."} />
            <p className="text-[11px] text-on-surface-variant/70">Use a blank line or &lt;br&gt; for line breaks.</p>
          </div>
          <div className="p-4 space-y-1.5">
            <label className={labelHeadingCls}>Submit Button Text</label>
            <input className={inputCls} value={formButtonText} onChange={(e) => setFormButtonText(e.target.value)}
              placeholder="Submit Inquiry" />
          </div>
          <div className="p-4 space-y-3">
            <p className={labelHeadingCls}>After Submission</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAfterSubmit("message")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${afterSubmit === "message" ? "border-primary/60 bg-primary/5 text-on-surface" : "border-outline-variant/30 text-on-surface-variant hover:border-outline-variant/60"}`}>
                Show message
              </button>
              <button type="button" onClick={() => setAfterSubmit("redirect")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${afterSubmit === "redirect" ? "border-primary/60 bg-primary/5 text-on-surface" : "border-outline-variant/30 text-on-surface-variant hover:border-outline-variant/60"}`}>
                Redirect to URL
              </button>
            </div>
            {afterSubmit === "message" ? (
              <textarea className={`${inputCls} min-h-[64px] resize-y`}
                value={confirmationMessage} onChange={(e) => setConfirmationMessage(e.target.value)}
                placeholder="Thanks for reaching out! I'll review your request and get back to you shortly." />
            ) : (
              <input className={inputCls} value={successRedirectUrl} onChange={(e) => setSuccessRedirectUrl(e.target.value)}
                placeholder="https://yourwebsite.com/thank-you" type="url" />
            )}
          </div>
        </div>
      </section>

      {/* Active Fields */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={fieldOrder} strategy={verticalListSortingStrategy}>
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-on-surface">Active Fields</h4>
              <span className="text-xs text-on-surface-variant">{activeRefs.length} field{activeRefs.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="space-y-2 min-h-[48px]">
              {activeRefs.length > 0 ? (
                activeRefs.map((ref) => renderFieldCard(ref))
              ) : (
                <div className="flex items-center justify-center h-12 rounded-xl border-2 border-dashed border-outline-variant/20 text-sm text-on-surface-variant">
                  No active fields — toggle the switch on a field below.
                </div>
              )}
            </div>
          </section>

      {/* Add Custom Field */}
      {!showAddComposer ? (
        <button type="button"
          onClick={() => { setShowAddComposer(true); setMessage(""); }}
          className="flex items-center gap-2 w-full justify-center px-4 py-3 rounded-xl border border-dashed border-outline-variant/30 hover:border-outline-variant/60 text-sm text-on-surface-variant hover:text-on-surface transition-colors">
          <Plus className="w-4 h-4" />
          Add custom field
        </button>
      ) : (
        <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/15">
            <p className="text-sm font-semibold text-on-surface">New Custom Field</p>
            <button type="button" onClick={() => { setShowAddComposer(false); resetDraftField(); }}
              className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className={labelHeadingCls}>
                Label
                <input className={`${inputCls} mt-1 font-normal normal-case tracking-normal`}
                  value={draftField.label}
                  onChange={(e) => setDraftField((prev) => ({ ...prev, label: e.target.value }))}
                  placeholder="Field label" />
              </label>
              <label className={labelHeadingCls}>
                Type
                <select className={`${inputCls} mt-1 font-normal normal-case tracking-normal`}
                  value={draftField.type}
                  onChange={(e) => setDraftField((prev) => ({
                    ...prev,
                    type: e.target.value as CustomFieldType,
                    options: e.target.value === "select" ? prev.options : [],
                  }))}>
                  {CUSTOM_TYPES.map((type) => (
                    <option key={type} value={type}>{CUSTOM_TYPE_LABELS[type]}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className={labelHeadingCls}>
              Placeholder
              <input className={`${inputCls} mt-1 font-normal normal-case tracking-normal`}
                value={draftField.placeholder ?? ""}
                onChange={(e) => setDraftField((prev) => ({ ...prev, placeholder: e.target.value }))}
                placeholder="Optional hint for clients" />
            </label>
            {draftField.type === "select" && (
              <div className="space-y-2">
                <p className={labelHeadingCls}>Dropdown Choices</p>
                {(draftField.options ?? []).map((option, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input className={inputCls} value={option}
                      onChange={(e) => {
                        const opts = [...(draftField.options ?? [])];
                        opts[i] = e.target.value;
                        setDraftField((prev) => ({ ...prev, options: opts }));
                      }} />
                    <button type="button"
                      onClick={() => setDraftField((prev) => ({ ...prev, options: (prev.options ?? []).filter((_, idx) => idx !== i) }))}
                      className="p-1.5 rounded-lg text-on-surface-variant hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button type="button"
                  onClick={() => setDraftField((prev) => ({ ...prev, options: [...(prev.options ?? []), `Option ${(prev.options?.length ?? 0) + 1}`] }))}
                  className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-on-surface transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add choice
                </button>
              </div>
            )}
            <label className="flex items-center gap-3 cursor-pointer">
              <Toggle on={draftField.required} onChange={(v) => setDraftField((prev) => ({ ...prev, required: v }))} />
              <span className="text-sm text-on-surface-variant">Required</span>
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => { setShowAddComposer(false); resetDraftField(); }}
                className="px-3 py-1.5 rounded-lg text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors">
                Cancel
              </button>
              <button type="button" onClick={addCustomFieldToForm}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-on-surface text-surface hover:opacity-80 transition-opacity">
                Add to Form
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inactive Fields */}
      {inactiveRefs.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-on-surface-variant">Inactive Fields</h4>
            <span className="text-xs text-on-surface-variant">{inactiveRefs.length} field{inactiveRefs.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-2">
            {inactiveRefs.map((ref) => renderFieldCard(ref))}
          </div>
        </section>
      )}
        </SortableContext>
      </DndContext>

      {message && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${
          messageType === "success"
            ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-700"
            : "border-destructive/30 bg-destructive/10 text-destructive"
        }`} role="status" aria-live="polite">
          {message}
        </div>
      )}

      <Button type="button" onClick={save} disabled={isSaving}
        className="w-full h-auto py-3 text-sm font-medium rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-sm hover:opacity-90 transition-opacity">
        {isSaving ? "Saving..." : justSaved ? "Saved" : "Save Form Builder"}
      </Button>
    </div>
  );
}
