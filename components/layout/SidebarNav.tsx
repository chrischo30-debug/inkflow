"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/calendar", label: "Calendar" },
  { href: "/settings", label: "Settings" },
  {
    href: "/form-builder",
    label: "Form Builder",
    children: [
      { href: "/form-builder", label: "Form Fields" },
      { href: "/form-builder/settings", label: "Page Settings" },
    ],
  },
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
            const expanded = "children" in item && active;
            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className={
                    active
                      ? "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg bg-surface-container-lowest text-primary shadow-sm"
                      : "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
                  }
                >
                  {item.label}
                </Link>
                {expanded && item.children && (
                  <div className="mt-0.5 ml-3 pl-3 border-l border-outline-variant/30 space-y-0.5">
                    {item.children.map((child) => {
                      const childActive = pathname === child.href;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={
                            childActive
                              ? "flex items-center px-3 py-2 text-xs font-medium rounded-lg text-primary bg-primary/5"
                              : "flex items-center px-3 py-2 text-xs font-medium rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
                          }
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
