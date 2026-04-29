"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useEffect, useLayoutEffect, useState } from "react";
import { useMobileNavOpen, setMobileNavOpen } from "@/lib/mobile-nav";
import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  BarChart2,
  Users,
  Link2,
  FileText,
  MessageSquare,
  Settings,
  HelpCircle,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  X,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  children?: { href: string; label: string }[];
};

type NavGroup = {
  label?: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: "/",          label: "Dashboard",    icon: LayoutDashboard },
      { href: "/bookings",  label: "Bookings",     icon: BookOpen },
      { href: "/calendar",  label: "Calendar",     icon: CalendarDays },
      { href: "/analytics", label: "Analytics",    icon: BarChart2 },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/past-clients",    label: "Clients",       icon: Users },
      { href: "/payment-links",   label: "Links",         icon: Link2 },
      {
        href: "/form-builder",
        label: "Booking Form",
        icon: FileText,
        children: [
          { href: "/form-builder",          label: "Form Fields" },
          { href: "/form-builder/settings", label: "Page Settings" },
          { href: "/form-builder/books",    label: "Closed Books" },
        ],
      },
      { href: "/contact-form",    label: "Contact Form",  icon: MessageSquare },
    ],
  },
  {
    items: [
      { href: "/settings", label: "Settings",    icon: Settings },
      { href: "/setup",    label: "Setup Guide", icon: HelpCircle },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const STORAGE_KEY = "sidebar-collapsed";

export function SidebarNav({
  artistName,
  artistSubtitle,
  isSuperUser = false,
  initialCollapsed = false,
}: {
  artistName: string;
  artistSubtitle: string;
  isSuperUser?: boolean;
  initialCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const mobileOpen = useMobileNavOpen();

  // Close mobile drawer on navigation. Desktop is unaffected.
  useEffect(() => { setMobileNavOpen(false); }, [pathname]);

  // Close mobile drawer on Escape.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileNavOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
      // Persist in a cookie too so the server can render the right width
      // on the next navigation — prevents a flash of the default state.
      document.cookie = `sidebar_collapsed=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      return next;
    });
  };

  // Restore sidebar scroll position
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    try {
      const saved = sessionStorage.getItem("sidebar-scroll");
      if (saved) el.scrollTop = parseInt(saved, 10);
    } catch {}
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const save = () => {
      try { sessionStorage.setItem("sidebar-scroll", String(el.scrollTop)); } catch {}
    };
    el.addEventListener("scroll", save, { passive: true });
    return () => { save(); el.removeEventListener("scroll", save); };
  }, []);

  // On mobile (`<md`), the sidebar is an off-canvas drawer toggled by
  // MobileNavToggle in the page header. On desktop it behaves as before
  // (sticky in flex layout, expand/collapse via the bottom toggle).
  const desktopWidth = collapsed ? "md:w-[58px]" : "md:w-56";
  const mobileTransform = mobileOpen ? "translate-x-0" : "-translate-x-full";

  return (
    <>
      {/* Backdrop — only when mobile drawer is open */}
      {mobileOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-64 ${mobileTransform} transition-transform duration-200 md:sticky md:translate-x-0 md:transform-none md:z-auto md:w-56 md:transition-[width] ${desktopWidth} border-r border-outline-variant/20 bg-surface-container-low flex flex-col shrink-0`}
      >
      {/* Logo */}
      <div className={`flex items-center border-b border-outline-variant/10 shrink-0 h-16 px-4 ${collapsed ? "md:justify-center md:px-0" : ""}`}>
        <Link href="/" className={`flex items-center min-w-0 gap-2.5 flex-1 ${collapsed ? "md:justify-center md:gap-0 md:flex-initial" : ""}`} title="Dashboard">
          <img
            src="/logo.png"
            alt="FlashBooker logo"
            className={`object-contain shrink-0 w-11 h-11 ${collapsed ? "md:w-9 md:h-9" : ""}`}
          />
          <div className={`min-w-0 ${collapsed ? "md:hidden" : ""}`}>
            <p className="text-sm font-heading font-bold tracking-tight text-on-surface truncate leading-tight">{artistName}</p>
            <p className="text-[11px] text-on-surface-variant truncate leading-tight">{artistSubtitle}</p>
          </div>
        </Link>
        {/* Mobile close button */}
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation menu"
          className="md:hidden -mr-1 p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav. On mobile the drawer is always full-width, so collapsed-only
          desktop tweaks are gated behind `md:`. */}
      <div ref={scrollRef} className={`overflow-y-auto flex-1 py-4 px-3 ${collapsed ? "md:px-2" : ""}`}>
        <nav className="space-y-4">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <>
                  <p className={`text-[10px] font-semibold text-on-surface-variant/50 uppercase tracking-wider px-3 mb-1.5 ${collapsed ? "md:hidden" : ""}`}>
                    {group.label}
                  </p>
                  {collapsed && (
                    <div className="hidden md:block h-px bg-outline-variant/15 mx-1 mb-2" />
                  )}
                </>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const expanded = "children" in item && active;
                  const Icon = item.icon;

                  return (
                    <div key={item.href}>
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={`flex items-center rounded-lg transition-colors gap-3 px-3 py-2.5 ${
                          collapsed ? "md:justify-center md:p-2.5 md:gap-0" : ""
                        } ${
                          active
                            ? "bg-surface-container-lowest text-primary shadow-sm"
                            : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                        }`}
                      >
                        <Icon className="w-[18px] h-[18px] shrink-0" />
                        <span className={`text-sm font-medium truncate ${collapsed ? "md:hidden" : ""}`}>
                          {item.label}
                        </span>
                      </Link>

                      {expanded && item.children && (
                        <div className={`mt-0.5 ml-3 pl-3 border-l border-outline-variant/30 space-y-0.5 ${collapsed ? "md:hidden" : ""}`}>
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
                <div className={`mt-4 h-px bg-outline-variant/15 ${collapsed ? "md:hidden" : ""}`} />
              )}
            </div>
          ))}

          {isSuperUser && (
            <>
              <div className="h-px bg-outline-variant/20 mx-1" />
              <Link
                href="/admin"
                title={collapsed ? "Superuser" : undefined}
                className={`flex items-center rounded-lg transition-colors gap-3 px-3 py-2.5 ${
                  collapsed ? "md:justify-center md:p-2.5 md:gap-0" : ""
                } ${
                  pathname.startsWith("/admin")
                    ? "bg-surface-container-lowest text-primary shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                <ShieldAlert className="w-[18px] h-[18px] shrink-0" />
                <span className={`text-sm font-medium ${collapsed ? "md:hidden" : ""}`}>Superuser</span>
              </Link>
            </>
          )}
        </nav>
      </div>

      {/* Desktop-only expand/collapse toggle */}
      <div className={`hidden md:block border-t-2 border-outline-variant/30 shrink-0 p-3 ${collapsed ? "md:p-2" : ""}`}>
        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`w-full flex items-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors ${
            collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5 text-sm font-medium"
          }`}
        >
          {collapsed ? (
            <ChevronRight className="w-[18px] h-[18px]" />
          ) : (
            <>
              <ChevronLeft className="w-[18px] h-[18px] shrink-0" />
              Collapse sidebar
            </>
          )}
        </button>
      </div>
      </aside>
    </>
  );
}
