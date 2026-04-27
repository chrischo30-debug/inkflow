# FlashBooker — Tablet Optimization Audit

The app is primarily used on tablets (artist working from an iPad in the studio). This audit walks the actual codebase and flags concrete tablet UX issues with file:line citations. Verified against the user's tablet conventions in memory: html base 17px, icon buttons p-2.5, tab bars px-4 py-3, dashboard grid 2-col tablet / 4-col xl, overflow menus via `createPortal`.

## Verified ✅
- Base font size: `html { font-size: 17px; }` — [app/globals.css:200](../app/globals.css#L200).
- Default Button size `h-8 gap-1.5 px-2.5` — [components/ui/button.tsx:24](../components/ui/button.tsx#L24).
- Overflow menus portal — [components/booking/BookingCard.tsx:132](../components/booking/BookingCard.tsx#L132).

## P0 — must fix before tablet launch

### P0-1. Dashboard action cards locked to 3 columns
[app/page.tsx:120](../app/page.tsx#L120):
```tsx
<div className="grid grid-cols-3 gap-3">
```
On portrait iPad (768px wide minus sidebar) each card has ~180px to play with — text wraps and metric labels truncate. Per project memory and the worktree pattern, this should be:
```tsx
<div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
```
**Effort:** 1-line fix.

### P0-2. Copy buttons are 20px touch targets
[components/booking/BookingCard.tsx:62, 241, 246](../components/booking/BookingCard.tsx#L62) — `<button className="p-1 rounded">` wrapping a `w-3 h-3` icon. Total ~20×20px hit area. iOS HIG says 44pt; Android Material says 48dp. These miss by half. Bump to `p-2` (32px) or `p-2.5` (≈44px).

### P0-3. Card overflow trigger button is 22px
[components/booking/BookingCard.tsx:128–182](../components/booking/BookingCard.tsx#L128) — More button is `p-1.5` over a 16px icon. Same fix: `p-2.5`. The portal logic itself is correct (per memory).

### P0-4. Pipeline columns hardcoded to 260/280/300px
[components/booking/PipelineView.tsx:429](../components/booking/PipelineView.tsx#L429):
```tsx
className="min-w-[260px] w-[260px] md:min-w-[280px] md:w-[280px] xl:min-w-[300px] xl:w-[300px]"
```
Portrait iPad fits ≤2 columns visible without scrolling; the `snap-x` is there but columns don't reflow. Either widen the snap step or accept horizontal scroll explicitly with a hint chip ("← swipe →"). Pick one.

## P1 — important UX

### P1-1. iOS auto-zoom on input focus
[components/ui/input.tsx:12](../components/ui/input.tsx#L12) and [components/ui/textarea.tsx:10](../components/ui/textarea.tsx#L10): inputs use `text-base md:text-sm`. With base 17px, `text-base` = 17px (good), `text-sm` = 14px (bad — Safari auto-zooms inputs <16px on focus, which is jarring on iPad in landscape with a Magic Keyboard).

**Fix:** drop the `md:text-sm` tier and stay at `text-base` on inputs/textareas. Visual difference is minimal at base 17px.

### P1-2. Help tooltip is a 16px target with 10px text
[components/ui/HelpTooltip.tsx:85-88](../components/ui/HelpTooltip.tsx#L85-L88) — `w-4 h-4` button (16px) with a `text-[10px]` "?". On a touch device this is hard to find and harder to hit. Bump to `w-6 h-6 text-xs` and ensure the click handler is the primary interaction (no hover dependency) per project memory.

### P1-3. ConfirmAppointment modal max-w-3xl with no max-h
[components/booking/ConfirmAppointmentModal.tsx:191](../components/booking/ConfirmAppointmentModal.tsx#L191) — `max-w-3xl` on a calendar picker modal. On portrait iPad it spans edge-to-edge with `p-4` padding, which is fine, but lacks `max-h-[90vh] overflow-y-auto`. If the artist uses a smaller iPad in landscape with software keyboard up, the modal can clip below the fold without scroll.

### P1-4. Settings sidebar always 208px
[components/settings/SettingsShell.tsx:62-80](../components/settings/SettingsShell.tsx#L62-L80) — `w-52 shrink-0 border-r`. Portrait iPad after main sidebar leaves ~480px for actual settings forms. Either collapse the secondary sidebar on `<lg`, or move settings to a top-tab pattern on tablet.

## P2 — minor

### P2-1. Drag-to-reorder cards doesn't work on touch
[components/booking/BookingCard.tsx:212-226](../components/booking/BookingCard.tsx#L212-L226) and [PipelineView.tsx:429](../components/booking/PipelineView.tsx#L429) use HTML5 drag events. iOS doesn't synthesize them from touch. The overflow menu's "Move to..." options are the documented fallback (per project memory), so this is OK as long as artists know. Consider a small tooltip "Tap ⋯ to move" on first visit on a touch device (e.g. via the existing coachmark system).

### P2-2. Logo / reference image lazy loading
Image-heavy pages (booking page background, reference gallery) don't appear to use Next.js `<Image>` consistently — review uploads display in [components/booking/](../components/booking/). On tablet networks (LTE), full-resolution references can be 2–5MB. Either swap to `<Image>` for automatic responsive srcset, or pre-resize on upload.

### P2-3. No portrait/landscape handling for `/calendar`
The calendar page assumes wide-format. Portrait iPad scrunches it. Not blocking — artists will rotate.

## Quick wins (one PR)

These are all small CSS edits with no logic change:

```diff
- // app/page.tsx:120
- <div className="grid grid-cols-3 gap-3">
+ <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">

- // components/booking/BookingCard.tsx — copy buttons & overflow trigger
- className="p-1 rounded"
+ className="p-2 rounded-lg"
- className="p-1.5"
+ className="p-2.5"

- // components/ui/input.tsx:12 & textarea.tsx:10
- "text-base md:text-sm"
+ "text-base"

- // components/ui/HelpTooltip.tsx
- "w-4 h-4 text-[10px]"
+ "w-6 h-6 text-xs"

- // components/booking/ConfirmAppointmentModal.tsx:191
- "max-w-3xl"
+ "max-w-3xl max-h-[90vh] overflow-y-auto"
```
~30 minutes of work, fixes 80% of tablet pain.

## How to verify

1. Open Safari Responsive Design Mode → iPad (10th gen, 820×1180, portrait + landscape).
2. Tap every action button on the dashboard, bookings, pipeline, calendar, settings. Anything you mis-tap = a P0/P1.
3. Focus every input and textarea. Watch for the iOS zoom flash.
4. Open every modal. Confirm none clip and all scroll vertically.
5. Use the app for 5 minutes pretending to take a real booking. Patterns that frustrate you here will frustrate every artist on day 1.
