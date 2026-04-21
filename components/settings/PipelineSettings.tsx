"use client";

import { useState } from "react";
import { Check, Info } from "lucide-react";
import {
  PipelineSettings as PipelineSettingsType,
  CARD_FIELD_OPTIONS,
  PIPELINE_COLUMNS,
  DEFAULT_PIPELINE_SETTINGS,
  ALL_BOOKING_STATES,
  mergePipelineSettings,
} from "@/lib/pipeline-settings";
import { BookingState } from "@/lib/types";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function PipelineSettings({ initialSettings }: { initialSettings: PipelineSettingsType }) {
  const [settings, setSettings] = useState<PipelineSettingsType>(initialSettings);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const save = async () => {
    setStatus("saving");
    const res = await fetch("/api/artist/pipeline-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipeline_settings: settings }),
    });
    setStatus(res.ok ? "saved" : "error");
    if (res.ok) setTimeout(() => setStatus("idle"), 2000);
  };

  const toggleCardField = (key: string) => {
    setSettings(prev => ({
      ...prev,
      card_fields: prev.card_fields.includes(key)
        ? prev.card_fields.filter(f => f !== key)
        : [...prev.card_fields, key],
    }));
  };

  const toggleHiddenColumn = (col: BookingState) => {
    setSettings(prev => ({
      ...prev,
      hidden_columns: prev.hidden_columns.includes(col)
        ? prev.hidden_columns.filter(c => c !== col)
        : [...prev.hidden_columns, col],
    }));
  };

  const setColumnLabel = (col: BookingState, label: string) => {
    setSettings(prev => ({ ...prev, column_labels: { ...prev.column_labels, [col]: label } }));
  };

  const setNextAction = (col: BookingState, field: "label" | "target", value: string) => {
    setSettings(prev => {
      const current = prev.next_actions[col] ?? DEFAULT_PIPELINE_SETTINGS.next_actions[col] ?? { label: "Advance", target: "reviewed" as BookingState };
      return { ...prev, next_actions: { ...prev.next_actions, [col]: { ...current, [field]: value } } };
    });
  };

  const clearNextAction = (col: BookingState) => {
    setSettings(prev => {
      const updated = { ...prev.next_actions };
      delete updated[col];
      return { ...prev, next_actions: updated };
    });
  };

  return (
    <div className="space-y-6">
      {/* Card fields */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-on-surface mb-1">Card fields</h3>
        <p className="text-xs text-on-surface-variant mb-4">Choose which fields appear on booking cards in the pipeline view.</p>
        <div className="flex flex-wrap gap-2">
          {CARD_FIELD_OPTIONS.map(opt => {
            const on = settings.card_fields.includes(opt.key);
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => toggleCardField(opt.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  on
                    ? "bg-on-surface text-surface border-on-surface"
                    : "bg-surface border-outline-variant/30 text-on-surface-variant hover:border-outline-variant/60"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Workflow stages */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-on-surface mb-1">Workflow stages</h3>
        <p className="text-xs text-on-surface-variant mb-4">Rename stages, hide ones you don't use, and set what the primary action button does at each stage.</p>

        {/* Automation callout */}
        <div className="flex gap-2.5 rounded-lg bg-surface-container-low border border-outline-variant/20 px-4 py-3 mb-4">
          <Info className="w-3.5 h-3.5 text-on-surface-variant shrink-0 mt-0.5" />
          <div className="text-xs text-on-surface-variant space-y-1">
            <p><strong className="text-on-surface">Renaming a stage</strong> is purely cosmetic — existing bookings, email templates, and auto-send rules are unaffected.</p>
            <p><strong className="text-on-surface">Changing "Moves to"</strong> means the action button will skip any intermediate stages. Auto-send emails tied to bypassed stages won't fire for bookings that take that shortcut path.</p>
            <p><strong className="text-on-surface">Hiding a stage</strong> only affects the pipeline view — bookings already in that state still exist and can be reached from the Bookings table.</p>
          </div>
        </div>

        <div className="space-y-2">
          {PIPELINE_COLUMNS.map(col => {
            const defaultLabel = DEFAULT_PIPELINE_SETTINGS.column_labels[col] ?? col;
            const currentLabel = settings.column_labels[col] ?? defaultLabel;
            const action = settings.next_actions[col] ?? DEFAULT_PIPELINE_SETTINGS.next_actions[col];
            const hidden = settings.hidden_columns.includes(col);

            return (
              <div key={col} className={`rounded-xl border border-outline-variant/20 p-4 transition-opacity ${hidden ? "opacity-40" : ""}`}>
                <div className="flex items-start gap-3">
                  {/* Visibility checkbox */}
                  <button
                    type="button"
                    onClick={() => toggleHiddenColumn(col)}
                    title={hidden ? "Show column" : "Hide column"}
                    className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      hidden ? "border-outline-variant/40 bg-surface" : "border-on-surface bg-on-surface"
                    }`}
                  >
                    {!hidden && <Check className="w-2.5 h-2.5 text-surface" />}
                  </button>

                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1 block">Stage name</label>
                      <input
                        type="text"
                        value={currentLabel}
                        onChange={e => setColumnLabel(col, e.target.value)}
                        placeholder={defaultLabel}
                        className="w-full px-2.5 py-2 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1 block">Action button</label>
                      <input
                        type="text"
                        value={action?.label ?? ""}
                        onChange={e => setNextAction(col, "label", e.target.value)}
                        placeholder="No action"
                        className="w-full px-2.5 py-2 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1 block">Moves to</label>
                      <div className="flex gap-1.5">
                        <select
                          value={action?.target ?? ""}
                          onChange={e => setNextAction(col, "target", e.target.value)}
                          className="flex-1 px-2.5 py-1.5 text-xs text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary appearance-none"
                        >
                          <option value="">— none —</option>
                          {ALL_BOOKING_STATES.filter(s => s !== col).map(s => (
                            <option key={s} value={s}>
                              {settings.column_labels[s] ?? DEFAULT_PIPELINE_SETTINGS.column_labels[s] ?? s}
                            </option>
                          ))}
                        </select>
                        {action && (
                          <button
                            type="button"
                            onClick={() => clearNextAction(col)}
                            className="px-2 py-1.5 text-xs rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors"
                            title="Remove action"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={status === "saving"}
          className="px-4 py-2 text-sm font-medium rounded-xl bg-on-surface text-surface hover:opacity-80 transition-opacity disabled:opacity-40"
        >
          {status === "saving" ? "Saving…" : "Save Changes"}
        </button>
        {status === "saved" && (
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <Check className="w-3.5 h-3.5" /> Saved
          </span>
        )}
        {status === "error" && <span className="text-xs text-red-500">Failed to save. Try again.</span>}
      </div>
    </div>
  );
}
