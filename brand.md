# brand.md

## App Name
InkFlow

## Personality
Professional, clean, fast. Feels like a tool built for serious creatives — not a generic SaaS.
Think Linear meets Stripe. Confident, no clutter, everything has a purpose.

## Colors
Primary background:   #0A0A0A   (near black)
Surface/card:         #111111   (dark card backgrounds)
Border:               #1F1F1F   (subtle dividers)
Primary accent:       #E8FF47   (sharp acid yellow-green — the one bold choice)
Secondary accent:     #FFFFFF   (white text, primary actions)
Muted text:           #6B6B6B   (labels, secondary info)
Success:              #22C55E
Warning:              #F59E0B
Error:                #EF4444

## Typography
Display / headings:   Geist (weight 600–700)
Body / UI:            Geist Mono for data/stats, Geist for prose
Font sizes:           12px labels, 14px body, 16px default, 20px subheadings, 32px+ page titles
Line height:          1.5 for body, 1.2 for headings

## Spacing
Base unit: 4px. Use multiples: 8, 12, 16, 24, 32, 48, 64.
Generous padding inside cards (24px). Tight but breathable between list items (12–16px).

## Components (shadcn/ui + Tailwind)
- Buttons: sharp corners (rounded-md), solid fill for primary, ghost for secondary
- Cards: dark surface (#111111), 1px border (#1F1F1F), no drop shadows
- Badges: small, pill-shaped, color-coded by booking state
- Tables: no zebra striping — use border separation instead
- Inputs: dark fill, subtle border, acid yellow focus ring

## Booking State Colors
inquiry:        #6B6B6B  (muted — new, unreviewed)
reviewed:       #3B82F6  (blue — artist has seen it)
deposit_sent:   #F59E0B  (amber — waiting on client)
deposit_paid:   #22C55E  (green — money in)
confirmed:      #E8FF47  (accent — locked in)
completed:      #FFFFFF  (white/muted — done)

## NEVER
- Never use purple gradients, rounded-2xl cards, or generic SaaS purple/blue color schemes
- Never use Inter or Roboto — use Geist only
- Never use drop shadows on cards — use borders instead
- Never use light mode as the default — dark mode first
- Never use more than one bold accent color per screen
- Never override shadcn/ui base components in /components/ui/ — extend them instead
