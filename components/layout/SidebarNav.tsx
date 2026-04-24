"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useEffect, useLayoutEffect, useState } from "react";
import { signOut } from "@/app/actions/auth";
import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
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

  return (
    <aside
      className={`${
        collapsed ? "w-[58px]" : "w-56"
      } border-r border-outline-variant/20 bg-surface-container-low flex flex-col h-screen sticky top-0 shrink-0 transition-[width] duration-200`}
    >
      {/* Logo */}
      <div className={`flex items-center border-b border-outline-variant/10 shrink-0 h-16 ${collapsed ? "justify-center px-0" : "px-4"}`}>
        <Link href="/" className={`flex items-center min-w-0 ${collapsed ? "justify-center" : "gap-2.5 flex-1"}`} title="Dashboard">
          <img
            src="/logo.png"
            alt="FlashBooker logo"
            className={`object-contain shrink-0 ${collapsed ? "w-9 h-9" : "w-11 h-11"}`}
          />
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-heading font-bold tracking-tight text-on-surface truncate leading-tight">{artistName}</p>
              <p className="text-[11px] text-on-surface-variant truncate leading-tight">{artistSubtitle}</p>
            </div>
          )}
        </Link>
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
      <div className={`border-t border-outline-variant/15 shrink-0 flex flex-col gap-1.5 ${collapsed ? "p-2" : "p-3"}`}>
        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors ${
            collapsed ? "flex items-center justify-center p-2.5" : "flex items-center gap-3 px-3 py-2.5 text-sm font-medium"
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
        <form action={signOut}>
          <button
            type="submit"
            title={collapsed ? "Sign Out" : undefined}
            className={`w-full rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors ${
              collapsed ? "flex items-center justify-center p-2.5" : "flex items-center gap-3 px-3 py-2.5 text-sm font-medium"
            }`}
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && "Sign Out"}
          </button>
        </form>
      </div>
    </aside>
  );
}
