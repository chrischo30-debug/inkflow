import { InquiryForm } from "@/components/booking/InquiryForm";
import { FormFieldConfig, CustomFormFieldConfig } from "@/lib/form-fields";

type Layout = "centered" | "banner" | "minimal" | "full";

interface SocialLink { platform: string; url: string; label?: string; }

interface Props {
  artistId: string;
  formFields: FormFieldConfig[];
  customFormFields: CustomFormFieldConfig[];
  formHeader: string;
  formSubtext: string;
  buttonText: string;
  layout: Layout;
  font: string;
  bgColor: string;
  bgImageUrl: string | null;
  textColor?: string;
  buttonColor?: string;
  labelColor?: string;
  logoUrl: string | null;
  websiteUrl: string;
  socialLinks: SocialLink[];
  showSocialOnBooking: boolean;
  fontScale?: string;
  headerSize?: string;
  headerAlign?: "left" | "center";
  confirmationMessage?: string;
  successRedirectUrl?: string;
  prefill?: { name?: string; email?: string; phone?: string };
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  twitter: "Twitter / X",
  facebook: "Facebook",
  website: "Website",
};

// Map legacy enum font values to font family names
const LEGACY_FONT_MAP: Record<string, string> = {
  sans: "Manrope",
  serif: "Cormorant Garamond",
  mono: "Space Mono",
  display: "Bebas Neue",
  playfair: "Playfair Display",
  script: "Dancing Script",
};

// Map legacy enum size values to pixels
const LEGACY_HEADER_PX: Record<string, number> = { sm: 28, md: 36, lg: 44, xl: 54, "2xl": 68 };
const LEGACY_FORM_PX: Record<string, number> = { small: 15, base: 17, large: 20 };

