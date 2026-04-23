"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";

type NavItem = {
  href: string;
  label: string;
  children?: { href: string; label: string }[];
};

type NavGroup = {
  label?: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: "/", label: "Dashboard" },
      { href: "/bookings", label: "Bookings" },
      { href: "/calendar", label: "Calendar" },
      { href: "/inbox", label: "Inbox" },
      { href: "/analytics", label: "Analytics" },
    ],
  },
  {
    label: "Studio",
    items: [
      {
        href: "/form-builder",
        label: "Form Builder",
        children: [
          { href: "/form-builder", label: "Form Fields" },
          { href: "/form-builder/settings", label: "Page Settings" },
        ],
      },
      { href: "/contact-form", label: "Contact Form" },
      { href: "/newsletter-form", label: "Newsletter" },
      { href: "/payment-links", label: "Links" },
      { href: "/past-clients", label: "Clients" },
    ],
  },
  {
    items: [
      { href: "/settings", label: "Settings" },
      { href: "/setup", label: "Setup Guide" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({
  artistName,
  artistSubtitle,
  isSuperUser = false,
}: {
  artistName: string;
  artistSubtitle: string;
  isSuperUser?: boolean;
}) {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-outline-variant/20 bg-surface-container-low flex flex-col h-screen sticky top-0">
      <div className="p-6 pb-4 overflow-y-auto flex-1">
        <Link href="/" className="flex items-center gap-3 mb-8">
          <img src="/logo.png" alt="FlashBooker logo" className="w-9 h-9 object-contain" />
          <div className="min-w-0">
            <p className="text-base font-heading font-bold tracking-tight text-on-surface truncate">{artistName}</p>
            <p className="text-xs text-on-surface-variant truncate">{artistSubtitle}</p>
          </div>
        </Link>

        <nav className="space-y-5">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <p className="text-[10px] font-semibold text-on-surface-variant/50 uppercase tracking-wider px-3 mb-1.5">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
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
                                    ? "flex items-center px-3 py-2 text-sm font-medium rounded-lg text-primary bg-primary/5"
                                    : "flex items-center px-3 py-2 text-sm font-medium rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
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
              </div>
              {gi < NAV_GROUPS.length - 1 && (
                <div className="mt-4 h-px bg-outline-variant/15" />
              )}
            </div>
          ))}

          {isSuperUser && (
            <>
              <div className="h-px bg-outline-variant/20" />
              <Link
                href="/admin"
                className={
                  pathname.startsWith("/admin")
                    ? "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg bg-surface-container-lowest text-primary shadow-sm"
                    : "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
                }
              >
                Superuser
              </Link>
            </>
          )}
        </nav>
      </div>

      <div className="p-4 border-t border-outline-variant/15 shrink-0">
        <form action={signOut}>
          <button
            type="submit"
            className="w-full text-left px-3 py-2.5 text-sm font-medium rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
          >
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  );
}
