import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { QuotationForm } from "@/components/quotation-form";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  findOpenOpportunityForClient,
  formToRow,
  listMyQuotationOrganizations,
  quotationCreateErrorMessage,
  saveQuotationImages,
} from "@/lib/quotations";
import { upsertClientFromQuotation } from "@/lib/crm";
import { ensureOpportunityForQuotation } from "@/lib/opportunities";

export const Route = createFileRoute("/_authenticated/quotations/new")({
  component: NewQuotationPage,
  head: () => ({
    meta: [
      { title: "Nueva cotización — ViaE Sales Hub" },
      { name: "description", content: "Crea una nueva cotización de viaje." },
    ],
  }),
});

function NewQuotationPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [organizationId, setOrganizationId] = useState("");

  const { data: organizations } = useQuery({
    queryKey: ["my-quotation-organizations"],
    queryFn: listMyQuotationOrganizations,
  });

  const orgs = organizations ?? [];
  const needsOrgChoice = orgs.length > 1;

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-24">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al dashboard
      </Link>

      <header>
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          <Sparkles className="h-3.5 w-3.5 text-gold" />
          Nueva cotización
        </span>
        <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
          Arma tu propuesta
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Completa los datos para generar una cotización profesional.
        </p>
      </header>

      {needsOrgChoice && (
        <div className="rounded-lg border border-border bg-card p-4">
          <Label className="text-sm">Organización propietaria</Label>
          <Select value={organizationId} onValueChange={setOrganizationId}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Elegí la organización" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-2 text-xs text-muted-foreground">
            Pertenecés a más de una organización: indicá a cuál corresponde esta cotización.
          </p>
        </div>
      )}

      <QuotationForm
        submitting={submitting}
        submitLabel="Generar cotización"
        onCancel={() => navigate({ to: "/dashboard" })}
        onSubmit={async ({ form, newFiles }) => {
          if (!form.firstName.trim() || !form.accommodationName.trim()) {
            toast.error("Nombre del cliente y nombre del alojamiento son obligatorios.");
            return;
          }
          if (needsOrgChoice && !organizationId) {
            toast.error("Elegí la organización propietaria de la cotización.");
            return;
          }
          setSubmitting(true);
          try {
            const { data: userData, error: userErr } = await supabase.auth.getUser();
            if (userErr || !userData.user) throw new Error("Sesión no válida.");
            const userId = userData.user.id;

            const clientId = await upsertClientFromQuotation(userId, form);

            // Si el cliente ya tiene una oportunidad abierta, la cotización se
            // asocia a ella; si no, se crea después con ensureOpportunityForQuotation.
            const existingOpportunityId = clientId
              ? await findOpenOpportunityForClient(clientId)
              : null;

            const row = formToRow(form);
            const { data: inserted, error: insertErr } = await supabase
              .from("quotations")
              .insert({
                ...row,
                user_id: userId,
                client_id: clientId,
                organization_id: organizationId || (orgs.length === 1 ? orgs[0].id : null),
                opportunity_id: existingOpportunityId,
                status: "draft",
              })
              .select("id")
              .single();
            if (insertErr) throw new Error(quotationCreateErrorMessage(insertErr));

            // Cada cotización queda relacionada a una oportunidad comercial.
            const opportunityId = await ensureOpportunityForQuotation({
              userId,
              clientId,
              quotationId: inserted.id,
              title: row.title,
              amount: Number(row.total_amount) || 0,
              currency: row.currency,
              opportunityId: existingOpportunityId,
              organizationId: organizationId || (orgs.length === 1 ? orgs[0].id : null),
            });
            if (opportunityId && opportunityId !== existingOpportunityId) {
              await supabase
                .from("quotations")
                .update({ opportunity_id: opportunityId })
                .eq("id", inserted.id);
            }

            const finalImages = await saveQuotationImages({
              quotationId: inserted.id,
              userId,
              newFiles,
              keptPaths: [],
              previousPaths: [],
            });
            if (finalImages.length > 0) {
              await supabase.from("quotations").update({ images: finalImages }).eq("id", inserted.id);
            }

            toast.success("¡Cotización generada con éxito!");
            navigate({ to: "/quotations" });
          } catch (err) {
            console.error(err);
            toast.error(err instanceof Error ? err.message : "No se pudo generar la cotización");
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </div>
  );
}
