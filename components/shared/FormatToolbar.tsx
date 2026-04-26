"use client";

import { useState, useRef } from "react";
import { Bold, Italic, List, Link2, X } from "lucide-react";

interface Props {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (val: string) => void;
  onFocus?: () => void;
}

export function FormatToolbar({ textareaRef, value, onChange, onFocus }: Props) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const labelInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const applyWrap = (prefix: string, suffix: string) => {
    const el = textareaRef.current;
    onFocus?.();
    const start = el ? (el.selectionStart ?? value.length) : value.length;
    const end = el ? (el.selectionEnd ?? value.length) : value.length;
    const selected = value.slice(start, end);
    const newVal = value.slice(0, start) + prefix + selected + suffix + value.slice(end);
    onChange(newVal);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    });
  };

  const toggleBullet = () => {
    const el = textareaRef.current;
    onFocus?.();
    const start = el ? (el.selectionStart ?? 0) : 0;
    const end = el ? (el.selectionEnd ?? value.length) : value.length;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const afterEnd = value.indexOf("\n", end);
    const lineEnd = afterEnd === -1 ? value.length : afterEnd;
    const selectedLines = value.slice(lineStart, lineEnd).split("\n");
    const allBullets = selectedLines.every(l => l.startsWith("- "));
    const newLines = selectedLines.map(l =>
      allBullets ? (l.startsWith("- ") ? l.slice(2) : l) : `- ${l}`,
    );
    const newVal = value.slice(0, lineStart) + newLines.join("\n") + value.slice(lineEnd);
    onChange(newVal);
    requestAnimationFrame(() => { el?.focus(); });
  };

  const openLink = () => {
    const el = textareaRef.current;
    const selected = el ? value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0) : "";
    setLinkLabel(selected);
    setLinkUrl("");
    setLinkOpen(true);
    requestAnimationFrame(() => {
      if (selected) urlInputRef.current?.focus();
      else labelInputRef.current?.focus();
    });
  };

  const insertLink = () => {
    const label = linkLabel.trim() || "link text";
    let raw = linkUrl.trim();
    if (raw && !raw.startsWith("http://") && !raw.startsWith("https://") && !raw.startsWith("/")) {
      raw = `https://${raw}`;
    }
    const url = raw || "https://";
    const markdown = `[${label}](${url})`;
    const el = textareaRef.current;
    const start = el ? (el.selectionStart ?? value.length) : value.length;
    const end = el ? (el.selectionEnd ?? start) : start;
    const newVal = value.slice(0, start) + markdown + value.slice(end);
    onChange(newVal);
    setLinkOpen(false);
    setLinkLabel("");
    setLinkUrl("");
    requestAnimationFrame(() => { el?.focus(); });
  };

  const btnClass =
    "p-1.5 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors";

  return (
    <div>
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-outline-variant/20">
        <button type="button" onClick={() => applyWrap("**", "**")} title="Bold" className={btnClass}>
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => applyWrap("*", "*")} title="Italic" className={btnClass}>
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={toggleBullet} title="Bullet list" className={btnClass}>
          <List className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-4 bg-outline-variant/30 mx-0.5" />
        <button
          type="button"
          onClick={openLink}
          title="Insert link"
          className={linkOpen
            ? "p-1.5 rounded-md text-primary bg-primary/10 transition-colors"
            : btnClass}
        >
          <Link2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {linkOpen && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-outline-variant/20">
          <input
            ref={labelInputRef}
            type="text"
            value={linkLabel}
            onChange={e => setLinkLabel(e.target.value)}
            placeholder="Label"
            className="w-24 shrink-0 text-xs px-2 py-1.5 border border-outline-variant/30 rounded-md bg-surface focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant/50"
          />
          <input
            ref={urlInputRef}
            type="url"
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            placeholder="example.com"
            className="flex-1 min-w-0 text-xs px-2 py-1.5 border border-outline-variant/30 rounded-md bg-surface focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant/50"
            onKeyDown={e => {
              if (e.key === "Enter") insertLink();
              if (e.key === "Escape") setLinkOpen(false);
            }}
          />
          <button
            type="button"
            onClick={insertLink}
            className="shrink-0 text-xs px-2.5 py-1.5 rounded-md bg-on-surface text-surface font-medium hover:opacity-80 transition-opacity"
          >
            Insert
          </button>
          <button
            type="button"
            onClick={() => setLinkOpen(false)}
            className="shrink-0 text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
