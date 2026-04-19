"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/calendar", label: "Calendar" },
  { href: "/settings", label: "Settings" },
  { href: "/form-builder", label: "Form Builder" },
  { href: "/payment-links", label: "Payment Links" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({
  artistName,
  artistSubtitle,
}: {
  artistName: string;
  artistSubtitle: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-outline-variant/20 bg-surface-container-low flex flex-col h-screen sticky top-0">
      <div className="p-6 pb-4">
        <Link href="/" className="flex items-center gap-3 mb-10">
          <img src="/logo.png" alt="FlashBook logo" className="w-9 h-9 object-contain" />
          <div className="min-w-0">
            <p className="text-base font-heading font-bold tracking-tight text-on-surface truncate">{artistName}</p>
            <p className="text-xs text-on-surface-variant truncate">{artistSubtitle}</p>
          </div>
        </Link>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg bg-surface-container-lowest text-primary shadow-sm"
                    : "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
