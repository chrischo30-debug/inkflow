import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getGmailThreadSummary } from "@/lib/gmail";
import { refreshGoogleAccessToken } from "@/lib/google-calendar";

// Active states where an unread reply is actionable.
const ACTIVE_STATES = ["inquiry", "follow_up", "accepted", "confirmed"];

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: artist } = await supabase
    .from("artists")
    .select("google_refresh_token, gmail_connected")
    .eq("id", user.id)
    .single();

  if (!artist?.google_refresh_token || !artist.gmail_connected) {
    return NextResponse.json({ synced: 0 });
  }

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, gmail_thread_id, state, has_unread_reply")
    .eq("artist_id", user.id)
    .in("state", ACTIVE_STATES)
    .not("gmail_thread_id", "is", null);

  if (!bookings?.length) return NextResponse.json({ synced: 0 });

  // Verify token works before fan-out
  try {
    await refreshGoogleAccessToken(artist.google_refresh_token);
  } catch {
    return NextResponse.json({ synced: 0 });
  }

  const results = await Promise.allSettled(
    bookings.map(b =>
      getGmailThreadSummary(artist.google_refresh_token!, b.gmail_thread_id!, "")
        .then(summary => ({ id: b.id, unread: summary.unread }))
        .catch(() => ({ id: b.id, unread: b.has_unread_reply as boolean }))
    )
  );

  const updates = results
    .filter((r): r is PromiseFulfilledResult<{ id: string; unread: boolean }> => r.status === "fulfilled")
    .map(r => r.value)
    .filter(v => {
      const booking = bookings.find(b => b.id === v.id);
      return booking && booking.has_unread_reply !== v.unread;
    });

  if (updates.length > 0) {
    await Promise.all(
      updates.map(u =>
        supabase
          .from("bookings")
          .update({ has_unread_reply: u.unread })
          .eq("id", u.id)
          .eq("artist_id", user.id)
      )
    );
  }

  const replyStatuses = results
    .filter((r): r is PromiseFulfilledResult<{ id: string; unread: boolean }> => r.status === "fulfilled")
    .map(r => ({ bookingId: r.value.id, has_unread_reply: r.value.unread }));

  return NextResponse.json({ synced: updates.length, statuses: replyStatuses });
}
