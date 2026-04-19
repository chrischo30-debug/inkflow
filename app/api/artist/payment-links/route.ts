import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

const paymentLinksSchema = z.object({
  Stripe: z.string().url().or(z.literal("")),
  Venmo: z.string().url().or(z.literal("")),
  CashApp: z.string().url().or(z.literal("")),
  Squarespace: z.string().url().or(z.literal("")),
  Other: z.string().url().or(z.literal("")),
});

export async function PUT(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = paymentLinksSchema.parse(body);

    const compactLinks = Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => value && value.length > 0)
    );

    const { error } = await supabase
      .from("artists")
      .update({ payment_links: compactLinks })
      .eq("id", user.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, payment_links: compactLinks });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payment links", details: error.flatten() }, { status: 400 });
    }
    console.error("Payment links update error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
