"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyFormLinkButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const url = `${window.location.origin}/${slug}/book`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy form link"
      className="inline-flex items-center gap-2 px-2.5 sm:px-3.5 py-2 text-sm font-medium rounded-lg border border-outline-variant/60 text-on-surface-variant hover:text-on-surface hover:border-on-surface/30 hover:bg-surface-container-high transition-colors"
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      <span className="hidden sm:inline">{copied ? "Copied!" : "Copy form link"}</span>
    </button>
  );
}
