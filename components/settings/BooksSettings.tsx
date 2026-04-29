"use client";

import { useState, useRef, useEffect } from "react";
import { Check } from "lucide-react";

type SaveError = string | null;

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function BooksSettings({
  initialOpen,
  initialClosedHeader,
  initialClosedMessage,
  initialOpenAt,
  initialCloseAt,
  onPreviewReady,
}: {
  initialOpen: boolean;
  initialClosedHeader: string;
  initialClosedMessage: string;
  initialOpenAt: string;
  initialCloseAt: string;
  onPreviewReady?: (fn: () => void) => void;
}) {
  const [booksOpen, setBooksOpen] = useState(initialOpen);
  const [closedHeader, setClosedHeader] = useState(initialClosedHeader);
  const [closedMessage, setClosedMessage] = useState(initialClosedMessage);
  const [openAt, setOpenAt] = useState(initialOpenAt);
  const [closeAt, setCloseAt] = useState(initialCloseAt);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<SaveError>(null);

  const openPreviewRef = useRef<() => void>(() => {});
  const openPreview = () => {
    const state = { books_closed_header: closedHeader, books_closed_message: closedMessage };
    window.open(`/form-builder/books/preview?s=${btoa(JSON.stringify(state))}`, "_blank");
  };
  openPreviewRef.current = openPreview;
  useEffect(() => { onPreviewReady?.(() => openPreviewRef.current()); }, []);

  const save = async (patch: Record<string, unknown>) => {
    setStatus("saving");
    setSaveError(null);
    try {
      const res = await fetch("/api/artist/books-status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 2500);
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error ?? "Failed to save");
        setStatus("error");
      }
    } catch {
      setSaveError("Failed to save");
      setStatus("error");
    }
  };

  const handleToggle = () => {
    const next = !booksOpen;
    setBooksOpen(next);
    save({ books_open: next });
  };

  const handleSaveSettings = () => {
    save({
      books_closed_header: closedHeader,
      books_closed_message: closedMessage,
      books_open_at: openAt,
      books_close_at: closeAt,
    });
  };

  return (
    <div className="space-y-4">
      {/* Main toggle */}
      <div className={`rounded-xl border p-5 transition-colors ${booksOpen ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/20 bg-destructive/5"}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${booksOpen ? "bg-emerald-500" : "bg-destructive"}`} />
            <div>
              <p className={`text-sm font-semibold ${booksOpen ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>
                Books {booksOpen ? "Open" : "Closed"}
              </p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {booksOpen ? "Accepting new submissions" : "Booking form is hidden from clients"}
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={booksOpen}
            onClick={handleToggle}
            className={`relative shrink-0 inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${
              booksOpen ? "bg-emerald-500" : "bg-outline-variant/40"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                booksOpen ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Closed page content */}
      <div className="rounded-xl border border-outline-variant/20 p-5 space-y-4">
        <div>
          <p className="text-base font-medium text-on-surface mb-0.5">Closed page</p>
          <p className="text-sm text-on-surface-variant">
            What visitors see when your booking form is closed.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-on-surface-variant">Page heading</label>
          <input
            type="text"
            value={closedHeader}
            onChange={e => setClosedHeader(e.target.value)}
            maxLength={200}
            placeholder="Your artist name (default)"
            className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary placeholder:text-[#888888]"
          />
          <p className="text-sm text-on-surface-variant">Defaults to your artist name if left blank.</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-on-surface-variant">Message</label>
          <textarea
            value={closedMessage}
            onChange={e => setClosedMessage(e.target.value)}
            rows={3}
            placeholder="I'm not currently accepting new booking inquiries. Check back soon!"
            className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary resize-none placeholder:text-[#888888]"
          />
        </div>

        {/* Drop schedule */}
        <div>
          <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-3">Drop schedule (optional)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-on-surface-variant mb-1 block">Auto-open at</label>
              <input
                type="datetime-local"
                value={openAt}
                onChange={e => setOpenAt(e.target.value)}
                className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs text-on-surface-variant mb-1 block">Auto-close at</label>
              <input
                type="datetime-local"
                value={closeAt}
                onChange={e => setCloseAt(e.target.value)}
                className="w-full px-3 py-2.5 text-sm text-on-surface bg-surface-container-low border border-outline-variant/30 rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <p className="text-xs text-on-surface-variant mt-2">
            Set dates to automatically open or close your books. Clear both fields to disable the schedule.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={status === "saving"}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-on-surface text-surface hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            {status === "saving" ? "Saving…" : "Save"}
          </button>
          {status === "saved" && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600">
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
          {status === "error" && (
            <span className="text-sm text-destructive">{saveError ?? "Failed to save"}</span>
          )}
        </div>
      </div>
    </div>
  );
}
