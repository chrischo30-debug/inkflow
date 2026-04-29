"use client";

import { useState } from "react";

const THEMES = [
  { id: "crimson", label: "Crimson", primary: "#780009", container: "#9b1b1b" },
  { id: "blue",    label: "Ocean Blue", primary: "#1a5294", container: "#2568bc" },
] as const;

type ThemeId = (typeof THEMES)[number]["id"];

export function ThemeSettings({ initialTheme }: { initialTheme: ThemeId }) {
  const [selected, setSelected] = useState<ThemeId>(initialTheme);

  const apply = async (theme: ThemeId) => {
    setSelected(theme);
    document.documentElement.setAttribute("data-theme", theme);
    await fetch("/api/artist/theme", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accent_theme: theme }),
    });
  };

  return (
    <div className="flex items-center justify-between gap-3 px-4 md:px-6 py-4 bg-surface-container-lowest rounded-xl border border-outline-variant/20">
      <span className="text-sm font-medium text-on-surface">Dashboard Accent Color</span>
      <div className="flex items-center gap-2">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            type="button"
            onClick={() => apply(theme.id)}
            title={theme.label}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              selected === theme.id
                ? "border-on-surface/40 bg-surface-container shadow-sm text-on-surface"
                : "border-transparent text-on-surface-variant hover:border-outline-variant/50"
            }`}
          >
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.container})` }}
            />
            {theme.label}
          </button>
        ))}
      </div>
    </div>
  );
}
