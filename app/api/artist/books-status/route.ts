import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const update: Record<string, unknown> = {};

  if (typeof body.books_open === "boolean") update.books_open = body.books_open;
  if ("books_open_at" in body) update.books_open_at = body.books_open_at || null;
  if ("books_close_at" in body) update.books_close_at = body.books_close_at || null;
  if ("books_closed_message" in body) update.books_closed_message = body.books_closed_message || null;
  if ("books_closed_header" in body) update.books_closed_header = body.books_closed_header || null;

  const { error } = await supabase.from("artists").update(update).eq("id", user.id);
  if (error) {
    const msg = error.message?.includes("column")
      ? "Database migration required: run supabase/migrations/20260421_books_open_closed.sql in your Supabase SQL editor."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
