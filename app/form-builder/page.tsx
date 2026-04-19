import { Sidebar } from "@/components/layout/Sidebar";
import { ExternalLink } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { FormBuilderSettings } from "@/components/settings/FormBuilderSettings";
import { normalizeCustomFormFields, normalizeFormFields } from "@/lib/form-fields";

export default async function FormBuilderPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const { data } = await supabase
    .from("form_fields")
    .select("field_key, label, enabled, required, sort_order, placeholder, input_type, options")
    .eq("artist_id", user.id)
    .order("sort_order", { ascending: true });
  const { data: customData } = await supabase
    .from("custom_form_fields")
    .select("id, field_key, label, type, enabled, required, sort_order, placeholder, options")
    .eq("artist_id", user.id)
    .order("sort_order", { ascending: true });

  const { data: artist } = await supabase
    .from("artists")
    .select("slug")
    .eq("id", user.id)
    .single();

  const fields = normalizeFormFields(data ?? []);
  const customFields = normalizeCustomFormFields(customData ?? []);

  return (
    <div className="flex h-screen w-full bg-surface overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 flex items-center justify-between px-8 border-b border-outline-variant/10 bg-surface/80 backdrop-blur-xl sticky top-0 z-40">
          <h1 className="text-xl font-heading font-semibold text-on-surface">Form Builder</h1>
          {artist?.slug && (
            <a
              href={`/${artist.slug}/book`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium border border-[#1F1F1F] text-[#6B6B6B] hover:text-[#E8FF47] hover:border-[#E8FF47]/40 transition-colors duration-150"
            >
              <ExternalLink className="w-3 h-3" />
              View Live Form
            </a>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <section>
            <FormBuilderSettings initialFields={fields} initialCustomFields={customFields} />
          </section>
        </div>
      </main>
    </div>
  );
}
