import { InquiryForm } from "@/components/booking/InquiryForm";
import { FormFieldConfig, CustomFormFieldConfig } from "@/lib/form-fields";

type Layout = "centered" | "banner" | "minimal";
type Font   = "sans" | "serif" | "mono";

interface SocialLink { platform: string; url: string; }

interface Props {
  artistId: string;
  formFields: FormFieldConfig[];
  customFormFields: CustomFormFieldConfig[];
  formHeader: string;
  formSubtext: string;
  buttonText: string;
  layout: Layout;
  font: Font;
  bgColor: string;
  bgImageUrl: string | null;
  textColor?: "dark" | "light";
  logoUrl: string | null;
  websiteUrl: string;
  socialLinks: SocialLink[];
  showSocialOnBooking: boolean;
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  twitter: "Twitter / X",
  facebook: "Facebook",
  website: "Website",
};

function SocialBar({ websiteUrl, socialLinks }: { websiteUrl: string; socialLinks: SocialLink[] }) {
  const all = [
    ...(websiteUrl ? [{ platform: "website", url: websiteUrl }] : []),
    ...socialLinks,
  ];
  if (all.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {all.map((link) => (
        <a
          key={link.url}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          {PLATFORM_LABELS[link.platform] ?? link.platform}
        </a>
      ))}
    </div>
  );
}

export function BookingPageShell({
  artistId, formFields, customFormFields,
  formHeader, formSubtext, buttonText,
  layout, font, bgColor, bgImageUrl, textColor, logoUrl,
  websiteUrl, socialLinks, showSocialOnBooking,
}: Props) {
  const bgStyle = bgImageUrl
    ? { backgroundImage: `url(${bgImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { backgroundColor: bgColor };

  const resolvedTextColor = textColor ?? ((() => {
    const r = parseInt(bgColor.slice(1, 3), 16);
    const g = parseInt(bgColor.slice(3, 5), 16);
    const b = parseInt(bgColor.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? "dark" : "light";
  })());
  const fgColor = resolvedTextColor === "light" ? "#ffffff" : "#111111";
  const fgMuted = resolvedTextColor === "light" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.5)";

  const fontStyle: React.CSSProperties =
    font === "serif" ? { fontFamily: "var(--font-booking-serif)" } :
    font === "mono"  ? { fontFamily: "var(--font-booking-mono)" }  : {};

  const form = (
    <InquiryForm
      artistId={artistId}
      formFields={formFields}
      customFormFields={customFormFields}
      buttonText={buttonText}
    />
  );

  if (layout === "banner") {
    return (
      <div style={{ minHeight: "100vh", ...fontStyle }}>
        <div style={{ ...bgStyle, color: fgColor }} className="w-full px-6 py-12">
          <div className="max-w-2xl mx-auto flex flex-col items-center gap-4 text-center">
            {logoUrl && (
              <img src={logoUrl} alt="Logo" className="h-16 w-auto object-contain" />
            )}
            <h1 className="text-3xl font-heading font-bold tracking-tight">{formHeader}</h1>
            <p style={{ color: fgMuted }} className="text-base max-w-md">{formSubtext}</p>
            {showSocialOnBooking && (
              <div className="flex flex-wrap gap-2 justify-center mt-1">
                {[...(websiteUrl ? [{ platform: "website", url: websiteUrl }] : []), ...socialLinks].map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"
                     style={{ color: fgColor, borderColor: fgMuted }}
                     className="text-xs px-3 py-1.5 rounded-full backdrop-blur border transition-colors hover:opacity-80">
                    {PLATFORM_LABELS[l.platform] ?? l.platform}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="bg-background">
          <div className="max-w-2xl mx-auto px-4 py-10">
            {form}
          </div>
        </div>
      </div>
    );
  }

  if (layout === "minimal") {
    return (
      <main style={{ minHeight: "100vh", ...bgStyle, ...fontStyle, color: fgColor }} className="px-6 py-14">
        <div className="max-w-xl mx-auto">
          {logoUrl && (
            <img src={logoUrl} alt="Logo" className="h-10 w-auto object-contain mb-8" />
          )}
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">{formHeader}</h1>
          <p style={{ color: fgMuted }} className="mb-4">{formSubtext}</p>
          {showSocialOnBooking && (
            <div className="flex flex-wrap gap-2 mb-6">
              {[...(websiteUrl ? [{ platform: "website", url: websiteUrl }] : []), ...socialLinks].map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"
                   style={{ color: fgColor, borderColor: fgMuted }}
                   className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:opacity-80">
                  {PLATFORM_LABELS[l.platform] ?? l.platform}
                </a>
              ))}
            </div>
          )}
          <div className="border-t pt-8 mt-2" style={{ borderColor: fgMuted }}>
            {form}
          </div>
        </div>
      </main>
    );
  }

  // Default: centered
  return (
    <main style={{ minHeight: "100vh", ...bgStyle, ...fontStyle }} className="py-16 px-4 md:px-8">
      <div className="max-w-lg mx-auto">
        <div className="mb-10 text-center" style={{ color: fgColor }}>
          {logoUrl && (
            <img src={logoUrl} alt="Logo" className="h-14 w-auto object-contain mx-auto mb-6" />
          )}
          <h1 className="text-3xl font-heading font-bold tracking-tight mb-2">{formHeader}</h1>
          <p style={{ color: fgMuted }} className="text-sm">{formSubtext}</p>
          {showSocialOnBooking && (
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {[...(websiteUrl ? [{ platform: "website", url: websiteUrl }] : []), ...socialLinks].map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"
                   style={{ color: fgColor, borderColor: fgMuted }}
                   className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:opacity-80">
                  {PLATFORM_LABELS[l.platform] ?? l.platform}
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="bg-card border border-border rounded-xl p-6 md:p-8 shadow-sm">
          {form}
        </div>
      </div>
    </main>
  );
}
