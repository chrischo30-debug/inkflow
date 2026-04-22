"use client";

import { useState } from "react";

export function BooksToggle({
  initialOpen,
  statusLabel,
}: {
  initialOpen: boolean;
  statusLabel: string;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    const next = !open;
    setSaving(true);
    setOpen(next);
    try {
      await fetch("/api/artist/books-status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ books_open: next }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={open}
      onClick={toggle}
      disabled={saving}
      className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors border disabled:opacity-50 ${
        open
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15"
          : "bg-destructive/5 text-destructive border-destructive/20 hover:bg-destructive/10"
      }`}
    >
      <span className={`w-2 h-2 rounded-full inline-block shrink-0 ${open ? "bg-emerald-500" : "bg-destructive"}`} />
      Books {open ? "Open" : "Closed"}
      <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${open ? "bg-emerald-500" : "bg-outline-variant/40"}`}>
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${open ? "translate-x-4" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}
