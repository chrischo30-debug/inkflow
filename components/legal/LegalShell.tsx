import Link from "next/link";

export function LegalShell({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-surface">
      <header className="border-b border-outline-variant/15 bg-surface/90 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <img src="/logo.png" alt="FlashBooker logo" className="w-8 h-8 object-contain shrink-0" />
            <span className="text-base font-heading font-bold tracking-tight leading-none">FlashBooker</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm text-on-surface-variant">
            <Link href="/terms" className="hover:text-on-surface transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-on-surface transition-colors">Privacy</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-heading font-semibold tracking-tight text-on-surface">
          {title}
        </h1>
        <p className="text-sm text-on-surface-variant mt-2">Last updated: {lastUpdated}</p>

        <div className="legal-prose mt-10">
          {children}
        </div>

        <footer className="mt-16 pt-8 border-t border-outline-variant/15 text-xs text-on-surface-variant/70 space-y-1">
          <p>Day One Digital Marketing, LLC — Pennsylvania, USA</p>
          <p>
            Questions? Email{" "}
            <a href="mailto:support@flashbooker.app" className="text-primary hover:underline">
              support@flashbooker.app
            </a>
            .
          </p>
        </footer>
      </main>

      <style>{`
        .legal-prose { color: rgb(var(--on-surface) / 1); line-height: 1.7; }
        .legal-prose h2 { font-family: var(--font-heading, inherit); font-size: 1.35rem; font-weight: 600; margin-top: 2.5rem; margin-bottom: 0.75rem; letter-spacing: -0.01em; }
        .legal-prose h3 { font-weight: 600; font-size: 1rem; margin-top: 1.5rem; margin-bottom: 0.5rem; }
        .legal-prose p { margin-bottom: 1rem; font-size: 0.95rem; }
        .legal-prose ul { list-style: disc; padding-left: 1.5rem; margin-bottom: 1rem; font-size: 0.95rem; }
        .legal-prose li { margin-bottom: 0.35rem; }
        .legal-prose strong { font-weight: 600; }
        .legal-prose a { color: rgb(var(--primary) / 1); text-decoration: underline; text-underline-offset: 2px; }
        .legal-prose a:hover { opacity: 0.8; }
      `}</style>
    </div>
  );
}
