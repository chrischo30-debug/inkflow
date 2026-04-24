"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface SlugInputProps {
  defaultValue?: string;
  errorFromServer?: string;
}

export function SlugInput({ defaultValue = "", errorFromServer }: SlugInputProps) {
  const [raw, setRaw] = useState(defaultValue);
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slug = raw.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");

  useEffect(() => {
    if (!slug) { setStatus("idle"); return; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { setStatus("invalid"); return; }

    setStatus("checking");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/check-slug?slug=${encodeURIComponent(slug)}`);
        const data = await res.json();
        setStatus(data.available ? "available" : "taken");
      } catch {
        setStatus("idle");
      }
    }, 400);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [slug]);

  const serverError = errorFromServer && status === "idle" ? errorFromServer : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-stretch">
        <span className="flex items-center bg-surface-container-high text-on-surface-variant/70 px-3 text-sm border-b border-outline-variant rounded-tl-lg whitespace-nowrap">
          flashbook.app/book/
        </span>
        <div className="relative flex-1">
          <input
            id="slug"
            name="slug"
            required
            value={raw}
            onChange={e => setRaw(e.target.value)}
            className="w-full border-0 border-b border-outline-variant bg-surface-container-high/40 rounded-tr-lg px-4 py-3.5 text-sm focus:outline-none focus:border-primary transition-colors pr-8"
          />
          {status !== "idle" && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
              {status === "checking" && <Loader2 className="w-4 h-4 text-on-surface-variant/40 animate-spin" />}
              {status === "available" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              {(status === "taken" || status === "invalid") && <XCircle className="w-4 h-4 text-destructive" />}
            </span>
          )}
        </div>
      </div>

      {serverError && <p className="text-xs text-destructive">{serverError}</p>}
      {status === "available" && !serverError && (
        <p className="text-xs text-emerald-600 font-medium">"{slug}" is available!</p>
      )}
      {status === "taken" && (
        <p className="text-xs text-destructive">"{slug}" is already taken. Try another.</p>
      )}
      {status === "invalid" && (
        <p className="text-xs text-destructive">Use only lowercase letters, numbers, and hyphens.</p>
      )}
      {status === "idle" && !serverError && (
        <p className="text-xs text-on-surface-variant/60">Share this link with clients so they can submit booking requests.</p>
      )}
    </div>
  );
}