function resolveFontFamily(font: string): string {
  return LEGACY_FONT_MAP[font] ?? font;
}
function resolveHeaderPx(val: string | undefined): number {
  if (!val) return 36;
  if (LEGACY_HEADER_PX[val] !== undefined) return LEGACY_HEADER_PX[val];
  const n = parseInt(val);
  return isNaN(n) ? 36 : Math.max(18, Math.min(72, n));
}
function resolveFormPx(val: string | undefined): number {
  if (!val) return 17;
  if (LEGACY_FORM_PX[val] !== undefined) return LEGACY_FORM_PX[val];
  const n = parseInt(val);
  return isNaN(n) ? 17 : Math.max(12, Math.min(20, n));
}

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
    <div className={`flex flex-wrap gap-2 justify-center ${justify === "start" ? "md:justify-start" : ""}`}>
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
  layout, font, bgColor, bgImageUrl, textColor, buttonColor, labelColor,
  logoUrl, websiteUrl, socialLinks, showSocialOnBooking,
  fontScale, headerSize, headerAlign = "left",
  confirmationMessage, successRedirectUrl, prefill
}: Props) {
  const bgStyle = bgImageUrl
    ? { backgroundImage: `url(${bgImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { backgroundColor: bgColor };

  const fontFamily = resolveFontFamily(font);
  const headerPx = resolveHeaderPx(headerSize);
  const formPx = resolveFormPx(fontScale);

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

  const fontFamilyCss = `'${fontFamily}', sans-serif`;
  const pageStyle: React.CSSProperties = { ...bgStyle, fontFamily: fontFamilyCss };
  const headingStyle: React.CSSProperties = { fontSize: headerPx + "px" };
  const btnColor = buttonColor || "#1a1c22";

  // Build Google Fonts URL for the selected font (load at render time)
  const googleFontsUrl =
    `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, "+")}:wght@400;500;600;700&display=swap`;

  const form = (
    <>
      <style>{`
        @import url('${googleFontsUrl}');
        .booking-ui-wrapper {
          --ring: ${btnColor};
          --color-ring: ${btnColor};
          --primary: ${btnColor};
          --color-primary: ${btnColor};
          font-size: ${formPx}px;
          font-family: ${fontFamilyCss};
        }
        .booking-ui-wrapper label.bk-label {
          display: block;
          font-size: 0.72em;
          font-weight: 600;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: ${labelColor || "#666666"} !important;
          opacity: 1;
          margin-bottom: 6px;
        }
        .booking-ui-wrapper input,
        .booking-ui-wrapper textarea,
        .booking-ui-wrapper select {
          font-size: inherit;
          font-weight: 400;
          background-color: #ffffff !important;
          color: #111111 !important;
          border: 1.5px solid rgba(0,0,0,0.13) !important;
          border-radius: 10px !important;
          padding: 13px 16px !important;
          width: 100%;
          transition: border-color 0.15s, box-shadow 0.15s;
          -webkit-appearance: none;
          appearance: none;
        }
        .booking-ui-wrapper input:focus,
        .booking-ui-wrapper textarea:focus,
        .booking-ui-wrapper select:focus {
          border-color: ${btnColor} !important;
          outline: none !important;
          box-shadow: 0 0 0 3px ${btnColor}22 !important;
        }
        .booking-ui-wrapper ::placeholder {
          opacity: 1 !important;
          color: #aaaaaa !important;
        }
        .booking-ui-wrapper .bk-select-wrap {
          position: relative;
        }
        .booking-ui-wrapper .bk-select-wrap::after {
          content: '';
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          width: 0;
          height: 0;
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          border-top: 5px solid #666;
          pointer-events: none;
        }
        .booking-ui-wrapper .bk-select-wrap select {
          padding-right: 36px !important;
          cursor: pointer;
        }
        .booking-ui-wrapper button[type="submit"] {
          width: 100%;
          padding: 15px 24px;
          font-size: inherit;
          font-weight: 600;
          border-radius: 12px;
          background-color: ${btnColor};
          color: #ffffff;
          border: none;
          cursor: pointer;
          transition: opacity 0.15s;
          letter-spacing: 0.01em;
        }
        .booking-ui-wrapper button[type="submit"]:hover {
          opacity: 0.88;
        }
        .booking-ui-wrapper button[type="submit"]:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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
          prefill={prefill}
        />
      </div>
    </>
  );

  if (layout === "banner") {
    return (
      <main style={{ minHeight: "100vh", color: fgColor, ...pageStyle }} className="px-6 py-14">
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={googleFontsUrl} />
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-start gap-12 md:gap-16">
          <div className="md:sticky md:top-14 md:w-2/5 flex flex-col items-center md:items-start gap-4">
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-14 w-auto object-contain" />}
            <h1 className="font-bold tracking-tight leading-tight text-center md:text-left" style={headingStyle}>{formHeader}</h1>
            <p style={{ color: fgMuted }} className="text-center md:text-left [&_a]:underline [&_a]:opacity-90 [&_strong]:font-bold [&_b]:font-bold"
              dangerouslySetInnerHTML={{ __html: formSubtext }} />
            {showSocialOnBooking && (
              <div className="mt-2 w-full">
                <SocialLinks websiteUrl={websiteUrl} socialLinks={socialLinks} fgColor={fgColor} justify="start" />
              </div>
            )}
          </div>
          <div className="md:flex-1">{form}</div>
        </div>
      </main>
    );
  }

  if (layout === "minimal") {
    const centered = headerAlign === "center";
    return (
      <main style={{ minHeight: "100vh", color: fgColor, ...pageStyle }} className="px-6 py-14">
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={googleFontsUrl} />
        <div className="max-w-3xl mx-auto">
          {logoUrl && (
            <img src={logoUrl} alt="Logo" className={`h-16 w-auto md:h-20 object-contain mb-8 ${centered ? "mx-auto block" : "block"}`} />
          )}
          <h1 className={`font-bold tracking-tight mb-2 ${centered ? "text-center" : ""}`} style={headingStyle}>{formHeader}</h1>
          <p style={{ color: fgMuted }} className={`mb-4 ${centered ? "text-center" : ""} [&_a]:underline [&_a]:opacity-90 [&_strong]:font-bold [&_b]:font-bold`}
            dangerouslySetInnerHTML={{ __html: formSubtext }} />
          {showSocialOnBooking && (
            <div className={`mb-6 ${centered ? "flex justify-center" : ""}`}>
              <SocialLinks websiteUrl={websiteUrl} socialLinks={socialLinks} fgColor={fgColor} justify={centered ? "center" : "start"} />
            </div>
          )}
          <div className="border-t pt-8 mt-2 opacity-20" style={{ borderColor: fgColor }} />
          {form}
        </div>
      </main>
    );
  }

  if (layout === "full") {
    // Full: wide (max-w-4xl), always centered header, no card, generous vertical space
    return (
      <main style={{ minHeight: "100vh", color: fgColor, ...pageStyle }} className="px-6 py-20">
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={googleFontsUrl} />
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            {logoUrl && (
              <img src={logoUrl} alt="Logo" className="h-16 w-auto md:h-20 object-contain mx-auto mb-8" />
            )}
            <h1 className="font-bold tracking-tight mb-4" style={headingStyle}>{formHeader}</h1>
            <p style={{ color: fgMuted }} className="max-w-xl mx-auto [&_a]:underline [&_a]:opacity-90 [&_strong]:font-bold [&_b]:font-bold"
              dangerouslySetInnerHTML={{ __html: formSubtext }} />
            {showSocialOnBooking && (
              <div className="mt-6 flex justify-center">
                <SocialLinks websiteUrl={websiteUrl} socialLinks={socialLinks} fgColor={fgColor} justify="center" />
              </div>
            )}
          </div>
          <div className="max-w-2xl mx-auto">
            {form}
          </div>
        </div>
      </main>
    );
  }

  // Default: centered
  return (
    <main style={{ minHeight: "100vh", ...pageStyle }} className="py-16 px-4 md:px-8">
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={googleFontsUrl} />
      <div className="max-w-2xl mx-auto">
        <div className="mb-10 text-center" style={{ color: fgColor }}>
          {logoUrl && <img src={logoUrl} alt="Logo" className="h-16 w-auto md:h-24 object-contain mx-auto mb-6" />}
          <h1 className="font-bold tracking-tight mb-2" style={headingStyle}>{formHeader}</h1>
          <p style={{ color: fgMuted }} className="[&_a]:underline [&_a]:opacity-90 [&_strong]:font-bold [&_b]:font-bold"
            dangerouslySetInnerHTML={{ __html: formSubtext }} />
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
