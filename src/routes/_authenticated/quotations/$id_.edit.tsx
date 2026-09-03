import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { QuotationForm, type QuotationFormState, type ExistingImage } from "@/components/quotation-form";
import { formToRow, rowToForm, saveQuotationImages, signImageUrls } from "@/lib/quotations";
import { QuotationItemsTabs } from "@/components/quotation-items-tabs";
import { QuotationItemsSummary } from "@/components/quotation-items-summary";
import {
  itemsTotal as sumItems,
  listQuotationItems,
  rowToDraft,
  saveQuotationItems,
  type QuotationItemDraft,
} from "@/lib/quotationItems";
import { upsertClientFromQuotation } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/quotations/$id_/edit")({
  component: EditQuotationPage,
  head: () => ({
    meta: [
      { title: "Editar cotización — ViaE" },
      { name: "description", content: "Edita los datos de la cotización." },
    ],
  }),
});

function EditQuotationPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [initial, setInitial] = useState<QuotationFormState | null>(null);
  const [images, setImages] = useState<ExistingImage[]>([]);
  const [previousPaths, setPreviousPaths] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<QuotationItemDraft[]>([]);
  /** P0.1: las cotizaciones históricas (modelo plano) no exigen `quotation_items`. */
  const [legacy, setLegacy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("quotations").select("*").eq("id", id).maybeSingle();
      if (error || !data) {
        toast.error(error?.message ?? "Cotización no encontrada");
        navigate({ to: "/quotations" });
        return;
      }
      setInitial(rowToForm(data));
      setLegacy(isLegacyQuotation(data.created_at));
      const paths = (data.images ?? []) as string[];
      setPreviousPaths(paths);
      const urls = await signImageUrls(paths);
      setImages(paths.map((p, i) => ({ path: p, url: urls[i] ?? "" })));
      // Servicios de la cotización integral (v1.14).
      try {
        const rows = await listQuotationItems(id);
        setItems(rows.map(rowToDraft));
      } catch {
        setItems([]);
      }
    })();
  }, [id, navigate]);

  if (!initial) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-24">
      <Link to="/quotations/$id" params={{ id }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver al detalle
      </Link>

      <header>
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">Editar cotización</h1>
        <p className="mt-2 text-sm text-muted-foreground">Actualiza los datos y guarda los cambios.</p>
      </header>

      <QuotationForm
        initial={initial}
        existingImages={images}
        submitting={submitting}
        submitLabel="Guardar cambios"
        itemsTotal={sumItems(items)}
        itemsSlot={(currency) => (
          <QuotationItemsTabs currency={currency} items={items} onChange={setItems} />
        )}
        summarySlot={(currency) => (
          <QuotationItemsSummary currency={currency} items={items} title="Resumen de la cotización" />
        )}

        onCancel={() => navigate({ to: "/quotations/$id", params: { id } })}
        onSubmit={async ({ form, newFiles, keptPaths }) => {
          if (!form.firstName.trim() || (!form.accommodationName.trim() && items.length === 0)) {
            toast.error("Nombre del cliente y al menos un servicio son obligatorios.");
            return;
          }
          setSubmitting(true);
          try {
            const { data: userData, error: userErr } = await supabase.auth.getUser();
            if (userErr || !userData.user) throw new Error("Sesión no válida.");
            const userId = userData.user.id;

            const finalImages = await saveQuotationImages({
              quotationId: id,
              userId,
              newFiles,
              keptPaths,
              previousPaths,
            });

            const clientId = await upsertClientFromQuotation(userId, form);

            const { error: updErr } = await supabase
              .from("quotations")
              .update({ ...formToRow(form), images: finalImages, ...(clientId ? { client_id: clientId } : {}) })
              .eq("id", id);
            if (updErr) throw updErr;

            await saveQuotationItems(id, items);

            toast.success("Cotización actualizada");
            navigate({ to: "/quotations/$id", params: { id } });
          } catch (err) {
            console.error(err);
            toast.error(err instanceof Error ? err.message : "No se pudo actualizar");
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </div>
  );
}
