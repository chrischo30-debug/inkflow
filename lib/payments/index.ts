import type { ArtistPaymentConfig, PaymentAdapter, PaymentProvider } from "./types";
import { createStripeAdapter } from "./stripe";
import { createSquareAdapter } from "./square";

export type { PaymentProvider, ArtistPaymentConfig, PaymentAdapter } from "./types";

/**
 * Returns the active provider for an artist, or null if nothing is connected.
 * Legacy artists with stripe_api_key but no payment_provider set are treated
 * as Stripe (the migration backfills this, but be defensive).
 */
export function getActiveProvider(artist: ArtistPaymentConfig): PaymentProvider | null {
  if (artist.provider === "square" && artist.squareAccessToken && artist.squareLocationId) {
    return "square";
  }
  if (artist.provider === "stripe" && artist.stripeApiKey) {
    return "stripe";
  }
  if (!artist.provider && artist.stripeApiKey) {
    return "stripe";
  }
  return null;
}

export function getAdapter(artist: ArtistPaymentConfig): PaymentAdapter | null {
  const provider = getActiveProvider(artist);
  if (provider === "stripe") return createStripeAdapter(artist);
  if (provider === "square") return createSquareAdapter(artist);
  return null;
}

export function readArtistPaymentConfig(row: Record<string, unknown>): ArtistPaymentConfig {
  return {
    provider: (row.payment_provider as PaymentProvider | null | undefined) ?? null,
    stripeApiKey: (row.stripe_api_key as string | null | undefined) ?? null,
    squareAccessToken: (row.square_access_token as string | null | undefined) ?? null,
    squareLocationId: (row.square_location_id as string | null | undefined) ?? null,
    squareEnvironment:
      (row.square_environment as "sandbox" | "production" | null | undefined) ?? "production",
  };
}
