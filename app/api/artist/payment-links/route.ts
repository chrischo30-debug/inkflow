import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

const paymentLinkSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
});

const bodySchema = z.object({
  links: z.array(paymentLinkSchema),
});

export async function PUT(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { links } = bodySchema.parse(body);

    const { error } = await supabase
      .from("artists")
      .update({ payment_links: links })
      .eq("id", user.id);

    if (error) throw error;

    return NextResponse.json({ success: true, payment_links: links });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payment links", details: error.flatten() }, { status: 400 });
    }
    console.error("Payment links update error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
