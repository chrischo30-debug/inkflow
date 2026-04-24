"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, Upload, X, Plus, ChevronDown } from "lucide-react";

function ColorInput({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [text, setText] = useState(value);

  if (text !== value && document.activeElement?.getAttribute("data-color-hex") !== "true") {
    setText(value);
  }

  const commit = (raw: string) => {
    const hex = raw.startsWith("#") ? raw : `#${raw}`;
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) onChange(hex);
  };

  return (
    <label className="flex items-center gap-1.5 text-xs text-on-surface-variant cursor-pointer">
      <input
        type="color"
        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
        onChange={(e) => { onChange(e.target.value); setText(e.target.value); }}
        className="w-7 h-7 rounded cursor-pointer border border-outline-variant/30 p-0.5"
      />
      <input
        data-color-hex="true"
        type="text"
        value={text}
        maxLength={7}
        onChange={(e) => { setText(e.target.value); commit(e.target.value); }}
        onBlur={(e) => { const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`; if (/^#[0-9a-fA-F]{6}$/.test(v)) { onChange(v); setText(v); } else { setText(value); } }}
        className="w-20 rounded border border-outline-variant/40 bg-surface px-2 py-1 text-xs font-mono text-on-surface focus:outline-none focus:border-primary"
        placeholder="#000000"
        spellCheck={false}
      />
    </label>
  );
}

type Platform = "instagram" | "tiktok" | "twitter" | "facebook" | "other";
type Layout = "centered" | "banner" | "minimal" | "full";
type HeaderAlign = "left" | "center";

interface SocialLink { platform: Platform; url: string; label?: string; }

export interface BookingPageConfig {
  booking_bg_color: string;
  booking_bg_image_url: string | null;
  booking_layout: Layout;
  booking_font: string;
  booking_text_color: string;
  booking_button_color?: string;
  booking_label_color?: string;
  logo_url: string | null;
  website_url: string;
  social_links: SocialLink[];
  show_social_on_booking: boolean;
  booking_font_scale?: string;
  booking_header_size?: string;
  booking_header_align?: HeaderAlign;
}

function autoTextColor(hex: string): "dark" | "light" {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "dark" : "light";
}

// Legacy enum → font family name
const LEGACY_FONT_MAP: Record<string, string> = {
  sans: "Manrope",
  serif: "Cormorant Garamond",
  mono: "Space Mono",
  display: "Bebas Neue",
  playfair: "Playfair Display",
  script: "Dancing Script",
};

// Legacy enum → px
const LEGACY_HEADER_PX: Record<string, number> = { sm: 28, md: 36, lg: 44, xl: 54, "2xl": 68 };
const LEGACY_FORM_PX: Record<string, number> = { small: 15, base: 17, large: 20 };

function normalizeFont(val: string | undefined): string {
  if (!val) return "Manrope";
  return LEGACY_FONT_MAP[val] ?? val;
}
function normalizeHeaderPx(val: string | undefined): number {
  if (!val) return 36;
  if (LEGACY_HEADER_PX[val] !== undefined) return LEGACY_HEADER_PX[val];
  const n = parseInt(val);
  return isNaN(n) ? 36 : Math.max(18, Math.min(72, n));
}
function normalizeFormPx(val: string | undefined): number {
  if (!val) return 17;
  if (LEGACY_FORM_PX[val] !== undefined) return LEGACY_FORM_PX[val];
  const n = parseInt(val);
  return isNaN(n) ? 17 : Math.max(12, Math.min(20, n));
}

const FONT_CATEGORIES: { category: string; fonts: string[] }[] = [
  { category: "Sans-serif",   fonts: ["Manrope", "Inter", "Outfit", "DM Sans", "Nunito", "Raleway", "Montserrat", "Poppins"] },
  { category: "Serif",        fonts: ["Cormorant Garamond", "Playfair Display", "Lora", "EB Garamond", "Libre Baskerville", "Merriweather"] },
  { category: "Display",      fonts: ["Bebas Neue", "Anton", "Oswald", "Righteous", "Cinzel", "Abril Fatface"] },
  { category: "Handwritten",  fonts: ["Dancing Script", "Pacifico", "Caveat", "Sacramento", "Satisfy"] },
  { category: "Mono",         fonts: ["Space Mono", "Courier Prime"] },
];

// Single batch URL loading all preview fonts
const PREVIEW_FONTS_URL =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Manrope:wght@400;700",
    "family=Inter:wght@400;700",
    "family=Outfit:wght@400;700",
    "family=DM+Sans:wght@400;700",
    "family=Nunito:wght@400;700",
    "family=Raleway:wght@400;700",
    "family=Montserrat:wght@400;700",
    "family=Poppins:wght@400;700",
    "family=Cormorant+Garamond:wght@400;700",
    "family=Playfair+Display:wght@400;700",
    "family=Lora:wght@400;700",
    "family=EB+Garamond:wght@400;700",
    "family=Libre+Baskerville:wght@400;700",
    "family=Merriweather:wght@400;700",
    "family=Bebas+Neue",
    "family=Anton",
    "family=Oswald:wght@400;700",
    "family=Righteous",
    "family=Cinzel:wght@400;700",
    "family=Abril+Fatface",
    "family=Dancing+Script:wght@400;700",
    "family=Pacifico",
    "family=Caveat:wght@400;700",
    "family=Sacramento",
    "family=Satisfy",
    "family=Space+Mono:wght@400;700",
    "family=Courier+Prime:wght@400;700",
  ].join("&") + "&display=swap";

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok",    label: "TikTok" },
  { id: "twitter",   label: "Twitter / X" },
  { id: "facebook",  label: "Facebook" },
  { id: "other",     label: "Other" },
];

const LAYOUTS: { id: Exclude<Layout, "full">; label: string; desc: string }[] = [
  { id: "minimal",  label: "Minimal",  desc: "Clean, no card, left-aligned" },
  { id: "centered", label: "Centered", desc: "Card centered on background" },
  { id: "banner",   label: "Split",    desc: "Info on left, form on right" },
];

const BG_PRESETS = [
  // Light
  "#ffffff", "#fdf8f2", "#f5f5f5", "#f0f4f0", "#f0f5ff", "#fff0f3",
  // Dark — rich varied tones
  "#000000", "#0f172a", "#1e1b4b", "#14532d", "#7f1d1d", "#1c1917",
];

const ACCENT_PRESETS = [
  "#1a1c22", "#9b1b1b", "#c4820a", "#1a6b3c", "#6b1a6b", "#0a4e8f", "#b5341a", "#3d3d3d",
];

const LayoutPreview = ({ id }: { id: Layout }) => {
  if (id === "centered") return (
    <div className="w-full h-14 rounded bg-surface-container-high flex flex-col items-center justify-center gap-1 p-1">
      <div className="w-8 h-1 bg-outline-variant/60 rounded" />
      <div className="w-full max-w-[70%] h-8 bg-surface-container-lowest rounded border border-outline-variant/30" />
    </div>
  );
  if (id === "banner") return (
    <div className="w-full h-14 rounded overflow-hidden flex gap-1 p-1">
      <div className="w-2/5 bg-outline-variant/40 rounded flex flex-col justify-center gap-1 p-1">
        <div className="w-full h-1 bg-surface-container-lowest/60 rounded" />
        <div className="w-3/4 h-1 bg-surface-container-lowest/40 rounded" />
      </div>
      <div className="flex-1 bg-surface-container-high rounded space-y-1 p-1">
        <div className="w-full h-1.5 bg-outline-variant/30 rounded" />
        <div className="w-full h-1.5 bg-outline-variant/30 rounded" />
        <div className="w-3/4 h-1.5 bg-outline-variant/30 rounded" />
      </div>
    </div>
  );
  // minimal
  return (
    <div className="w-full h-14 rounded bg-surface-container-high p-1.5 flex flex-col justify-between">
      <div className="w-6 h-1 bg-outline-variant/60 rounded" />
      <div className="space-y-1">
        <div className="w-full h-1.5 bg-outline-variant/30 rounded" />
        <div className="w-2/3 h-1.5 bg-outline-variant/30 rounded" />
      </div>
    </div>
  );
};

export function BookingPageSettings({ initial, onPreviewReady }: { initial: BookingPageConfig; onPreviewReady?: (open: () => void) => void }) {
  const [bgColor, setBgColor]       = useState(initial.booking_bg_color || "#ffffff");
  const [bgImageUrl, setBgImageUrl] = useState(initial.booking_bg_image_url || null);
  const [layout, setLayout]         = useState<Layout>(() => initial.booking_layout === "full" ? "minimal" : (initial.booking_layout || "minimal"));
  const [font, setFont]             = useState(() => normalizeFont(initial.booking_font));
  const [headerSizePx, setHeaderSizePx] = useState(() => normalizeHeaderPx(initial.booking_header_size));
  const [formSizePx, setFormSizePx]     = useState(() => normalizeFormPx(initial.booking_font_scale));
  const [headerAlign, setHeaderAlign] = useState<HeaderAlign>(initial.booking_header_align || "left");
  const [textColor, setTextColor]   = useState<string>(initial.booking_text_color || autoTextColor(initial.booking_bg_color || "#ffffff"));
  const [textColorLocked, setTextColorLocked] = useState(!!initial.booking_text_color);
  const [buttonColor, setButtonColor] = useState<string>(initial.booking_button_color || "#1a1c22");
  const [labelColor, setLabelColor] = useState<string>(initial.booking_label_color || "#666666");
  const [logoUrl, setLogoUrl]       = useState(initial.logo_url || null);
  const [websiteUrl, setWebsiteUrl] = useState(initial.website_url || "");
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(initial.social_links || []);
  const [showSocial, setShowSocial] = useState(initial.show_social_on_booking || false);
  const [saving, setSaving]         = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [saveError, setSaveError]   = useState("");
  const [uploadingLogo, setUploadingLogo]   = useState(false);
  const [uploadingBg, setUploadingBg]       = useState(false);
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const [fontSearch, setFontSearch] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef   = useRef<HTMLInputElement>(null);
  const openPreviewRef = useRef<() => void>(() => {});

  const fontFamilyCss = `'${font}', sans-serif`;

  const filteredCategories = fontSearch.trim()
    ? FONT_CATEGORIES.map(cat => ({
        ...cat,
        fonts: cat.fonts.filter(f => f.toLowerCase().includes(fontSearch.toLowerCase())),
      })).filter(cat => cat.fonts.length > 0)
    : FONT_CATEGORIES;

  const uploadFile = async (file: File, endpoint: string) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(endpoint, { method: "POST", body: fd });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Upload failed");
    return body.url as string;
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try { setLogoUrl(await uploadFile(file, "/api/uploads/logo")); } catch { /* ignore */ }
    setUploadingLogo(false);
    e.target.value = "";
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBg(true);
    try { setBgImageUrl(await uploadFile(file, "/api/uploads/booking-bg")); } catch { /* ignore */ }
    setUploadingBg(false);
    e.target.value = "";
  };

  const addSocialLink = () => setSocialLinks(prev => [...prev, { platform: "instagram", url: "" }]);
  const removeSocialLink = (i: number) => setSocialLinks(prev => prev.filter((_, idx) => idx !== i));
  const updateSocialLink = (i: number, patch: Partial<SocialLink>) =>
    setSocialLinks(prev => prev.map((link, idx) => idx === i ? { ...link, ...patch } : link));

  const openPreview = () => {
    const state = {
      booking_bg_color: bgColor,
      booking_bg_image_url: bgImageUrl,
      booking_layout: layout,
      booking_font: font,
      booking_font_scale: String(formSizePx),
      booking_header_size: String(headerSizePx),
      booking_header_align: headerAlign,
      booking_text_color: textColor,
      booking_button_color: buttonColor,
      booking_label_color: labelColor,
      logo_url: logoUrl,
      website_url: websiteUrl,
      social_links: socialLinks,
      show_social_on_booking: showSocial,
    };
    window.open(`/form-builder/preview?s=${btoa(JSON.stringify(state))}`, "_blank");
  };

  openPreviewRef.current = openPreview;
  useEffect(() => { onPreviewReady?.(() => openPreviewRef.current()); }, []);

  const save = async () => {
    setSaving(true);
    setSaveStatus("idle");
    setSaveError("");
    const ensureHttp = (url: string) =>
      url && !url.match(/^https?:\/\//) ? `https://${url}` : url;
    const validLinks = socialLinks
      .filter(l => l.url.trim())
      .map(l => ({ ...l, url: ensureHttp(l.url.trim()) }));
    const res = await fetch("/api/artist/booking-page", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        booking_bg_color: bgColor,
        booking_bg_image_url: bgImageUrl || null,
        booking_layout: layout,
        booking_font: font,
        booking_font_scale: String(formSizePx),
        booking_header_size: String(headerSizePx),
        booking_header_align: headerAlign,
        booking_text_color: textColor,
        booking_button_color: buttonColor,
        booking_label_color: labelColor,
        logo_url: logoUrl || null,
        website_url: ensureHttp(websiteUrl.trim()),
        social_links: validLinks,
        show_social_on_booking: showSocial,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } else {
      const body = await res.json().catch(() => ({}));
      setSaveError(body.error ?? `HTTP ${res.status}`);
      setSaveStatus("error");
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-8 shadow-sm space-y-8">
      {/* Load all preview fonts once */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={PREVIEW_FONTS_URL} />

      <div>
        <h3 className="text-lg font-heading font-semibold mb-1 text-on-surface">Booking Page</h3>
        <p className="text-sm text-on-surface-variant leading-relaxed">
          Customize how your public booking form looks and what it shows.
        </p>
      </div>

      {/* Logo */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-on-surface">Logo</h4>
        <div className="flex items-center gap-4">
          {logoUrl && (
            <div className="relative group">
              <img src={logoUrl} alt="Logo" className="h-14 w-auto max-w-[140px] object-contain rounded border border-outline-variant/30 bg-surface p-1" />
              <button type="button" onClick={() => setLogoUrl(null)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-surface border border-outline-variant/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="w-3 h-3 text-on-surface-variant" />
              </button>
            </div>
          )}
          <input ref={logoInputRef} type="file" accept="image/*" className="sr-only" onChange={handleLogoUpload} />
          <button type="button" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-outline-variant/40 text-sm text-on-surface-variant hover:border-outline-variant hover:text-on-surface transition-colors">
            <Upload className="w-3.5 h-3.5" />
            {uploadingLogo ? "Uploading…" : logoUrl ? "Replace" : "Upload logo"}
          </button>
        </div>
        <p className="text-xs text-on-surface-variant">PNG or SVG with transparent background works best. Max 5MB.</p>
      </section>

      {/* Layout */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-on-surface">Layout</h4>
        <div className="grid grid-cols-3 gap-3">
          {LAYOUTS.map(l => {
            const isSelected = layout === l.id;
            const isMinimal = l.id === "minimal";
            return (
              <div
                key={l.id}
                onClick={() => setLayout(l.id)}
                className={`flex flex-col gap-2 p-3 rounded-xl border-2 text-left transition-all cursor-pointer select-none ${
                  isSelected ? "border-primary/60 bg-primary/5" : "border-outline-variant/20 hover:border-outline-variant/50"
                }`}
              >
                <LayoutPreview id={l.id} />
                <div>
                  <p className="text-xs font-semibold text-on-surface">{l.label}</p>
                  <p className="text-[11px] text-on-surface-variant leading-tight">{l.desc}</p>
                </div>
                {isMinimal && (
                  <div
                    className="border-t border-outline-variant/15 pt-2 mt-0.5"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      role="switch"
                      aria-checked={headerAlign === "center"}
                      onClick={() => {
                        if (!isSelected) setLayout("minimal");
                        setHeaderAlign(v => v === "center" ? "left" : "center");
                      }}
                      className="flex items-center gap-1.5 w-full cursor-pointer"
                    >
                      <span className={`relative w-7 h-4 rounded-full transition-colors shrink-0 ${headerAlign === "center" && isSelected ? "bg-primary" : "bg-outline-variant/40"}`}>
                        <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${headerAlign === "center" && isSelected ? "translate-x-3" : "translate-x-0"}`} />
                      </span>
                      <span className="text-[11px] text-on-surface-variant leading-none">Center header</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Font */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-on-surface">Font</h4>
        <button type="button" onClick={() => { setFontPickerOpen(v => !v); setFontSearch(""); }}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
            fontPickerOpen ? "border-primary/60 bg-primary/5" : "border-outline-variant/30 hover:border-primary/40"
          }`}>
          <span className="text-base text-on-surface truncate" style={{ fontFamily: fontFamilyCss }}>{font}</span>
          <ChevronDown className={`w-4 h-4 text-on-surface-variant shrink-0 ml-2 transition-transform ${fontPickerOpen ? "rotate-180" : ""}`} />
        </button>

        {fontPickerOpen && (
          <div className="rounded-xl border border-outline-variant/20 overflow-hidden shadow-sm">
            <div className="p-2 border-b border-outline-variant/15 bg-surface-container-high">
              <input type="text" placeholder="Search fonts…" value={fontSearch}
                onChange={e => setFontSearch(e.target.value)} autoFocus
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-outline-variant/30 bg-surface focus:outline-none focus:border-primary" />
            </div>
            <div className="overflow-y-auto max-h-72">
              {filteredCategories.length === 0 ? (
                <p className="px-4 py-4 text-sm text-on-surface-variant text-center">No fonts match "{fontSearch}"</p>
              ) : filteredCategories.map(({ category, fonts }) => (
                <div key={category}>
                  <div className="sticky top-0 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant bg-surface-container-high border-b border-outline-variant/10">
                    {category}
                  </div>
                  {fonts.map(name => (
                    <button key={name} type="button"
                      onClick={() => { setFont(name); setFontPickerOpen(false); setFontSearch(""); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-container-high ${
                        font === name ? "bg-primary/5" : ""
                      }`}>
                      <span className="text-base text-on-surface flex-1 truncate"
                        style={{ fontFamily: `'${name}', sans-serif` }}>
                        Book a tattoo
                      </span>
                      <span className="text-xs text-on-surface-variant shrink-0">{name}</span>
                      {font === name && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Header Size */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-on-surface">Header Size</h4>
        <div className="rounded-xl border border-outline-variant/20 p-4 space-y-3">
          <div className="overflow-hidden h-12 flex items-center">
            <span className="font-bold leading-none text-on-surface truncate"
              style={{ fontSize: Math.min(headerSizePx, 48) + "px", fontFamily: fontFamilyCss }}>
              Book a Tattoo
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input type="range" min={18} max={72} step={2} value={headerSizePx}
              onChange={e => setHeaderSizePx(Number(e.target.value))}
              className="flex-1 accent-primary" />
            <div className="flex items-center gap-1 shrink-0">
              <input type="number" min={18} max={72} step={1} value={headerSizePx}
                onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) setHeaderSizePx(Math.max(18, Math.min(72, v))); }}
                className="w-14 rounded-lg border border-outline-variant/40 bg-surface px-2 py-1.5 text-sm text-center font-mono focus:outline-none focus:border-primary" />
              <span className="text-xs text-on-surface-variant">px</span>
            </div>
          </div>
        </div>
      </section>

      {/* Form Text Size */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-on-surface">Form Text Size</h4>
        <div className="rounded-xl border border-outline-variant/20 p-4 space-y-3">
          <div className="flex items-baseline gap-4">
            <span className="font-semibold text-on-surface leading-none" style={{ fontSize: formSizePx + "px" }}>Field label</span>
            <span className="text-on-surface-variant" style={{ fontSize: formSizePx + "px" }}>Input text</span>
          </div>
          <div className="flex items-center gap-3">
            <input type="range" min={12} max={20} step={1} value={formSizePx}
              onChange={e => setFormSizePx(Number(e.target.value))}
              className="flex-1 accent-primary" />
            <div className="flex items-center gap-1 shrink-0">
              <input type="number" min={12} max={20} step={1} value={formSizePx}
                onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) setFormSizePx(Math.max(12, Math.min(20, v))); }}
                className="w-14 rounded-lg border border-outline-variant/40 bg-surface px-2 py-1.5 text-sm text-center font-mono focus:outline-none focus:border-primary" />
              <span className="text-xs text-on-surface-variant">px</span>
            </div>
          </div>
        </div>
      </section>

      {/* Colors */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-on-surface">Colors</h4>
        <div className="rounded-xl border border-outline-variant/20 divide-y divide-outline-variant/20 overflow-hidden">

          {/* Background */}
          <div className="flex items-start gap-4 px-4 py-3">
            <span className="text-xs font-semibold text-on-surface-variant w-16 shrink-0 pt-0.5">Background</span>
            <div className="flex items-center gap-2 flex-wrap flex-1">
              {BG_PRESETS.map(color => (
                <button key={color} type="button"
                  onClick={() => { setBgColor(color); setBgImageUrl(null); if (!textColorLocked) setTextColor(autoTextColor(color)); }}
                  className={`w-6 h-6 rounded-full border-2 transition-all shrink-0 ${
                    bgColor === color && !bgImageUrl ? "border-on-surface scale-110" : "border-outline-variant/30 hover:border-outline-variant"
                  }`}
                  style={{ backgroundColor: color }} title={color} />
              ))}
              <ColorInput value={bgColor}
                onChange={hex => { setBgColor(hex); setBgImageUrl(null); if (!textColorLocked) setTextColor(autoTextColor(hex)); }} />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {bgImageUrl && (
                <div className="relative group">
                  <img src={bgImageUrl} alt="Background" className="h-8 w-12 object-cover rounded border border-outline-variant/30" />
                  <button type="button" onClick={() => setBgImageUrl(null)}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-surface border border-outline-variant/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-2.5 h-2.5 text-on-surface-variant" />
                  </button>
                </div>
              )}
              <input ref={bgInputRef} type="file" accept="image/*" className="sr-only" onChange={handleBgUpload} />
              <button type="button" onClick={() => bgInputRef.current?.click()} disabled={uploadingBg}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-outline-variant/40 text-xs text-on-surface-variant hover:border-outline-variant hover:text-on-surface transition-colors">
                <Upload className="w-3 h-3" />
                {uploadingBg ? "Uploading…" : bgImageUrl ? "Replace" : "Image"}
              </button>
            </div>
          </div>

          {/* Page Text */}
          <div className="flex items-center gap-4 px-4 py-3">
            <span className="text-xs font-semibold text-on-surface-variant w-16 shrink-0">Page text</span>
            <div className="flex items-center gap-2 flex-1">
              {["#111111", "#ffffff"].map(color => {
                const isSelected = textColor === color || textColor === (color === "#111111" ? "dark" : "light");
                return (
                  <button key={color} type="button"
                    onClick={() => { setTextColor(color); setTextColorLocked(true); }}
                    className={`w-6 h-6 rounded-full border-2 transition-all shrink-0 ${
                      isSelected ? "border-on-surface scale-110" : "border-outline-variant/30 hover:border-outline-variant"
                    }`}
                    style={{ backgroundColor: color }} title={color === "#111111" ? "Dark" : "Light"} />
                );
              })}
              <ColorInput
                value={textColor === "dark" ? "#111111" : textColor === "light" ? "#ffffff" : textColor}
                onChange={hex => { setTextColor(hex); setTextColorLocked(true); }} />
            </div>
            {textColorLocked && (
              <button type="button"
                onClick={() => { setTextColorLocked(false); setTextColor(autoTextColor(bgColor)); }}
                className="text-xs text-on-surface-variant hover:text-on-surface transition-colors shrink-0">
                Auto
              </button>
            )}
          </div>

          {/* Labels */}
          <div className="flex items-center gap-4 px-4 py-3">
            <span className="text-xs font-semibold text-on-surface-variant w-16 shrink-0">Labels</span>
            <div className="flex items-center gap-2 flex-1">
              {["#444444", "#666666", "#888888", "#aaaaaa"].map(color => (
                <button key={color} type="button"
                  onClick={() => setLabelColor(color)}
                  className={`w-6 h-6 rounded-full border-2 transition-all shrink-0 ${
                    labelColor === color ? "border-on-surface scale-110" : "border-outline-variant/30 hover:border-outline-variant"
                  }`}
                  style={{ backgroundColor: color }} title={color} />
              ))}
              <ColorInput value={labelColor} onChange={setLabelColor} />
            </div>
            {labelColor !== "#666666" && (
              <button type="button" onClick={() => setLabelColor("#666666")}
                className="text-xs text-on-surface-variant hover:text-on-surface transition-colors shrink-0">
                Reset
              </button>
            )}
          </div>

          {/* Button */}
          <div className="flex items-start gap-4 px-4 py-3">
            <span className="text-xs font-semibold text-on-surface-variant w-16 shrink-0 pt-0.5">Button</span>
            <div className="flex items-center gap-2 flex-wrap flex-1">
              {ACCENT_PRESETS.map(color => (
                <button key={color} type="button" onClick={() => setButtonColor(color)}
                  className={`w-6 h-6 rounded-full border-2 transition-all shrink-0 ${
                    buttonColor === color ? "border-on-surface scale-110" : "border-outline-variant/30 hover:border-outline-variant"
                  }`}
                  style={{ backgroundColor: color }} title={color} />
              ))}
              <ColorInput value={buttonColor} onChange={setButtonColor} />
            </div>
            {buttonColor !== "#1a1c22" && (
              <button type="button" onClick={() => setButtonColor("#1a1c22")}
                className="text-xs text-on-surface-variant hover:text-on-surface transition-colors shrink-0">
                Reset
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-on-surface-variant">Button color applies to the submit button, input focus ring, and interactive elements.</p>
      </section>

      {/* Links */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-on-surface">Links</h4>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Website</p>
          <input className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
            value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)}
            placeholder="https://yourwebsite.com" type="url" />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Social Links</p>
          {socialLinks.map((link, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <select value={link.platform}
                  onChange={e => updateSocialLink(i, { platform: e.target.value as Platform, label: "" })}
                  className="rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary">
                  {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                <input className="flex-1 rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  value={link.url} onChange={e => updateSocialLink(i, { url: e.target.value })}
                  placeholder="https://..." type="url" />
                <button type="button" onClick={() => removeSocialLink(i)}
                  className="p-1.5 rounded-lg text-on-surface-variant hover:text-destructive hover:bg-destructive/10 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {link.platform === "other" && (
                <input className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  value={link.label ?? ""} onChange={e => updateSocialLink(i, { label: e.target.value })}
                  placeholder="Button label (e.g. My Website)" />
              )}
            </div>
          ))}
          <button type="button" onClick={addSocialLink}
            className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-on-surface transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add social link
          </button>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <button type="button" role="switch" aria-checked={showSocial}
            onClick={() => setShowSocial(v => !v)}
            className={`relative flex w-9 h-5 rounded-full transition-colors shrink-0 ${showSocial ? "bg-primary" : "bg-outline-variant/35"}`}>
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${showSocial ? "translate-x-4" : ""}`} />
          </button>
          <span className="text-sm text-on-surface">Show links on booking form</span>
        </label>
      </section>

      {saveStatus === "success" && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-300/50 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          <Check className="w-4 h-4 shrink-0" /> Booking page saved.
        </div>
      )}
      {saveStatus === "error" && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          Failed to save: {saveError || "Please try again."}
        </div>
      )}

      <div className="pt-6">
        <Button type="button" onClick={save} disabled={saving}
          className="w-full h-auto py-3 text-sm font-medium rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-sm hover:opacity-90 transition-opacity">
          {saving ? "Saving…" : "Save Booking Page"}
        </Button>
      </div>
    </div>
  );
}
