import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { QuotationForm } from "@/components/quotation-form";
import { QuotationItemsTabs } from "@/components/quotation-items-tabs";
import { QuotationItemsSummary } from "@/components/quotation-items-summary";
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
import {
  itemsTotal as sumItems,
  requirementsFromLead,
  saveQuotationItems,
  type QuotationItemDraft,
} from "@/lib/quotationItems";
import { getLead, ensureOpportunityForLead, serviceLabels, leadFullName } from "@/lib/leads";
import { upsertClientFromQuotation } from "@/lib/crm";
import { resolveMyOrganizationId } from "@/lib/tenant";
import { ensureOpportunityForQuotation } from "@/lib/opportunities";
import { getOpportunity } from "@/lib/pipeline";
import { getClient } from "@/lib/clients";
import { quotationInitialFromContext } from "@/lib/quotationPrefill";

type Search = { leadId?: string; opportunityId?: string };

export const Route = createFileRoute("/_authenticated/quotations/new")({
  component: NewQuotationPage,
  validateSearch: (search: Record<string, unknown>): Search => ({
    leadId: typeof search.leadId === "string" ? search.leadId : undefined,
    opportunityId: typeof search.opportunityId === "string" ? search.opportunityId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Nueva cotización integral — ViaE Sales Hub" },
      {
        name: "description",
        content:
          "Crea una cotización integral con alojamiento, excursiones, traslados, vehículos, seguros y vuelos.",
      },
      { property: "og:title", content: "Nueva cotización integral — ViaE Sales Hub" },
      {
        property: "og:description",
        content: "Reúne todos los servicios solicitados en una sola cotización profesional.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function NewQuotationPage() {
  const navigate = useNavigate();
  const { leadId, opportunityId: opportunityIdParam } = Route.useSearch();
  const [submitting, setSubmitting] = useState(false);
  const [organizationId, setOrganizationId] = useState("");
  const [items, setItems] = useState<QuotationItemDraft[]>([]);
  const [itemsSeeded, setItemsSeeded] = useState(false);

  const { data: organizations } = useQuery({
    queryKey: ["my-quotation-organizations"],
    queryFn: listMyQuotationOrganizations,
  });

  // Contexto del Pipeline: la oportunidad aporta el lead_id y el cliente.
  const { data: opportunity, isLoading: opportunityLoading } = useQuery({
    queryKey: ["opportunity-for-quotation", opportunityIdParam],
    queryFn: () => getOpportunity(opportunityIdParam as string),
    enabled: Boolean(opportunityIdParam),
  });

  const effectiveLeadId = leadId ?? opportunity?.lead_id ?? null;

  // Precarga desde la Consulta: datos del cliente, viaje y requerimientos.
  const { data: lead, isLoading: leadLoading } = useQuery({
    queryKey: ["lead-for-quotation", effectiveLeadId],
    queryFn: () => getLead(effectiveLeadId as string),
    enabled: Boolean(effectiveLeadId),
  });

  // Si la oportunidad no viene de una Consulta, usamos su cliente como contexto.
  const { data: contextClient, isLoading: clientLoading } = useQuery({
    queryKey: ["client-for-quotation", opportunity?.client_id],
    queryFn: () => getClient(opportunity?.client_id as string),
    enabled: Boolean(opportunity?.client_id) && !effectiveLeadId,
  });

  const initial = useMemo(
    () =>
      quotationInitialFromContext({
        lead,
        opportunity: opportunity ?? null,
        client: contextClient ?? null,
      }),
    [lead, opportunity, contextClient],
  );

  if (lead && !itemsSeeded) {
    setItemsSeeded(true);
    setItems(requirementsFromLead(lead));
  }

  const orgs = organizations ?? [];
  const needsOrgChoice = orgs.length > 1;
  const total = sumItems(items);

  const loadingContext =
    (Boolean(opportunityIdParam) && opportunityLoading) ||
    (Boolean(effectiveLeadId) && leadLoading) ||
    clientLoading;

  if (loadingContext) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Cargando consulta...</p>;
  }


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
          Nueva cotización integral
        </span>
        <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
          Arma tu propuesta
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Una sola cotización con todos los servicios: alojamiento, excursiones, vehículos,
          traslados, seguro, vuelos y otros.
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
        initial={initial}
        submitting={submitting}
        submitLabel="Generar cotización"
        itemsTotal={total}
        headerSlot={
          lead ? (
            <div className="rounded-2xl border border-gold/40 bg-secondary/40 p-4 text-sm">
              <p className="font-medium">
                Datos precargados desde la consulta de {leadFullName(lead)}
              </p>
              <p className="mt-1 text-muted-foreground">
                Servicios solicitados: {serviceLabels(lead.services_interest) || "sin detalle"}.
                Revisá y completá cada categoría antes de generar la cotización.
              </p>
            </div>
          ) : null
        }
        itemsSlot={(currency) => (
          <QuotationItemsTabs currency={currency} items={items} onChange={setItems} />
        )}
        summarySlot={(currency) => (
          <QuotationItemsSummary
            currency={currency}
            items={items}
            title="Resumen de la cotización"
          />
        )}

        onCancel={() => navigate({ to: "/dashboard" })}
        onSubmit={async ({ form, newFiles }) => {
          if (!form.firstName.trim()) {
            toast.error("El nombre del cliente es obligatorio.");
            return;
          }
          // P0.1: el modelo vigente exige servicios estructurados en `quotation_items`.
          if (items.length === 0) {
            toast.error("Cargá al menos un servicio de la cotización antes de generarla.");
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

            // Oportunidad: la del parámetro, la de la consulta o la abierta del cliente.
            const leadOpportunityId = lead ? await ensureOpportunityForLead(lead) : null;
            const existingOpportunityId =
              opportunityIdParam ??
              leadOpportunityId ??
              (clientId ? await findOpenOpportunityForClient(clientId) : null);

            const row = formToRow(form);
            const { data: inserted, error: insertErr } = await supabase
              .from("quotations")
              .insert({
                ...row,
                user_id: userId,
                client_id: clientId,
                lead_id: lead?.id ?? null,
                organization_id: await resolveMyOrganizationId(organizationId || null),
                opportunity_id: existingOpportunityId,
                status: "draft",
              })
              .select("id")
              .single();
            if (insertErr) throw new Error(quotationCreateErrorMessage(insertErr));

            await saveQuotationItems(inserted.id, items);

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
