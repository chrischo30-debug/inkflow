"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Copy, Check, ChevronDown, ChevronUp, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WebhookSource, StandardBookingField } from "@/lib/types";

const STANDARD_FIELD_OPTIONS: { value: StandardBookingField | "__skip__" | "__custom__"; label: string }[] = [
  { value: "__skip__", label: "— Don't import —" },
  { value: "client_name", label: "Client Name" },
  { value: "client_email", label: "Email" },
  { value: "client_phone", label: "Phone" },
  { value: "description", label: "Description / Project Details" },
  { value: "size", label: "Size / Scale" },
  { value: "placement", label: "Placement" },
  { value: "budget", label: "Budget" },
];

function parsePayloadKeys(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) return [];
    return flattenKeys(parsed);
  } catch {
    return [];
  }
}

function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as Record<string, unknown>, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

interface MappingEditorProps {
  incomingKeys: string[];
  mappings: Record<string, string>;
  onChange: (mappings: Record<string, string>) => void;
}

function MappingEditor({ incomingKeys, mappings, onChange }: MappingEditorProps) {
  if (incomingKeys.length === 0) return null;

  return (
    <div className="space-y-2">
      {incomingKeys.map((key) => {
        const current = mappings[key] ?? "__skip__";
        const isCustom =
          current !== "__skip__" &&
          !STANDARD_FIELD_OPTIONS.some((o) => o.value === current);

        return (
          <div key={key} className="flex items-center gap-2">
            <span className="font-mono text-xs text-on-surface-variant bg-surface-container px-2 py-1 rounded flex-1 truncate min-w-0">
              {key}
            </span>
            <span className="text-on-surface-variant text-xs shrink-0">→</span>
            {isCustom ? (
              <div className="flex gap-1 flex-1">
                <input
                  className="flex-1 text-xs bg-surface-container-high border border-outline-variant/20 rounded px-2 py-1 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
                  value={current}
                  placeholder="custom_field_key"
                  onChange={(e) => onChange({ ...mappings, [key]: e.target.value })}
                />
                <button
                  type="button"
                  className="text-xs text-on-surface-variant hover:text-on-surface px-1"
                  onClick={() => onChange({ ...mappings, [key]: "__skip__" })}
                >
                  ✕
                </button>
              </div>
            ) : (
              <select
                className="flex-1 text-xs bg-surface-container-high border border-outline-variant/20 rounded px-2 py-1 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/40"
                value={current}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "__custom__") {
                    onChange({ ...mappings, [key]: "" });
                  } else {
                    onChange({ ...mappings, [key]: val });
                  }
                }}
              >
                {STANDARD_FIELD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
                <option value="__custom__">Custom field key…</option>
              </select>
            )}
          </div>
        );
      })}
      <p className="text-xs text-on-surface-variant mt-1">
        Fields set to "Don't import" still appear in the booking's custom answers.
      </p>
    </div>
  );
}

interface SourceCardProps {
  source: WebhookSource;
  origin: string;
  onUpdate: (updated: WebhookSource) => void;
  onDelete: (id: string) => void;
}

