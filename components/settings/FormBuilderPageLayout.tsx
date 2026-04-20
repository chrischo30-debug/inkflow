"use client";

import { useState } from "react";
import { ExternalLink, Eye, Settings2 } from "lucide-react";
import Link from "next/link";
import { FormBuilderSettings } from "./FormBuilderSettings";
import { FormFieldConfig, CustomFormFieldConfig } from "@/lib/form-fields";

const btnOutline = "inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-on-surface-variant border border-outline-variant/60 hover:text-on-surface hover:border-on-surface/30 hover:bg-surface-container-high transition-colors";
const btnFilled = "inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-on-surface text-surface hover:opacity-80 transition-opacity";

interface Props {
  slug: string;
  initialFields: FormFieldConfig[];
  initialCustomFields: CustomFormFieldConfig[];
  initialFormHeader: string;
  initialFormSubtext: string;
  initialFormButtonText: string;
}

export function FormBuilderPageLayout({ slug, initialFields, initialCustomFields, initialFormHeader, initialFormSubtext, initialFormButtonText }: Props) {
  const [previewFn, setPreviewFn] = useState<(() => void) | null>(null);

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="h-16 flex items-center justify-between px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl sticky top-0 z-40">
        <h1 className="text-xl font-heading font-semibold text-on-surface">Form Builder</h1>
        <div className="flex items-center gap-2">
          <Link href="/form-builder/settings" className={btnOutline}>
            <Settings2 className="w-4 h-4" />
            Page Settings
          </Link>
          {previewFn && (
            <button onClick={previewFn} className={btnOutline}>
              <Eye className="w-4 h-4" />
              Preview
            </button>
          )}
          <a href={`/${slug}/book`} target="_blank" rel="noopener noreferrer" className={btnFilled}>
            <ExternalLink className="w-4 h-4" />
            View Live Form
          </a>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        <section>
          <FormBuilderSettings
            initialFields={initialFields}
            initialCustomFields={initialCustomFields}
            initialFormHeader={initialFormHeader}
            initialFormSubtext={initialFormSubtext}
            initialFormButtonText={initialFormButtonText}
            onPreviewReady={(fn) => setPreviewFn(() => fn)}
          />
        </section>
      </div>
    </main>
  );
}
