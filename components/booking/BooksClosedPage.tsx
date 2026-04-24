import { EmbeddedContactForm } from "@/components/contact/EmbeddedContactForm";
import { EmbeddedNewsletterForm } from "@/components/newsletter/EmbeddedNewsletterForm";

interface SocialLink { platform: string; url: string; label?: string; }

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  twitter: "Twitter / X",
  facebook: "Facebook",
  website: "Website",
};

interface ContactFormConfig {
  artistSlug: string;
  header: string;
  subtext: string;
  buttonText: string;
  confirmationMessage: string;
  phoneEnabled: boolean;
  phoneRequired: boolean;
}

interface NewsletterConfig {
  artistSlug: string;
  header: string;
  subtext: string;
  buttonText: string;
  confirmationMessage: string;
}

interface Props {
  artistName: string;
  closedHeader?: string | null;
  logoUrl: string | null;
  message: string | null;
  websiteUrl: string | null;
  socialLinks: SocialLink[];
  showSocialOnBooking: boolean;
  bgColor: string;
  accentTheme: "crimson" | "blue";
  contactForm?: ContactFormConfig | null;
  newsletter?: NewsletterConfig | null;
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

export function BooksClosedPage({
  artistName,
  closedHeader,
  logoUrl,
  message,
  websiteUrl,
  socialLinks,
  showSocialOnBooking,
  bgColor,
  contactForm,
  newsletter,
}: Props) {
  const displayMessage = message?.trim() || "I'm not currently accepting new booking inquiries. Check back soon!";
  const displayHeader = closedHeader?.trim() || artistName;
  const hasEmbeds = Boolean(contactForm || newsletter);

  const allLinks = [
    ...(websiteUrl ? [{ platform: "website", url: websiteUrl, label: "Visit website" }] : []),
    ...(showSocialOnBooking ? socialLinks : []),
  ];

  return (
    <div
      className="booking-ui-wrapper min-h-screen flex flex-col items-center justify-start p-6 pt-16"
      style={{ backgroundColor: bgColor }}
    >
      <div className="w-full max-w-lg text-center space-y-6">
        {logoUrl && (
          <img
            src={logoUrl}
            alt={artistName}
            className="w-20 h-20 object-contain rounded-xl mx-auto"
          />
        )}

        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-3">{displayHeader}</h1>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-sm font-medium mb-4">
            <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
            Not accepting bookings
          </div>
          <p className="text-gray-600 text-base leading-relaxed">{displayMessage}</p>
        </div>

        {allLinks.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            {allLinks.map((link, i) => (
              <a
                key={`${link.url}-${i}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:border-gray-400 hover:text-gray-900 transition-colors shadow-sm"
              >
                {link.platform !== "other" && link.platform !== "website" && <PlatformIcon platform={link.platform} />}
                {link.label || PLATFORM_LABELS[link.platform] || link.platform}
              </a>
            ))}
          </div>
        )}
      </div>

      {hasEmbeds && (
        <div className="w-full max-w-lg mt-10 space-y-8">
          {contactForm && (
            <div className="border-t border-gray-200 pt-8">
              <EmbeddedContactForm {...contactForm} />
            </div>
          )}
          {newsletter && (
            <div className="border-t border-gray-200 pt-8">
              <EmbeddedNewsletterForm {...newsletter} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
