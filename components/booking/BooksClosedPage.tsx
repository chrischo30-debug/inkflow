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

export function BooksClosedPage({
  artistName,
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
  const hasEmbeds = Boolean(contactForm || newsletter);

  return (
    <div
      className="booking-ui-wrapper min-h-screen flex flex-col items-center justify-start p-6 pt-16"
      style={{ backgroundColor: bgColor }}
    >
      <div className="w-full max-w-md text-center space-y-6">
        {logoUrl && (
          <img
            src={logoUrl}
            alt={artistName}
            className="w-20 h-20 object-contain rounded-xl mx-auto"
          />
        )}

        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{artistName}</h1>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-sm font-medium mb-4">
            <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
            Not accepting bookings
          </div>
          <p className="text-gray-600 text-base leading-relaxed">{displayMessage}</p>
        </div>

        {showSocialOnBooking && socialLinks.length > 0 && (
          <div className="flex items-center justify-center flex-wrap gap-3 pt-2">
            {socialLinks.map(link => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 hover:text-gray-800 transition-colors underline"
              >
                {link.label || PLATFORM_LABELS[link.platform] || link.platform}
              </a>
            ))}
          </div>
        )}

        {websiteUrl && (
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm text-gray-500 hover:text-gray-800 transition-colors underline"
          >
            Visit website
          </a>
        )}
      </div>

      {/* Embedded forms */}
      {hasEmbeds && (
        <div className="w-full max-w-md mt-10 space-y-8">
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
