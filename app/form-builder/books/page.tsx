import { Sidebar } from "@/components/layout/Sidebar";
import { BooksSettingsLayout } from "@/components/settings/BooksSettingsLayout";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BooksSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  type BooksCols = {
    slug?: string;
    books_open?: boolean;
    books_closed_header?: string | null;
    books_closed_message?: string | null;
    books_open_at?: string | null;
    books_close_at?: string | null;
  };

  let data: BooksCols = {};
  try {
    const { data: row } = await supabase
      .from("artists")
      .select("slug, books_open, books_closed_header, books_closed_message, books_open_at, books_close_at")
      .eq("id", user.id)
      .single();
    data = (row as BooksCols) ?? {};
  } catch { /* migration not yet applied */ }

  return (
    <div className="dashboard flex fixed inset-0 bg-surface overflow-hidden">
      <Sidebar />
      <BooksSettingsLayout
        initialOpen={data.books_open ?? true}
        initialClosedHeader={data.books_closed_header ?? ""}
        initialClosedMessage={data.books_closed_message ?? ""}
        initialOpenAt={data.books_open_at ? new Date(data.books_open_at).toISOString().slice(0, 16) : ""}
        initialCloseAt={data.books_close_at ? new Date(data.books_close_at).toISOString().slice(0, 16) : ""}
      />
    </div>
  );
}
