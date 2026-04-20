import { InquiryForm } from "@/components/booking/InquiryForm";
import { FormFieldConfig, CustomFormFieldConfig } from "@/lib/form-fields";

type Layout = "centered" | "banner" | "minimal";
type Font   = "sans" | "serif" | "mono";

interface SocialLink { platform: string; url: string; label?: string; }

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
  textColor?: string;
  buttonColor?: string;
  logoUrl: string | null;
  websiteUrl: string;
  socialLinks: SocialLink[];
  showSocialOnBooking: boolean;
  fontScale?: "small" | "base" | "large";
  confirmationMessage?: string;
  successRedirectUrl?: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  twitter: "Twitter / X",
  facebook: "Facebook",
  website: "Website",
};

function PlatformIcon({ platform }: { platform: string }) {
  const cls = "w-4 h-4 shrink-0";
  if (platform === "instagram") return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
  if (platform === "tiktok") return (
    <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/>
    </svg>
  );
  if (platform === "twitter") return (
    <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
  if (platform === "facebook") return (
    <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
  // website / fallback
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  );
}

function SocialLinks({ websiteUrl, socialLinks, fgColor, justify = "start" }: {
  websiteUrl: string; socialLinks: SocialLink[]; fgColor: string; justify?: "start" | "center";
}) {
  const all = [
    ...(websiteUrl ? [{ platform: "website", url: websiteUrl }] : []),
    ...socialLinks,
  ];
  if (all.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${justify === "center" ? "justify-center" : ""}`}>
      {all.map((l, i) => (
        <a key={l.url + i} href={l.url} target="_blank" rel="noopener noreferrer"
           style={{ color: fgColor, borderColor: fgColor }}
           className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border text-sm font-medium opacity-90 hover:opacity-100 transition-opacity">
          {l.platform !== "other" && <PlatformIcon platform={l.platform} />}
          {l.platform === "other" ? (l.label || "Link") : (PLATFORM_LABELS[l.platform] ?? l.platform)}
        </a>
      ))}
    </div>
  );
}

export function BookingPageShell({
  artistId, formFields, customFormFields,
  formHeader, formSubtext, buttonText,
  layout, font, bgColor, bgImageUrl, textColor, buttonColor,
  logoUrl, websiteUrl, socialLinks, showSocialOnBooking, fontScale = "base",
  confirmationMessage, successRedirectUrl
}: Props) {
  const bgStyle = bgImageUrl
    ? { backgroundImage: `url(${bgImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { backgroundColor: bgColor };

  let fgColor = "#111111";
  let fgMuted = "rgba(0,0,0,0.5)";

  if (textColor) {
    if (textColor === "dark") {
      fgColor = "#111111";
      fgMuted = "rgba(0,0,0,0.7)";
    } else if (textColor === "light") {
      fgColor = "#ffffff";
      fgMuted = "rgba(255,255,255,0.85)";
    } else {
      fgColor = textColor;
      fgMuted = textColor.length === 7 ? `${textColor}cc` : textColor;
    }
  } else {
    const isDark = (() => {
      const hex = bgColor.match(/^#?([a-f\d]{6})$/i) ? bgColor : "#ffffff";
      const r = parseInt(hex.slice(1, 3), 16) || 255;
      const g = parseInt(hex.slice(3, 5), 16) || 255;
      const b = parseInt(hex.slice(5, 7), 16) || 255;
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
    })();
    fgColor = isDark ? "#111111" : "#ffffff";
    fgMuted = isDark ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.85)";
  }

  const fontStyle: React.CSSProperties =
    font === "serif" ? { fontFamily: "var(--font-booking-serif)" } :
    font === "mono"  ? { fontFamily: "var(--font-booking-mono)" }  : {};

  const wrapperFontSize =
    fontScale === "small" ? "0.9375rem" :
    fontScale === "large" ? "1.25rem" : "1.0625rem";

  const headingClass =
    fontScale === "small" ? "text-3xl md:text-4xl" :
    fontScale === "large" ? "text-5xl md:text-6xl" : "text-4xl md:text-5xl";

  const subtextClass =
    fontScale === "small" ? "text-base" :
    fontScale === "large" ? "text-xl" : "text-lg";

  const btnColor = buttonColor || "#1a1c22";

  const form = (
    <>
      <style>{`
        .booking-ui-wrapper {
          --ring: ${btnColor};
          --color-ring: ${btnColor};
          --primary: ${btnColor};
          --color-primary: ${btnColor};
          font-size: ${wrapperFontSize};
        }
        .booking-ui-wrapper label {
          font-size: inherit;
          font-weight: 700;
        }
        .booking-ui-wrapper input, .booking-ui-wrapper textarea, .booking-ui-wrapper select {
          font-size: inherit;
          font-weight: 500;
          background-color: #ffffff !important;
          color: #111111 !important;
          border-color: ${btnColor}55 !important;
        }
        .booking-ui-wrapper input:focus, .booking-ui-wrapper textarea:focus, .booking-ui-wrapper select:focus {
          border-color: ${btnColor} !important;
          outline-color: ${btnColor} !important;
        }
        .booking-ui-wrapper ::placeholder {
          opacity: 1 !important;
          color: #888888 !important;
        }
      `}</style>
      <div className="booking-ui-wrapper">
        <InquiryForm
          artistId={artistId}
          formFields={formFields}
          customFormFields={customFormFields}
          buttonText={buttonText}
          confirmationMessage={confirmationMessage}
          successRedirectUrl={successRedirectUrl}
        />
      </div>
    </>
  );

  if (layout === "banner") {
    // Split layout: info on left, form on right, single background throughout
    return (
      <main style={{ minHeight: "100vh", ...bgStyle, ...fontStyle, color: fgColor }} className="px-6 py-14">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-start gap-12 md:gap-16">
          <div className="md:sticky md:top-14 md:w-2/5 flex flex-col gap-4">
            {logoUrl && (
              <img src={logoUrl} alt="Logo" className="h-14 w-auto object-contain self-start" />
            )}
            <h1 className={`${headingClass} font-bold tracking-tight leading-tight`}>{formHeader}</h1>
            <p style={{ color: fgMuted }} className={`${subtextClass} [&_a]:underline [&_a]:opacity-90 [&_strong]:font-bold [&_b]:font-bold`} dangerouslySetInnerHTML={{ __html: formSubtext }} />
            {showSocialOnBooking && (
              <div className="mt-2">
                <SocialLinks websiteUrl={websiteUrl} socialLinks={socialLinks} fgColor={fgColor} />
              </div>
            )}
          </div>
          <div className="md:flex-1">
            {form}
          </div>
        </div>
      </main>
    );
  }

  if (layout === "minimal") {
    return (
      <main style={{ minHeight: "100vh", ...bgStyle, ...fontStyle, color: fgColor }} className="px-6 py-14">
        <div className="max-w-3xl mx-auto">
          {logoUrl && (
            <img src={logoUrl} alt="Logo" className="h-16 w-auto md:h-20 object-contain mb-8" />
          )}
          <h1 className={`${headingClass} font-bold tracking-tight mb-2`}>{formHeader}</h1>
          <p style={{ color: fgMuted }} className={`mb-4 ${subtextClass} [&_a]:underline [&_a]:opacity-90 [&_strong]:font-bold [&_b]:font-bold`} dangerouslySetInnerHTML={{ __html: formSubtext }} />
          {showSocialOnBooking && (
            <div className="mb-6">
              <SocialLinks websiteUrl={websiteUrl} socialLinks={socialLinks} fgColor={fgColor} />
            </div>
          )}
          <div className="border-t pt-8 mt-2 opacity-20" style={{ borderColor: fgColor }} />
          <div>
            {form}
          </div>
        </div>
      </main>
    );
  }

  // Default: centered
  return (
    <main style={{ minHeight: "100vh", ...bgStyle, ...fontStyle }} className="py-16 px-4 md:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-10 text-center" style={{ color: fgColor }}>
          {logoUrl && (
            <img src={logoUrl} alt="Logo" className="h-16 w-auto md:h-24 object-contain mx-auto mb-6" />
          )}
          <h1 className={`${headingClass} font-bold tracking-tight mb-2`}>{formHeader}</h1>
          <p style={{ color: fgMuted }} className={`${subtextClass} [&_a]:underline [&_a]:opacity-90 [&_strong]:font-bold [&_b]:font-bold`} dangerouslySetInnerHTML={{ __html: formSubtext }} />
          {showSocialOnBooking && (
            <div className="mt-4">
              <SocialLinks websiteUrl={websiteUrl} socialLinks={socialLinks} fgColor={fgColor} justify="center" />
            </div>
          )}
        </div>
        <div className="bg-card rounded-xl p-6 md:p-8 shadow-sm" style={{ border: `1.5px solid ${btnColor}55` }}>
          {form}
        </div>
      </div>
    </main>
  );
}
