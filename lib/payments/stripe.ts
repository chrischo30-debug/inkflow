import type {
  ArtistPaymentConfig,
  CreateDepositLinkOpts,
  CreateGenericLinkOpts,
  CreatedLink,
  PaymentAdapter,
} from "./types";

export function createStripeAdapter(artist: ArtistPaymentConfig): PaymentAdapter {
  const apiKey = artist.stripeApiKey;
  if (!apiKey) throw new Error("Stripe is not configured for this artist");

  const getStripe = async () => {
    const Stripe = (await import("stripe")).default;
    return new Stripe(apiKey);
  };

  return {
    provider: "stripe",

    async createDepositLink(opts: CreateDepositLinkOpts): Promise<CreatedLink> {
      const stripe = await getStripe();
      const product = await stripe.products.create({
        name: `Tattoo deposit — ${opts.clientName}`,
        metadata: { booking_id: opts.bookingId, artist_id: opts.artistId },
      });
      const price = await stripe.prices.create({
        product: product.id,
        currency: "usd",
        unit_amount: opts.amountCents,
      });
      const link = await stripe.paymentLinks.create({
        line_items: [{ price: price.id, quantity: 1 }],
        metadata: { booking_id: opts.bookingId, artist_id: opts.artistId },
      });
      return { url: link.url };
    },

    async createGenericLink(opts: CreateGenericLinkOpts): Promise<CreatedLink> {
      const stripe = await getStripe();
      const product = await stripe.products.create({ name: opts.label });
      const price = await stripe.prices.create({
        product: product.id,
        currency: "usd",
        unit_amount: opts.amountCents,
      });
      const link = await stripe.paymentLinks.create({
        line_items: [{ price: price.id, quantity: 1 }],
      });
      return { url: link.url };
    },
  };
}
