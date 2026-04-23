"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Mode = "idle" | "accessLoading" | "accessFallback" | "resetLoading" | "resetLink" | "confirmDelete" | "deleteLoading";

export function AdminActions({
  artistId,
  artistEmail,
  targetIsSuperUser = false,
}: {
  artistId: string;
  artistEmail: string;
  targetIsSuperUser?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [fallbackLink, setFallbackLink] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Exchange for a real session server-side (no OTP expiry race), then open
  // a relay page that calls setSession() with the returned tokens.
  //
  // Supabase cookies are shared across all same-origin tabs. When the relay
  // page calls setSession() it overwrites the admin's cookie. We capture the
  // admin session first and restore it when this tab regains focus.
  async function openAccessTab() {
    setMode("accessLoading");
    setError(null);
    try {
      const supabase = createClient();
      const { data: { session: adminSession } } = await supabase.auth.getSession();

      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");

      const relayUrl = `/admin/access-relay?at=${encodeURIComponent(data.access_token)}&rt=${encodeURIComponent(data.refresh_token)}`;
      const opened = window.open(relayUrl, "_blank");
      if (!opened) {
        setFallbackLink(relayUrl);
        setMode("accessFallback");
      } else {
        setMode("idle");

        if (adminSession) {
          const restoreSession = () => {
            supabase.auth.setSession({
              access_token: adminSession.access_token,
              refresh_token: adminSession.refresh_token,
            });
            window.removeEventListener("focus", restoreSession);
          };
          window.addEventListener("focus", restoreSession);
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
      setMode("idle");
    }
  }

  async function generateResetLink() {
    setMode("resetLoading");
    setError(null);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setResetLink(data.link);
      setMode("resetLink");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate link");
      setMode("idle");
    }
  }

  async function deleteAccount() {
    setMode("deleteLoading");
    setError(null);
    try {
      const res = await fetch("/api/admin/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      router.push("/admin");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete account");
      setMode("idle");
    }
  }

  const isLoading = mode === "accessLoading" || mode === "resetLoading" || mode === "deleteLoading";

  // Popup blocked — show the raw link. User must open it immediately (OTP expires).
  if (mode === "accessFallback") {
    return (
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <span className="text-xs text-on-surface-variant">Popup blocked — open this link to access the account:</span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(fallbackLink!);
          }}
          className="text-sm px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors"
        >
          Copy Link
        </button>
        <a
          href={fallbackLink!}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setMode("idle")}
          className="text-sm px-3 py-1.5 rounded-lg bg-on-surface text-surface font-medium hover:opacity-80 transition-opacity"
        >
          Open Tab
        </a>
        <button
          onClick={() => setMode("idle")}
          className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (mode === "resetLink") {
    return (
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <span className="text-xs text-on-surface-variant">Password reset link for {artistEmail}:</span>
        <button
          onClick={() => navigator.clipboard.writeText(resetLink!)}
          className="text-sm px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors"
        >
          Copy Link
        </button>
        <button
          onClick={() => { setMode("idle"); setResetLink(null); }}
          className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (mode === "confirmDelete") {
    return (
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <span className="text-sm text-on-surface-variant">
          Permanently delete <strong className="text-on-surface">{artistEmail}</strong>?
        </span>
        <button
          onClick={deleteAccount}
          className="text-sm px-3 py-1.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
        >
          Delete Account
        </button>
        <button
          onClick={() => setMode("idle")}
          className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {error && (
        <span className="text-xs text-red-500">{error}</span>
      )}
      <button
        onClick={generateResetLink}
        disabled={isLoading}
        className="text-sm px-3.5 py-2 rounded-lg border border-outline-variant/40 text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-40"
      >
        {mode === "resetLoading" ? "Generating…" : "Reset Password"}
      </button>
      <button
        onClick={openAccessTab}
        disabled={isLoading}
        className="text-sm px-3.5 py-2 rounded-lg border border-outline-variant/40 text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-40"
      >
        {mode === "accessLoading" ? "Opening…" : "Access Account"}
      </button>
      {!targetIsSuperUser && (
        <button
          onClick={() => setMode("confirmDelete")}
          disabled={isLoading}
          className="text-sm px-3.5 py-2 rounded-lg border border-red-500/40 text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-40"
        >
          {mode === "deleteLoading" ? "Deleting…" : "Delete Account"}
        </button>
      )}
    </div>
  );
}
