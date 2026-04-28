"use client";

import { useState } from "react";
import { ArrowLeft, ExternalLink, Eye } from "lucide-react";
import Link from "next/link";
import { BookingPageSettings, BookingPageConfig } from "./BookingPageSettings";
import { MobileNavToggle } from "@/components/layout/MobileNavToggle";

const btnOutline = "inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-on-surface-variant border border-outline-variant/60 hover:text-on-surface hover:border-on-surface/30 hover:bg-surface-container-high transition-colors";
const btnFilled = "inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-on-surface text-surface hover:opacity-80 transition-opacity";

export function BookingPageSettingsLayout({ slug, initial }: { slug: string; initial: BookingPageConfig }) {
  const [previewFn, setPreviewFn] = useState<(() => void) | null>(null);

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <MobileNavToggle />
          <Link
            href="/form-builder"
            className="hidden md:flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Form Builder
          </Link>
          <span className="hidden md:inline text-outline-variant/40">/</span>
          <h1 className="text-xl font-heading font-semibold text-on-surface truncate">Page Settings</h1>
        </div>
        <div className="flex items-center gap-2">
          {previewFn && (
            <button onClick={previewFn} className={btnOutline} title="Preview">
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">Preview</span>
            </button>
          )}
          <a href={`/${slug}/book`} target="_blank" rel="noopener noreferrer" className={btnFilled} title="View live form">
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">View Live Form</span>
          </a>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <BookingPageSettings initial={initial} onPreviewReady={(fn) => setPreviewFn(() => fn)} />
      </div>
    </main>
  );
}
