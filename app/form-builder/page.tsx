import { Sidebar } from "@/components/layout/Sidebar";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { normalizeCustomFormFields, normalizeFormFields } from "@/lib/form-fields";
import { FormBuilderPageLayout } from "@/components/settings/FormBuilderPageLayout";

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
    .select("field_key, label, enabled, required, sort_order, placeholder, description, input_type, options")
    .eq("artist_id", user.id)
    .order("sort_order", { ascending: true });
  const { data: customData } = await supabase
    .from("custom_form_fields")
    .select("id, field_key, label, type, enabled, required, sort_order, placeholder, description, options")
    .eq("artist_id", user.id)
    .order("sort_order", { ascending: true });

  const { data: artist } = await supabase
    .from("artists")
    .select("slug, form_header, form_subtext, form_button_text, form_confirmation_message, form_success_redirect_url")
    .eq("id", user.id)
    .single();

  const fields = normalizeFormFields(data ?? []);
  const customFields = normalizeCustomFormFields(customData ?? []);

  return (
    <div className="dashboard flex fixed inset-0 bg-surface overflow-hidden">
      <Sidebar />
      <FormBuilderPageLayout
        slug={artist?.slug ?? ""}
        initialFields={fields}
        initialCustomFields={customFields}
        initialFormHeader={artist?.form_header ?? ""}
        initialFormSubtext={artist?.form_subtext ?? ""}
        initialFormButtonText={artist?.form_button_text ?? ""}
        initialConfirmationMessage={artist?.form_confirmation_message ?? ""}
        initialSuccessRedirectUrl={artist?.form_success_redirect_url ?? ""}
      />
    </div>
  );
}
