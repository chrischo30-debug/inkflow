"use client";

import { useState } from "react";
import { Plus, Trash2, ExternalLink, Check } from "lucide-react";
import type { CalendarLink } from "@/lib/pipeline-settings";

const KNOWN_SERVICES = [
  { label: "Calendly",            pattern: "calendly.com" },
  { label: "Cal.com",             pattern: "cal.com" },
  { label: "Acuity Scheduling",   pattern: "acuityscheduling.com" },
  { label: "Square Appointments", pattern: "squareup.com" },
  { label: "Vagaro",              pattern: "vagaro.com" },
  { label: "Booksy",              pattern: "booksy.com" },
];

function detectService(url: string) {
  for (const s of KNOWN_SERVICES) {
    if (url.includes(s.pattern)) return s.label;
  }
  return null;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function CalendarLinksSettings({ initialLinks }: { initialLinks: CalendarLink[] }) {
  const [links, setLinks] = useState<CalendarLink[]>(initialLinks);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");

  const save = async (updated: CalendarLink[]) => {
    setStatus("saving");
    const res = await fetch("/api/artist/pipeline-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calendar_links: updated }),
    });
    setStatus(res.ok ? "saved" : "error");
    if (res.ok) setTimeout(() => setStatus("idle"), 2000);
  };

  const addLink = () => {
    if (!newLabel.trim() || !newUrl.trim()) return;
    const updated = [...links, { label: newLabel.trim(), url: newUrl.trim() }];
    setLinks(updated);
    setNewLabel("");
    setNewUrl("");
    setAdding(false);
    save(updated);
  };

  const removeLink = (i: number) => {
    const updated = links.filter((_, idx) => idx !== i);
    setLinks(updated);
    save(updated);
  };

  const detected = newUrl ? detectService(newUrl) : null;
  const canAdd = newLabel.trim().length > 0 && newUrl.trim().length > 0;

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-4 md:p-6 shadow-sm">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-semibold text-on-surface">Scheduling Links</h3>
        {status === "saved" && (
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <Check className="w-3 h-3" /> Saved
          </span>
        )}
        {status === "error" && <span className="text-xs text-red-500">Failed to save</span>}
      </div>
      <p className="text-xs text-on-surface-variant mb-4">
        Add links for different session types. Use <code className="bg-surface-container-high px-1 py-0.5 rounded text-[11px]">{"{calendarLink}"}</code> in email templates to insert the first link automatically.
      </p>

      <div className="space-y-2 mb-3">
        {links.length === 0 && !adding && (
          <p className="text-xs text-on-surface-variant/60 py-2">No scheduling links added yet.</p>
        )}
        {links.map((link, i) => {
          const service = detectService(link.url);
          return (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-on-surface">{link.label}</p>
                <p className="text-[11px] text-on-surface-variant truncate">{link.url}{service ? ` · ${service}` : ""}</p>
              </div>
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="p-1 text-on-surface-variant hover:text-on-surface transition-colors"
                title="Open link"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={() => removeLink(i)}
                className="p-1 text-on-surface-variant hover:text-destructive transition-colors"
                title="Remove"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {adding ? (
        <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3 space-y-2">
          <input
            type="text"
            placeholder='Label — e.g. "30 min touch-up" or "2 hour piece"'
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary"
          />
          <div>
            <input
              type="url"
              placeholder="https://calendly.com/your-name/session"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary"
            />
            {detected && <p className="text-xs text-on-surface-variant mt-1">Detected: {detected}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setAdding(false); setNewLabel(""); setNewUrl(""); }}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={addLink}
              disabled={!canAdd}
              style={{ background: '#000', color: '#fff', opacity: canAdd ? 1 : 0.35 }}
              className="px-4 py-2.5 text-sm font-medium rounded-lg transition-opacity"
            >
              Add link
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Add link
          </button>
        </div>
      )}
    </div>
  );
}
