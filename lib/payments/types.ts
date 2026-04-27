export type PaymentProvider = "stripe" | "square";

export interface ArtistPaymentConfig {
  provider: PaymentProvider | null;
  stripeApiKey?: string | null;
  squareAccessToken?: string | null;
  squareLocationId?: string | null;
  squareEnvironment?: "sandbox" | "production" | null;
}

export interface CreateDepositLinkOpts {
  bookingId: string;
  artistId: string;
  clientName: string;
  amountCents: number;
}

export interface CreateGenericLinkOpts {
  label: string;
  amountCents: number;
}

export interface CreatedLink {
  url: string;
  externalOrderId?: string;
}

export interface PaymentAdapter {
  provider: PaymentProvider;
  createDepositLink(opts: CreateDepositLinkOpts): Promise<CreatedLink>;
  createGenericLink(opts: CreateGenericLinkOpts): Promise<CreatedLink>;
}