function SourceCard({ source, origin, onUpdate, onDelete }: SourceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [samplePayload, setSamplePayload] = useState("");
  const [detectedKeys, setDetectedKeys] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>(source.field_mappings ?? {});
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [parseError, setParseError] = useState("");

  const webhookUrl = `${origin}/api/webhooks/form/${source.token}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleParseSample = () => {
    if (!samplePayload.trim()) return;
    const keys = parsePayloadKeys(samplePayload);
    if (keys.length === 0) {
      setParseError("Couldn't parse JSON or no fields found.");
      return;
    }
    setParseError("");
    setDetectedKeys(keys);
    // Preserve existing mappings, add new keys with __skip__
    const next = { ...mappings };
    for (const k of keys) {
      if (!(k in next)) next[k] = "__skip__";
    }
    setMappings(next);
  };

  const handleSaveMappings = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/artist/webhook-sources/${source.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field_mappings: mappings }),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdate(updated);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async () => {
    const res = await fetch(`/api/artist/webhook-sources/${source.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !source.enabled }),
    });
    if (res.ok) {
      const updated = await res.json();
      onUpdate(updated);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete webhook source "${source.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    await fetch(`/api/artist/webhook-sources/${source.id}`, { method: "DELETE" });
    onDelete(source.id);
  };

  const allKnownKeys = Array.from(
    new Set([...Object.keys(source.field_mappings ?? {}), ...detectedKeys])
  );

  return (
    <div className="border border-outline-variant/15 rounded-xl bg-surface-container overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <Webhook className="w-4 h-4 text-on-surface-variant shrink-0" />
        <span className="text-sm font-medium text-on-surface flex-1 truncate">{source.name}</span>

        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            source.enabled
              ? "bg-green-500/10 text-green-600"
              : "bg-surface-container-high text-on-surface-variant"
          }`}
        >
          {source.enabled ? "Active" : "Paused"}
        </span>

        <button
          type="button"
          onClick={handleToggleEnabled}
          className="text-xs text-on-surface-variant hover:text-on-surface underline underline-offset-2 shrink-0"
        >
          {source.enabled ? "Pause" : "Enable"}
        </button>

        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="text-on-surface-variant hover:text-on-surface p-1 rounded"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="text-on-surface-variant hover:text-red-500 p-1 rounded"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="border-t border-outline-variant/10 px-4 py-3 flex items-center gap-2">
        <code className="text-xs text-on-surface-variant font-mono flex-1 truncate">{webhookUrl}</code>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 flex items-center gap-1 text-xs text-primary hover:text-primary/80"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-outline-variant/10 px-4 py-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-on-surface mb-1">Field Mapping</p>
            <p className="text-xs text-on-surface-variant mb-3">
              Paste a sample JSON payload from your form tool to auto-detect fields, then map each one to a booking field.
            </p>

            <div className="flex gap-2">
              <textarea
                className="flex-1 text-xs font-mono bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
                rows={4}
                placeholder='{"name": "Jane", "email": "jane@example.com", "message": "..."}'
                value={samplePayload}
                onChange={(e) => setSamplePayload(e.target.value)}
              />
              <button
                type="button"
                onClick={handleParseSample}
                className="shrink-0 self-end text-xs bg-surface-container-high border border-outline-variant/20 hover:bg-surface-container text-on-surface px-3 py-2 rounded-lg"
              >
                Detect fields
              </button>
            </div>
            {parseError && <p className="text-xs text-red-500 mt-1">{parseError}</p>}
          </div>

          {allKnownKeys.length > 0 && (
            <div className="space-y-3">
              <MappingEditor
                incomingKeys={allKnownKeys}
                mappings={mappings}
                onChange={setMappings}
              />
              <Button
                onClick={handleSaveMappings}
                disabled={saving}
                className="h-auto py-2 text-sm rounded-lg"
              >
                {saving ? "Saving…" : "Save mappings"}
              </Button>
            </div>
          )}

          {allKnownKeys.length === 0 && (
            <p className="text-xs text-on-surface-variant italic">
              No fields mapped yet. Paste a sample payload above to get started, or submit a test to your webhook URL and the raw fields will appear here automatically.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function WebhookSourcesSettings() {
  const [sources, setSources] = useState<WebhookSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/artist/webhook-sources");
      if (res.ok) setSources(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/artist/webhook-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        const created = await res.json();
        setSources((prev) => [...prev, created]);
        setNewName("");
        setShowForm(false);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = (updated: WebhookSource) => {
    setSources((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleDelete = (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-on-surface mb-1">Webhook Sources</h3>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Connect JotForm, Wix, Forminator, or any form tool that supports webhooks. Submissions are routed directly into your bookings pipeline.
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-on-surface-variant">Loading…</p>
      ) : (
        <div className="space-y-2">
          {sources.map((s) => (
            <SourceCard
              key={s.id}
              source={s}
              origin={origin}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}

          {sources.length === 0 && !showForm && (
            <p className="text-xs text-on-surface-variant italic">No webhook sources yet.</p>
          )}
        </div>
      )}

      {showForm ? (
        <div className="flex gap-2 items-center">
          <input
            autoFocus
            className="flex-1 text-sm bg-surface-container-high border border-outline-variant/20 rounded-lg px-3 py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
            placeholder="e.g. JotForm Contact Form"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowForm(false); }}
          />
          <Button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="h-auto py-2 text-sm rounded-lg"
          >
            {creating ? "Creating…" : "Create"}
          </Button>
          <button
            type="button"
            onClick={() => { setShowForm(false); setNewName(""); }}
            className="text-sm text-on-surface-variant hover:text-on-surface"
          >
            Cancel
          </button>
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={() => setShowForm(true)}
          className="h-auto py-2 text-sm rounded-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add webhook source
        </Button>
      )}
    </div>
  );
}
