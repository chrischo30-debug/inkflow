import { Sidebar } from "@/components/layout/Sidebar";
import { PaymentSettings } from "@/components/settings/PaymentSettings";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function PaymentLinksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const { data: artist } = await supabase
    .from("artists")
    .select("payment_links")
    .eq("id", user.id)
    .single();

  const paymentLinks = (artist?.payment_links ?? {}) as Record<string, string>;

  return (
    <div className="flex h-screen w-full bg-surface overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 flex items-center px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl sticky top-0 z-40">
          <h1 className="text-xl font-heading font-semibold text-on-surface">Payment Links</h1>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <section>
            <PaymentSettings initialLinks={paymentLinks} />
          </section>
        </div>
      </main>
    </div>
  );
}
