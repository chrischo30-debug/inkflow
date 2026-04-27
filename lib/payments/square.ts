import { randomUUID, createHmac, timingSafeEqual } from "crypto";
import type {
  ArtistPaymentConfig,
  CreateDepositLinkOpts,
  CreateGenericLinkOpts,
  CreatedLink,
  PaymentAdapter,
} from "./types";

const PROD_BASE = "https://connect.squareup.com";
const SANDBOX_BASE = "https://connect.squareupsandbox.com";

export function squareApiBase(env: ArtistPaymentConfig["squareEnvironment"]): string {
  return env === "sandbox" ? SANDBOX_BASE : PROD_BASE;
}

export function createSquareAdapter(artist: ArtistPaymentConfig): PaymentAdapter {
  const token = artist.squareAccessToken;
  const locationId = artist.squareLocationId;
  if (!token) throw new Error("Square access token missing");
  if (!locationId) throw new Error("Square location is not set");
  const base = squareApiBase(artist.squareEnvironment ?? "production");

  const callPaymentLinks = async (body: unknown): Promise<{ url: string; orderId?: string }> => {
    const res = await fetch(`${base}/v2/online-checkout/payment-links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Square-Version": "2024-12-19",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const errs = (json.errors as Array<{ detail?: string; code?: string }> | undefined) ?? [];
      const detail = errs[0]?.detail ?? errs[0]?.code ?? `Square error (${res.status})`;
      throw new Error(detail);
    }
    const link = json.payment_link as { url?: string; order_id?: string } | undefined;
    if (!link?.url) throw new Error("Square did not return a payment link URL");
    return { url: link.url, orderId: link.order_id };
  };

  return {
    provider: "square",

    async createDepositLink(opts: CreateDepositLinkOpts): Promise<CreatedLink> {
      const { url, orderId } = await callPaymentLinks({
        idempotency_key: randomUUID(),
        order: {
          location_id: locationId,
          reference_id: opts.bookingId,
          line_items: [
            {
              name: `Tattoo deposit — ${opts.clientName}`,
              quantity: "1",
              base_price_money: { amount: opts.amountCents, currency: "USD" },
            },
          ],
          metadata: { artist_id: opts.artistId, booking_id: opts.bookingId },
        },
      });
      return { url, externalOrderId: orderId };
    },

    async createGenericLink(opts: CreateGenericLinkOpts): Promise<CreatedLink> {
      const { url, orderId } = await callPaymentLinks({
        idempotency_key: randomUUID(),
        quick_pay: {
          name: opts.label,
          price_money: { amount: opts.amountCents, currency: "USD" },
          location_id: locationId,
        },
      });
      return { url, externalOrderId: orderId };
    },
  };
}

export interface SquareOrderLookup {
  bookingId: string | null;
  paymentId: string | null;
  amountCents: number | null;
}

export async function fetchSquareOrder(
  artist: ArtistPaymentConfig,
  orderId: string,
): Promise<SquareOrderLookup> {
  const token = artist.squareAccessToken;
  if (!token) throw new Error("Square access token missing");
  const base = squareApiBase(artist.squareEnvironment ?? "production");
  const res = await fetch(`${base}/v2/orders/${orderId}`, {
    headers: {
      "Square-Version": "2024-12-19",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(`Square order lookup failed (${res.status})`);
  const json = (await res.json()) as { order?: Record<string, unknown> };
  const order = json.order ?? {};
  const tenders = (order.tenders as Array<{ payment_id?: string }> | undefined) ?? [];
  const total = order.total_money as { amount?: number } | undefined;
  return {
    bookingId: (order.reference_id as string | undefined) ?? null,
    paymentId: tenders[0]?.payment_id ?? null,
    amountCents: typeof total?.amount === "number" ? total.amount : null,
  };
}

export function verifySquareSignature(
  body: string,
  signatureHeader: string | null,
  notificationUrl: string,
  signatureKey: string,
): boolean {
  if (!signatureHeader) return false;
  const hmac = createHmac("sha256", signatureKey);
  hmac.update(notificationUrl + body);
  const expected = hmac.digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
