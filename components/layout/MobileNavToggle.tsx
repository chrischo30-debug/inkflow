"use client";

import { Menu } from "lucide-react";
import { setMobileNavOpen } from "@/lib/mobile-nav";

export function MobileNavToggle() {
  return (
    <button
      type="button"
      onClick={() => setMobileNavOpen(true)}
      aria-label="Open navigation menu"
      className="md:hidden -ml-2 p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
    >
      <Menu className="w-5 h-5" />
    </button>
  );
}
