import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdapter, readArtistPaymentConfig } from "@/lib/payments";
import type { PaymentLink } from "@/lib/pipeline-settings";

export class RefreshTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefreshTemplateError";
  }
}

// Square payment links from quick_pay are single-use — once paid, the URL
// shows a confirmation page. Saved entries with id+provider+amount_cents are
// "templates" we regenerate on demand.
function isTemplate(link: PaymentLink): boolean {
  return link.provider === "square" && typeof link.amount_cents === "number" && !!link.id;
}

const TOKEN_RE = /\{paymentLink(?::([^}]+))?\}/g;

interface TokenRefs {
  hasBare: boolean;
  labels: Set<string>;
}

function tokensReferenced(text: string): TokenRefs {
  const labels = new Set<string>();
  let hasBare = false;
  const re = new RegExp(TOKEN_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const label = m[1];
    if (label) labels.add(label.trim().toLowerCase());
    else hasBare = true;
  }
  return { hasBare, labels };
}

// Scans the given email texts for {paymentLink} / {paymentLink:Label} tokens,
// regenerates any Square templates referenced, persists the updated array, and
// returns the refreshed list. Falls back to the input list on any failure so
// callers always have something to substitute.
export async function refreshPaymentLinkTemplates(opts: {
  supabase: SupabaseClient;
  artistId: string;
  artistRow: Record<string, unknown>;
  paymentLinks: PaymentLink[];
  emailTexts: string[];
  // Force-refresh these template ids regardless of whether tokens reference them
  // — used by callers that resolve a payment link out-of-band (e.g. a booking's
  // deposit_link_url that fills the bare {paymentLink} via primaryPaymentLink).
  forceRefreshIds?: string[];
}): Promise<PaymentLink[]> {
  const { supabase, artistId, artistRow, paymentLinks, emailTexts, forceRefreshIds } = opts;
  if (paymentLinks.length === 0) return paymentLinks;
  if (!paymentLinks.some(isTemplate)) return paymentLinks;

  const config = readArtistPaymentConfig(artistRow);
  const adapter = getAdapter(config);
  if (!adapter) return paymentLinks;

  const refs = emailTexts.reduce<TokenRefs>(
    (acc, t) => {
      const r = tokensReferenced(t);
      acc.hasBare = acc.hasBare || r.hasBare;
      r.labels.forEach(l => acc.labels.add(l));
      return acc;
    },
    { hasBare: false, labels: new Set() },
  );

  const indices = new Set<number>();
  // Bare {paymentLink} resolves to paymentLinksList[0], so refresh index 0
  // when it's a template.
  if (refs.hasBare && paymentLinks[0] && isTemplate(paymentLinks[0])) indices.add(0);
  paymentLinks.forEach((l, i) => {
    if (isTemplate(l) && refs.labels.has(l.label.trim().toLowerCase())) indices.add(i);
  });
  if (forceRefreshIds && forceRefreshIds.length > 0) {
    const ids = new Set(forceRefreshIds);
    paymentLinks.forEach((l, i) => {
      if (l.id && ids.has(l.id) && isTemplate(l)) indices.add(i);
    });
  }

  if (indices.size === 0) return paymentLinks;

  const next = [...paymentLinks];
  const failures: string[] = [];
  for (const i of indices) {
    const l = next[i];
    if (!isTemplate(l)) continue;
    try {
      const created = await adapter.createGenericLink({
        label: l.label,
        amountCents: l.amount_cents!,
      });
      next[i] = { ...l, url: created.url };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Failed to regenerate Square template link", { id: l.id, msg });
      failures.push(`${l.label}: ${msg}`);
    }
  }

  // If any referenced template failed, refuse to proceed — the saved URL is
  // single-use and may have already been paid by another client. Sending it
  // would deliver someone else's confirmation page.
  if (failures.length > 0) {
    throw new RefreshTemplateError(
      `Could not generate a fresh Square link for ${failures.length === 1 ? "this payment link" : "these payment links"}: ${failures.join("; ")}`,
    );
  }

  await supabase.from("artists").update({ payment_links: next }).eq("id", artistId);
  return next;
}
