"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { BooksSettings } from "./BooksSettings";
import { MobileNavToggle } from "@/components/layout/MobileNavToggle";

const btnOutline = "inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-on-surface-variant border border-outline-variant/60 hover:text-on-surface hover:border-on-surface/30 hover:bg-surface-container-high transition-colors";

export function BooksSettingsLayout({
  initialOpen,
  initialClosedHeader,
  initialClosedMessage,
  initialOpenAt,
  initialCloseAt,
}: {
  initialOpen: boolean;
  initialClosedHeader: string;
  initialClosedMessage: string;
  initialOpenAt: string;
  initialCloseAt: string;
}) {
  const [previewFn, setPreviewFn] = useState<(() => void) | null>(null);

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="flex items-center gap-2 min-w-0">
          <MobileNavToggle />
          <h1 className="text-xl font-heading font-semibold text-on-surface truncate">Closed Books</h1>
        </div>
        <div className="flex items-center gap-2">
          {previewFn && (
            <button onClick={previewFn} className={btnOutline} title="Preview closed page">
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">Preview closed page</span>
            </button>
          )}
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-xl space-y-2">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-on-surface">Books open / closed</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Control whether your booking form accepts new inquiries and customize what visitors see when it&apos;s closed.
            </p>
          </div>
          <BooksSettings
            initialOpen={initialOpen}
            initialClosedHeader={initialClosedHeader}
            initialClosedMessage={initialClosedMessage}
            initialOpenAt={initialOpenAt}
            initialCloseAt={initialCloseAt}
            onPreviewReady={(fn) => setPreviewFn(() => fn)}
          />
        </div>
      </div>
    </main>
  );
}
