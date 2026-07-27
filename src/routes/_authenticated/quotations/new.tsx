import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { QuotationForm } from "@/components/quotation-form";
import { formToRow, saveQuotationImages } from "@/lib/quotations";

export const Route = createFileRoute("/_authenticated/quotations/new")({
  component: NewQuotationPage,
  head: () => ({
    meta: [
      { title: "Nueva cotización — ViaE" },
      { name: "description", content: "Crea una nueva cotización de viaje." },
    ],
  }),
});

function NewQuotationPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

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

      <QuotationForm
        submitting={submitting}
        submitLabel="Generar cotización"
        onCancel={() => navigate({ to: "/dashboard" })}
        onSubmit={async ({ form, newFiles }) => {
          if (!form.firstName.trim() || !form.accommodationName.trim()) {
            toast.error("Nombre del cliente y nombre del alojamiento son obligatorios.");
            return;
          }
          setSubmitting(true);
          try {
            const { data: userData, error: userErr } = await supabase.auth.getUser();
            if (userErr || !userData.user) throw new Error("Sesión no válida.");
            const userId = userData.user.id;

            const { data: inserted, error: insertErr } = await supabase
              .from("quotations")
              .insert({ ...formToRow(form), user_id: userId, status: "draft" })
              .select("id")
              .single();
            if (insertErr) throw insertErr;

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
