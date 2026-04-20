"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Check, Upload, X, Plus, Eye } from "lucide-react";

type Platform = "instagram" | "tiktok" | "twitter" | "facebook" | "website";
type Layout = "centered" | "banner" | "minimal";
type Font = "sans" | "serif" | "mono";

interface SocialLink { platform: Platform; url: string; }

export interface BookingPageConfig {
  booking_bg_color: string;
  booking_bg_image_url: string | null;
  booking_layout: Layout;
  booking_font: Font;
  booking_text_color: "dark" | "light";
  logo_url: string | null;
  website_url: string;
  social_links: SocialLink[];
  show_social_on_booking: boolean;
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
  { id: "website",   label: "Website" },
];

const LAYOUTS: { id: Layout; label: string; desc: string }[] = [
  { id: "centered", label: "Centered", desc: "Card centered on background" },
  { id: "banner",   label: "Banner",   desc: "Color band at top, form below" },
  { id: "minimal",  label: "Minimal",  desc: "Clean, no card, left-aligned" },
];

const FONTS: { id: Font; label: string; sample: string; style: React.CSSProperties }[] = [
  { id: "sans",  label: "Modern",  sample: "Book a tattoo", style: {} },
  { id: "serif", label: "Elegant", sample: "Book a tattoo", style: { fontFamily: "var(--font-booking-serif)" } },
  { id: "mono",  label: "Edgy",    sample: "Book a tattoo", style: { fontFamily: "var(--font-booking-mono)" } },
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

export function BookingPageSettings({ initial }: { initial: BookingPageConfig }) {
  const [bgColor, setBgColor]       = useState(initial.booking_bg_color || "#ffffff");
  const [bgImageUrl, setBgImageUrl] = useState(initial.booking_bg_image_url || null);
  const [layout, setLayout]         = useState<Layout>(initial.booking_layout || "centered");
  const [font, setFont]             = useState<Font>(initial.booking_font || "sans");
  const [textColor, setTextColor]   = useState<"dark" | "light">(initial.booking_text_color || autoTextColor(initial.booking_bg_color || "#ffffff"));
  const [textColorLocked, setTextColorLocked] = useState(!!initial.booking_text_color);
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
      booking_text_color: textColor,
      logo_url: logoUrl,
      website_url: websiteUrl,
      social_links: socialLinks,
      show_social_on_booking: showSocial,
    };
    const encoded = btoa(JSON.stringify(state));
    window.open(`/form-builder/preview?s=${encoded}`, "_blank");
  };

  const save = async () => {
    setSaving(true);
    setSaveStatus("idle");
    setSaveError("");
    const validLinks = socialLinks.filter((l) => l.url.startsWith("http"));
    const res = await fetch("/api/artist/booking-page", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        booking_bg_color: bgColor,
        booking_bg_image_url: bgImageUrl || null,
        booking_layout: layout,
        booking_font: font,
        booking_text_color: textColor,
        logo_url: logoUrl || null,
        website_url: websiteUrl,
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

      {/* Text Color */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-on-surface">Text Color</h4>
        <div className="flex items-center gap-3">
          {(["dark", "light"] as const).map((opt) => {
            const isAuto = !textColorLocked && autoTextColor(bgColor) === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => { setTextColor(opt); setTextColorLocked(true); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                  textColor === opt
                    ? "border-primary/60 bg-primary/5 text-on-surface"
                    : "border-outline-variant/20 text-on-surface-variant hover:border-outline-variant/50"
                }`}
              >
                <span
                  className="w-4 h-4 rounded-full border border-outline-variant/30 shrink-0"
                  style={{ backgroundColor: opt === "dark" ? "#111" : "#fff" }}
                />
                {opt === "dark" ? "Dark" : "Light"}
                {isAuto && <span className="text-[10px] text-on-surface-variant font-normal">auto</span>}
              </button>
            );
          })}
          {textColorLocked && (
            <button
              type="button"
              onClick={() => { setTextColorLocked(false); setTextColor(autoTextColor(bgColor)); }}
              className="text-xs text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Reset to auto
            </button>
          )}
        </div>
      </section>

      {/* Background */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold text-on-surface">Background</h4>
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {BG_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => { setBgColor(color); setBgImageUrl(null); if (!textColorLocked) setTextColor(autoTextColor(color)); }}
                className={`w-7 h-7 rounded-full border-2 transition-all ${
                  bgColor === color && !bgImageUrl ? "border-on-surface scale-110" : "border-outline-variant/30 hover:border-outline-variant"
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
            <label className="flex items-center gap-1.5 text-xs text-on-surface-variant cursor-pointer">
              <input
                type="color"
                value={bgColor}
                onChange={(e) => { setBgColor(e.target.value); setBgImageUrl(null); if (!textColorLocked) setTextColor(autoTextColor(e.target.value)); }}
                className="w-7 h-7 rounded cursor-pointer border border-outline-variant/30"
              />
              Custom
            </label>
          </div>

          <div className="flex items-center gap-3">
            {bgImageUrl ? (
              <div className="relative group">
                <img src={bgImageUrl} alt="Background" className="h-12 w-20 object-cover rounded border border-outline-variant/30" />
                <button
                  type="button"
                  onClick={() => setBgImageUrl(null)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-surface border border-outline-variant/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-on-surface-variant" />
                </button>
              </div>
            ) : null}
            <input ref={bgInputRef} type="file" accept="image/*" className="sr-only" onChange={handleBgUpload} />
            <button
              type="button"
              onClick={() => bgInputRef.current?.click()}
              disabled={uploadingBg}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-outline-variant/40 text-sm text-on-surface-variant hover:border-outline-variant hover:text-on-surface transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              {uploadingBg ? "Uploading…" : bgImageUrl ? "Replace image" : "Use image instead"}
            </button>
            {bgImageUrl && <span className="text-xs text-on-surface-variant">Image overrides color</span>}
          </div>
        </div>
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
            <div key={i} className="flex items-center gap-2">
              <select
                value={link.platform}
                onChange={(e) => updateSocialLink(i, { platform: e.target.value as Platform })}
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

      <div className="flex gap-3">
        <button
          type="button"
          onClick={openPreview}
          className="flex items-center gap-2 px-5 py-4 rounded-2xl border border-outline-variant text-sm font-medium text-on-surface-variant hover:text-on-surface hover:border-on-surface/40 transition-colors"
        >
          <Eye className="w-4 h-4" />
          Preview
        </button>
        <Button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex-1 py-6 text-base font-medium rounded-2xl bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-sm hover:opacity-90 transition-opacity"
        >
          {saving ? "Saving…" : "Save Booking Page"}
        </Button>
      </div>
    </div>
  );
}
