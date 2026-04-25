"use client";

import { useState } from "react";
import { ExternalLink, Eye } from "lucide-react";
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";
import { FormBuilderSettings } from "./FormBuilderSettings";
import { FormFieldConfig, CustomFormFieldConfig } from "@/lib/form-fields";
import { CoachmarkSequence } from "@/components/coachmarks/Coachmark";

const btnOutline = "inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-on-surface-variant border border-outline-variant/60 hover:text-on-surface hover:border-on-surface/30 hover:bg-surface-container-high transition-colors";
const btnFilled = "inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-on-surface text-surface hover:opacity-80 transition-opacity";

interface Props {
  slug: string;
  initialFields: FormFieldConfig[];
  initialCustomFields: CustomFormFieldConfig[];
  initialFormHeader: string;
  initialFormSubtext: string;
  initialFormButtonText: string;
  initialConfirmationMessage: string;
  initialSuccessRedirectUrl: string;
}

export function FormBuilderPageLayout({ slug, initialFields, initialCustomFields, initialFormHeader, initialFormSubtext, initialFormButtonText, initialConfirmationMessage, initialSuccessRedirectUrl }: Props) {
  const [previewFn, setPreviewFn] = useState<(() => void) | null>(null);

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden">
      <header className="h-16 flex items-center justify-between px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl sticky top-0 z-40">
        <h1 className="text-xl font-heading font-semibold text-on-surface" data-coachmark="page-form-builder">Form Builder</h1>
        <CoachmarkSequence tips={[{
          id: "page.form-builder.intro",
          anchorSelector: '[data-coachmark="page-form-builder"]',
          title: "Build the questions clients answer",
          body: <>
            <p>Toggle which fields show, mark them required, and add custom questions of your own.</p>
            <p>Hit Preview up top to see how the live form looks before you publish.</p>
            <p>Save at the bottom to push your changes to the public form.</p>
          </>,
        }]} />
        <div className="flex items-center gap-2">
          {previewFn && (
            <button onClick={previewFn} className={btnOutline}>
              <Eye className="w-4 h-4" />
              Preview
            </button>
          )}
          <CopyLinkButton path={`/${slug}/book`} />
          <a href={`/${slug}/book`} target="_blank" rel="noopener noreferrer" className={btnFilled}>
            <ExternalLink className="w-4 h-4" />
            Open
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
            initialConfirmationMessage={initialConfirmationMessage}
            initialSuccessRedirectUrl={initialSuccessRedirectUrl}
            onPreviewReady={(fn) => setPreviewFn(() => fn)}
          />
        </section>
      </div>
    </main>
  );
}
