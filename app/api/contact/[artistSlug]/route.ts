import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

const PHONE_REGEX = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;

const submissionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional(),
  message: z.string().min(1, "Message is required"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ artistSlug: string }> }
) {
  try {
    const { artistSlug } = await params;
    const admin = createAdminClient();

    const { data: artist } = await admin
      .from("artists")
      .select("id, email, name, contact_form_enabled, contact_phone_enabled, contact_phone_required")
      .eq("slug", artistSlug)
      .single();

    if (!artist) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!artist.contact_form_enabled) {
      return NextResponse.json({ error: "Contact form is not enabled" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = submissionSchema.parse(body);

    if (artist.contact_phone_enabled && artist.contact_phone_required && !parsed.phone?.trim()) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }
    if (parsed.phone?.trim() && !PHONE_REGEX.test(parsed.phone.trim())) {
      return NextResponse.json({ error: "Please enter a valid phone number" }, { status: 400 });
    }

    const { error } = await admin
      .from("contact_submissions")
      .insert({
        artist_id: artist.id,
        name: parsed.name.trim(),
        email: parsed.email.trim().toLowerCase(),
        phone: parsed.phone?.trim() || null,
        message: parsed.message.trim(),
      });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Notify the artist by email
    const resendKey = process.env.RESEND_API_KEY;
    if (artist.email && resendKey) {
      try {
        const resend = new Resend(resendKey);
        const fromAddress = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
        const phoneLine = parsed.phone?.trim() ? `\nPhone: ${parsed.phone.trim()}` : "";
        const visitorEmail = parsed.email.trim();
        const visitorName = parsed.name.trim();
        await resend.emails.send({
          from: `FlashBooker <${fromAddress}>`,
          to: [artist.email],
          // Named format maximises Reply-To support across clients
          replyTo: `${visitorName} <${visitorEmail}>`,
          subject: `New contact from ${visitorName} (${visitorEmail})`,
          text: [
            `You have a new contact form submission.`,
            ``,
            `From: ${visitorName}`,
            `Reply to: ${visitorEmail}${phoneLine}`,
            ``,
            `Message:`,
            parsed.message.trim(),
          ].join("\n"),
        });
      } catch (emailErr) {
        // Don't fail the submission if notification fails
        console.error("Contact notification email failed:", emailErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const first = err.issues[0];
      return NextResponse.json({ error: first?.message ?? "Invalid submission" }, { status: 400 });
    }
    console.error("Contact submission error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
