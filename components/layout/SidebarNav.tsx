"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useEffect, useLayoutEffect, useState } from "react";
import { signOut } from "@/app/actions/auth";
import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  Inbox,
  BarChart2,
  Users,
  Link2,
  FileText,
  MessageSquare,
  Mail,
  Settings,
  HelpCircle,
  ShieldAlert,
  LogOut,
  ChevronLeft,
  ChevronRight,
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
      { href: "/inbox",     label: "Inbox",        icon: Inbox },
      { href: "/analytics", label: "Analytics",    icon: BarChart2 },
    ],
  },
  {
    label: "Studio",
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
      { href: "/newsletter-form", label: "Newsletter",    icon: Mail },
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
}: {
  artistName: string;
  artistSubtitle: string;
  isSuperUser?: boolean;
}) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Initialise from localStorage; auto-collapse on tablet on first visit
  useLayoutEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setCollapsed(stored === "true");
      } else if (window.innerWidth < 1024) {
        setCollapsed(true);
      }
    } catch {}
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
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

  return (
    <aside
      className={`${
        collapsed ? "w-[58px]" : "w-56"
      } border-r border-outline-variant/20 bg-surface-container-low flex flex-col h-screen sticky top-0 shrink-0 transition-[width] duration-200`}
    >
      {/* Logo + collapse toggle */}
      <div className={`flex items-center border-b border-outline-variant/10 shrink-0 h-16 ${collapsed ? "justify-center px-0" : "px-4 justify-between"}`}>
        {collapsed ? (
          <button
            type="button"
            onClick={toggleCollapsed}
            title="Expand sidebar"
            className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-surface-container-high transition-colors"
          >
            <img src="/logo.png" alt="FlashBooker" className="w-9 h-9 object-contain" />
          </button>
        ) : (
          <>
            <Link href="/" className="flex items-center gap-2.5 min-w-0 flex-1">
              <img src="/logo.png" alt="FlashBooker logo" className="w-11 h-11 object-contain shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-heading font-bold tracking-tight text-on-surface truncate leading-tight">{artistName}</p>
                <p className="text-[11px] text-on-surface-variant truncate leading-tight">{artistSubtitle}</p>
              </div>
            </Link>
            <button
              type="button"
              onClick={toggleCollapsed}
              title="Collapse sidebar"
              className="shrink-0 p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors ml-1"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Nav */}
      <div ref={scrollRef} className={`overflow-y-auto flex-1 py-4 ${collapsed ? "px-2" : "px-3"}`}>
        <nav className="space-y-4">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi}>
              {group.label && !collapsed && (
                <p className="text-[10px] font-semibold text-on-surface-variant/50 uppercase tracking-wider px-3 mb-1.5">
                  {group.label}
                </p>
              )}
              {group.label && collapsed && (
                <div className="h-px bg-outline-variant/15 mx-1 mb-2" />
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
                        className={`flex items-center rounded-lg transition-colors ${
                          collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
                        } ${
                          active
                            ? "bg-surface-container-lowest text-primary shadow-sm"
                            : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                        }`}
                      >
                        <Icon className="w-[18px] h-[18px] shrink-0" />
                        {!collapsed && (
                          <span className="text-sm font-medium truncate">{item.label}</span>
                        )}
                      </Link>

                      {expanded && !collapsed && item.children && (
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
              {gi < NAV_GROUPS.length - 1 && !collapsed && (
                <div className="mt-4 h-px bg-outline-variant/15" />
              )}
            </div>
          ))}

          {isSuperUser && (
            <>
              <div className="h-px bg-outline-variant/20 mx-1" />
              <Link
                href="/admin"
                title={collapsed ? "Superuser" : undefined}
                className={`flex items-center rounded-lg transition-colors ${
                  collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
                } ${
                  pathname.startsWith("/admin")
                    ? "bg-surface-container-lowest text-primary shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                <ShieldAlert className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && <span className="text-sm font-medium">Superuser</span>}
              </Link>
            </>
          )}
        </nav>
      </div>

      {/* Sign out + expand toggle when collapsed */}
      <div className={`border-t border-outline-variant/15 shrink-0 ${collapsed ? "p-2" : "p-3"}`}>
        {collapsed ? (
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={toggleCollapsed}
              title="Expand sidebar"
              className="flex items-center justify-center p-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
            >
              <ChevronRight className="w-[18px] h-[18px]" />
            </button>
            <form action={signOut}>
              <button
                type="submit"
                title="Sign Out"
                className="w-full flex items-center justify-center p-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
              >
                <LogOut className="w-[18px] h-[18px]" />
              </button>
            </form>
          </div>
        ) : (
          <form action={signOut}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
            >
              <LogOut className="w-[18px] h-[18px] shrink-0" />
              Sign Out
            </button>
          </form>
        )}
      </div>
    </aside>
  );
}
