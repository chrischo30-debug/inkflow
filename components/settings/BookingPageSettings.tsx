"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, Upload, X, Plus } from "lucide-react";

function ColorInput({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [text, setText] = useState(value);

  // Keep text in sync when value changes from outside (e.g. preset swatches)
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
type Layout = "centered" | "banner" | "minimal";
type Font = "sans" | "serif" | "mono";
type FontScale = "small" | "base" | "large";

interface SocialLink { platform: Platform; url: string; label?: string; }

export interface BookingPageConfig {
  booking_bg_color: string;
  booking_bg_image_url: string | null;
  booking_layout: Layout;
  booking_font: Font;
  booking_text_color: string;
  booking_button_color?: string;
  logo_url: string | null;
  website_url: string;
  social_links: SocialLink[];
  show_social_on_booking: boolean;
  booking_font_scale?: FontScale;
}

function autoTextColor(hex: string): "dark" | "light" {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "dark" : "light";
}

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok",    label: "TikTok" },
  { id: "twitter",   label: "Twitter / X" },
  { id: "facebook",  label: "Facebook" },
  { id: "other",     label: "Other" },
];

const LAYOUTS: { id: Layout; label: string; desc: string }[] = [
  { id: "minimal",  label: "Minimal",  desc: "Clean, no card, left-aligned" },
  { id: "centered", label: "Centered", desc: "Card centered on background" },
  { id: "banner",   label: "Split",    desc: "Info on left, form on right" },
];

const FONTS: { id: Font; label: string; sample: string; style: React.CSSProperties }[] = [
  { id: "sans",  label: "Sans-Serif",  sample: "Book a tattoo", style: {} },
  { id: "serif", label: "Serif", sample: "Book a tattoo", style: { fontFamily: "var(--font-booking-serif)" } },
  { id: "mono",  label: "Monospace",    sample: "Book a tattoo", style: { fontFamily: "var(--font-booking-mono)" } },
];

const FONT_SCALES: { id: FontScale; label: string; desc: string }[] = [
  { id: "small", label: "Small", desc: "Compact form" },
  { id: "base", label: "Medium", desc: "Default size" },
  { id: "large", label: "Large", desc: "High legibility" },
];

const BG_PRESETS = ["#ffffff", "#fdf8f2", "#f5f5f5", "#f0f4f0", "#f0f5ff", "#fff0f3"];

const LayoutPreview = ({ id }: { id: Layout }) => {
  if (id === "centered") return (
    <div className="w-full h-14 rounded bg-surface-container-high flex flex-col items-center justify-center gap-1 p-1">
      <div className="w-8 h-1 bg-outline-variant/60 rounded" />
      <div className="w-full max-w-[70%] h-8 bg-surface-container-lowest rounded border border-outline-variant/30" />
    </div>
  );
  if (id === "banner") return (
    <div className="w-full h-14 rounded overflow-hidden flex flex-col gap-0.5">
      <div className="bg-outline-variant/50 h-5 w-full rounded-t flex items-center justify-center">
        <div className="w-10 h-1 bg-surface-container-lowest/70 rounded" />
      </div>
      <div className="flex-1 bg-surface-container-high rounded-b p-1">
        <div className="w-full h-1.5 bg-outline-variant/30 rounded mb-1" />
        <div className="w-3/4 h-1.5 bg-outline-variant/30 rounded" />
      </div>
    </div>
  );
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
  const [layout, setLayout]         = useState<Layout>(initial.booking_layout || "minimal");
  const [font, setFont]             = useState<Font>(initial.booking_font || "sans");
  const [fontScale, setFontScale]   = useState<FontScale>(initial.booking_font_scale || "base");
  const [textColor, setTextColor]   = useState<string>(initial.booking_text_color || autoTextColor(initial.booking_bg_color || "#ffffff"));
  const [textColorLocked, setTextColorLocked] = useState(!!initial.booking_text_color);
  const [buttonColor, setButtonColor] = useState<string>(initial.booking_button_color || "#1a1c22");
  const [logoUrl, setLogoUrl]       = useState(initial.logo_url || null);
  const [websiteUrl, setWebsiteUrl] = useState(initial.website_url || "");
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(initial.social_links || []);
  const [showSocial, setShowSocial] = useState(initial.show_social_on_booking || false);
  const [saving, setSaving]         = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [saveError, setSaveError]   = useState("");
  const [uploadingLogo, setUploadingLogo]   = useState(false);
  const [uploadingBg, setUploadingBg]       = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef   = useRef<HTMLInputElement>(null);
  const openPreviewRef = useRef<() => void>(() => {});

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
    try {
      const url = await uploadFile(file, "/api/uploads/logo");
      setLogoUrl(url);
    } catch { /* ignore */ }
    setUploadingLogo(false);
    e.target.value = "";
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBg(true);
    try {
      const url = await uploadFile(file, "/api/uploads/booking-bg");
      setBgImageUrl(url);
    } catch { /* ignore */ }
    setUploadingBg(false);
    e.target.value = "";
  };

  const addSocialLink = () => {
    setSocialLinks((prev) => [...prev, { platform: "instagram", url: "" }]);
  };

  const removeSocialLink = (i: number) => {
    setSocialLinks((prev) => prev.filter((_, idx) => idx !== i));
  };

  const updateSocialLink = (i: number, patch: Partial<SocialLink>) => {
    setSocialLinks((prev) => prev.map((link, idx) => idx === i ? { ...link, ...patch } : link));
  };

  const openPreview = () => {
    const state = {
      booking_bg_color: bgColor,
      booking_bg_image_url: bgImageUrl,
      booking_layout: layout,
      booking_font: font,
      booking_font_scale: fontScale,
      booking_text_color: textColor,
      booking_button_color: buttonColor,
      logo_url: logoUrl,
      website_url: websiteUrl,
      social_links: socialLinks,
      show_social_on_booking: showSocial,
    };
    const encoded = btoa(JSON.stringify(state));
    window.open(`/form-builder/preview?s=${encoded}`, "_blank");
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
      .filter((l) => l.url.trim())
      .map((l) => ({ ...l, url: ensureHttp(l.url.trim()) }));
    const res = await fetch("/api/artist/booking-page", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        booking_bg_color: bgColor,
        booking_bg_image_url: bgImageUrl || null,
        booking_layout: layout,
        booking_font: font,
        booking_font_scale: fontScale,
        booking_text_color: textColor,
        booking_button_color: buttonColor,
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
          {logoUrl ? (
            <div className="relative group">
              <img src={logoUrl} alt="Logo" className="h-14 w-auto max-w-[140px] object-contain rounded border border-outline-variant/30 bg-surface p-1" />
              <button
                type="button"
                onClick={() => setLogoUrl(null)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-surface border border-outline-variant/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3 text-on-surface-variant" />
              </button>
            </div>
          ) : null}
          <input ref={logoInputRef} type="file" accept="image/*" className="sr-only" onChange={handleLogoUpload} />
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            disabled={uploadingLogo}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-outline-variant/40 text-sm text-on-surface-variant hover:border-outline-variant hover:text-on-surface transition-colors"
          >
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
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLayout(l.id)}
              className={`flex flex-col gap-2 p-3 rounded-xl border-2 text-left transition-all ${
                layout === l.id
                  ? "border-primary/60 bg-primary/5"
                  : "border-outline-variant/20 hover:border-outline-variant/50"
              }`}
            >
              <LayoutPreview id={l.id} />
              <div>
                <p className="text-xs font-semibold text-on-surface">{l.label}</p>
                <p className="text-[11px] text-on-surface-variant leading-tight">{l.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Font */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-on-surface">Font</h4>
        <div className="grid grid-cols-3 gap-3">
          {FONTS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFont(f.id)}
              className={`flex flex-col gap-1.5 p-3 rounded-xl border-2 text-left transition-all ${
                font === f.id
                  ? "border-primary/60 bg-primary/5"
                  : "border-outline-variant/20 hover:border-outline-variant/50"
              }`}
            >
              <span className="text-lg text-on-surface leading-tight" style={f.style}>{f.sample}</span>
              <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">{f.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Font Scale */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-on-surface">Base Text Size</h4>
        <div className="grid grid-cols-3 gap-3">
          {FONT_SCALES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setFontScale(s.id)}
              className={`flex flex-col gap-1 p-3 rounded-xl border-2 text-left transition-all ${
                fontScale === s.id
                  ? "border-primary/60 bg-primary/5"
                  : "border-outline-variant/20 hover:border-outline-variant/50"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-on-surface font-semibold ${s.id === 'small' ? 'text-sm' : s.id === 'large' ? 'text-lg' : 'text-base'}`}>Ag</span>
              </div>
              <p className="text-xs font-semibold text-on-surface">{s.label}</p>
              <p className="text-[11px] text-on-surface-variant leading-tight">{s.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Colors */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-on-surface">Colors</h4>
        <div className="rounded-xl border border-outline-variant/20 divide-y divide-outline-variant/20 overflow-hidden">

          {/* Background */}
          <div className="flex items-center gap-4 px-4 py-3">
            <span className="text-xs font-semibold text-on-surface-variant w-16 shrink-0">Background</span>
            <div className="flex items-center gap-2 flex-wrap flex-1">
              {BG_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => { setBgColor(color); setBgImageUrl(null); if (!textColorLocked) setTextColor(autoTextColor(color)); }}
                  className={`w-6 h-6 rounded-full border-2 transition-all shrink-0 ${
                    bgColor === color && !bgImageUrl ? "border-on-surface scale-110" : "border-outline-variant/30 hover:border-outline-variant"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
              <ColorInput
                value={bgColor}
                onChange={(hex) => { setBgColor(hex); setBgImageUrl(null); if (!textColorLocked) setTextColor(autoTextColor(hex)); }}
              />
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

          {/* Text */}
          <div className="flex items-center gap-4 px-4 py-3">
            <span className="text-xs font-semibold text-on-surface-variant w-16 shrink-0">Text</span>
            <div className="flex items-center gap-2 flex-1">
              {["#111111", "#ffffff"].map((color) => {
                const isSelected = textColor === color || textColor === (color === "#111111" ? "dark" : "light");
                return (
                  <button key={color} type="button"
                    onClick={() => { setTextColor(color); setTextColorLocked(true); }}
                    className={`w-6 h-6 rounded-full border-2 transition-all shrink-0 ${
                      isSelected ? "border-on-surface scale-110" : "border-outline-variant/30 hover:border-outline-variant"
                    }`}
                    style={{ backgroundColor: color }}
                    title={color === "#111111" ? "Dark" : "Light"}
                  />
                );
              })}
              <ColorInput
                value={textColor === "dark" ? "#111111" : textColor === "light" ? "#ffffff" : textColor}
                onChange={(hex) => { setTextColor(hex); setTextColorLocked(true); }}
              />
            </div>
            {textColorLocked && (
              <button type="button"
                onClick={() => { setTextColorLocked(false); setTextColor(autoTextColor(bgColor)); }}
                className="text-xs text-on-surface-variant hover:text-on-surface transition-colors shrink-0">
                Auto
              </button>
            )}
          </div>

          {/* Accent */}
          <div className="flex items-center gap-4 px-4 py-3">
            <span className="text-xs font-semibold text-on-surface-variant w-16 shrink-0">Accent</span>
            <div className="flex items-center gap-2 flex-1">
              {["#1a1c22", "#9b1b1b"].map((color) => (
                <button key={color} type="button"
                  onClick={() => setButtonColor(color)}
                  className={`w-6 h-6 rounded-full border-2 transition-all shrink-0 ${
                    buttonColor === color ? "border-on-surface scale-110" : "border-outline-variant/30 hover:border-outline-variant"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
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
        <p className="text-xs text-on-surface-variant">Accent color applies to buttons, borders, and interactive elements.</p>
      </section>

      {/* Links */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-on-surface">Links</h4>

        <label className="text-xs font-medium text-on-surface-variant block">
          Website
          <input
            className="mt-1 w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-sm"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://yourwebsite.com"
            type="url"
          />
        </label>

        <div className="space-y-2">
          <p className="text-xs font-medium text-on-surface-variant">Social Links</p>
          {socialLinks.map((link, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <select
                  value={link.platform}
                  onChange={(e) => updateSocialLink(i, { platform: e.target.value as Platform, label: "" })}
                  className="rounded-lg border border-outline-variant/40 bg-surface px-2 py-2 text-sm text-on-surface"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
                <input
                  className="flex-1 rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-sm"
                  value={link.url}
                  onChange={(e) => updateSocialLink(i, { url: e.target.value })}
                  placeholder="https://..."
                  type="url"
                />
                <button type="button" onClick={() => removeSocialLink(i)} className="p-1.5 rounded text-on-surface-variant hover:text-destructive transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {link.platform === "other" && (
                <input
                  className="w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-sm"
                  value={link.label ?? ""}
                  onChange={(e) => updateSocialLink(i, { label: e.target.value })}
                  placeholder="Button label (e.g. My Website)"
                />
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addSocialLink}
            className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add social link
          </button>
        </div>

        <label className="flex items-center gap-3 text-sm text-on-surface cursor-pointer">
          <input
            type="checkbox"
            checked={showSocial}
            onChange={(e) => setShowSocial(e.target.checked)}
            className="rounded"
          />
          Show links on booking form
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
        <Button
          type="button"
          onClick={save}
          disabled={saving}
          className="w-full h-auto py-3 text-sm font-medium rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-sm hover:opacity-90 transition-opacity"
        >
          {saving ? "Saving…" : "Save Booking Page"}
        </Button>
      </div>
    </div>
  );
}
