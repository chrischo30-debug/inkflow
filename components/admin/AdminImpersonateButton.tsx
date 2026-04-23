"use client";

import { useState } from "react";

export function AdminImpersonateButton({
  artistId,
  artistEmail,
}: {
  artistId: string;
  artistEmail: string;
}) {
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  async function generateLink() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId }),
      });
      const data = await res.json();
      if (data.link) setLink(data.link);
    } finally {
      setLoading(false);
    }
  }

  if (link) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-on-surface-variant">Open in incognito to log in as {artistEmail}:</span>
        <button
          onClick={() => navigator.clipboard.writeText(link)}
          className="text-sm px-3.5 py-2 rounded-lg bg-on-surface text-surface font-medium hover:opacity-80 transition-opacity"
        >
          Copy Login Link
        </button>
        <button
          onClick={() => setLink(null)}
          className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={generateLink}
      disabled={loading}
      className="text-sm px-3.5 py-2 rounded-lg bg-on-surface text-surface font-medium hover:opacity-80 transition-opacity disabled:opacity-40"
    >
      {loading ? "Generating…" : "Generate Login Link"}
    </button>
  );
}
