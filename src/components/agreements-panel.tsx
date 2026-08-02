import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Handshake, Pencil, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AgreementFormDialog } from "@/components/agreement-form-dialog";
import {
  AGREEMENT_STATUS_CLASSES,
  agreementStatusLabel,
  agreementToInput,
  agreementTypeLabel,
  agreementValueLabel,
  createAgreement,
  listAgreements,
  updateAgreement,
  type AgreementInput,
  type AgreementWithRelations,
} from "@/lib/agreements";

/**
 * Panel de acuerdos comerciales reutilizable: se usa en la ficha de
 * organización y en la bandeja global de acuerdos.
 */
export function AgreementsPanel({
  organizationId,
  canManage,
}: {
  organizationId?: string;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<AgreementWithRelations | null>(null);

  const key = ["agreements", { organizationId: organizationId ?? null }];
  const { data: agreements = [] } = useQuery({
    queryKey: key,
    queryFn: () => listAgreements({ organizationId }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["agreements"] });

  const create = useMutation({
    mutationFn: (input: AgreementInput) => createAgreement(input),
    onSuccess: () => {
      toast.success("Acuerdo comercial creado");
      setOpenNew(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: AgreementInput }) =>
      updateAgreement(id, input),
    onSuccess: () => {
      toast.success("Acuerdo actualizado");
      setEditing(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Acuerdos comerciales</h2>
          <p className="text-sm text-muted-foreground">
            Condiciones pactadas con organizaciones y agentes.
          </p>
        </div>
        {canManage && (
          <Button variant="outline" onClick={() => setOpenNew(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nuevo acuerdo
          </Button>
        )}
      </header>

      {agreements.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
          <Handshake className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Todavía no hay acuerdos registrados.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {agreements.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {a.title || agreementTypeLabel(a.agreement_type)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {[
                    a.organization?.trade_name,
                    a.agent
                      ? [a.agent.first_name, a.agent.last_name].filter(Boolean).join(" ")
                      : null,
                    agreementTypeLabel(a.agreement_type),
                    agreementValueLabel(a),
                    a.valid_from || a.valid_until
                      ? `${a.valid_from ?? "—"} → ${a.valid_until ?? "sin límite"}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    AGREEMENT_STATUS_CLASSES[a.status ?? "draft"]
                  }`}
                >
                  {agreementStatusLabel(a.status)}
                </span>
                {canManage && (
                  <Button variant="ghost" size="icon" onClick={() => setEditing(a)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AgreementFormDialog
        open={openNew}
        onOpenChange={setOpenNew}
        lockOrganizationId={organizationId}
        title="Nuevo acuerdo comercial"
        submitLabel="Crear acuerdo"
        submitting={create.isPending}
        onSubmit={(input) => create.mutate(input)}
      />

      <AgreementFormDialog
        open={Boolean(editing)}
        onOpenChange={(v) => !v && setEditing(null)}
        initial={editing ? agreementToInput(editing) : undefined}
        lockOrganizationId={organizationId}
        title="Editar acuerdo comercial"
        submitLabel="Guardar cambios"
        submitting={update.isPending}
        onSubmit={(input) => editing && update.mutate({ id: editing.id, input })}
      />
    </section>
  );
}
