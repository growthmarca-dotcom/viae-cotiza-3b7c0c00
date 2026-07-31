import { useState } from "react";
import { CalendarClock, Loader2, Plus, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/currency";
import {
  LEAD_SOURCES,
  NEXT_ACTIONS,
  OPPORTUNITY_STAGES,
  stageClasses,
  stageLabel,
  updateOpportunity,
  type LeadSource,
  type Opportunity,
  type OpportunityStage,
} from "@/lib/opportunities";

type Props = {
  opportunities: Opportunity[];
  responsables: { id: string; label: string }[];
  creating?: boolean;
  onCreate?: () => void;
  onChanged: () => void;
};

/**
 * Pipeline comercial del cliente: lista cronológica de oportunidades editables en línea.
 */
export function OpportunityPanel({
  opportunities,
  responsables,
  creating,
  onCreate,
  onChanged,
}: Props) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
          <Target className="h-4 w-4 text-gold" /> Oportunidades comerciales
        </h2>
        {onCreate && (
          <Button variant="outline" size="sm" onClick={onCreate} disabled={creating}>
            {creating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Nueva oportunidad
          </Button>
        )}
      </div>

      {opportunities.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Este cliente todavía no tiene oportunidades. Se crean automáticamente al generar una
          cotización.
        </p>
      ) : (
        <div className="space-y-4">
          {opportunities.map((o) => (
            <OpportunityCard
              key={o.id}
              opportunity={o}
              responsables={responsables}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OpportunityCard({
  opportunity,
  responsables,
  onChanged,
}: {
  opportunity: Opportunity;
  responsables: { id: string; label: string }[];
  onChanged: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [probability, setProbability] = useState(String(opportunity.probability ?? 0));
  const [customAction, setCustomAction] = useState(
    opportunity.next_action && !NEXT_ACTIONS.includes(opportunity.next_action as never)
      ? opportunity.next_action
      : "",
  );

  async function patch(values: Parameters<typeof updateOpportunity>[1]) {
    setSaving(true);
    try {
      await updateOpportunity(opportunity.id, values);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar la oportunidad");
    } finally {
      setSaving(false);
    }
  }

  const selectedAction = opportunity.next_action
    ? NEXT_ACTIONS.includes(opportunity.next_action as never)
      ? opportunity.next_action
      : "Otro"
    : "";

  const ownerLabel =
    responsables.find((r) => r.id === opportunity.owner_user_id)?.label ?? "Responsable actual";

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{opportunity.title}</p>
          <p className="text-xs text-muted-foreground">
            Creada el {new Date(opportunity.created_at).toLocaleDateString()} ·{" "}
            {formatMoney(opportunity.currency, opportunity.estimated_value)}
          </p>
        </div>
        <span
          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${stageClasses(opportunity.stage)}`}
        >
          {stageLabel(opportunity.stage)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Estado</Label>
          <Select
            value={opportunity.stage}
            onValueChange={(v) => patch({ stage: v as OpportunityStage })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPPORTUNITY_STAGES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Origen del lead
          </Label>
          <Select
            value={opportunity.lead_source}
            onValueChange={(v) => patch({ lead_source: v as LeadSource })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_SOURCES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Valor estimado ({opportunity.currency})
          </Label>
          <Input
            className="mt-1"
            type="number"
            min={0}
            step="0.01"
            defaultValue={opportunity.estimated_value ?? 0}
            onBlur={(e) => {
              const v = Number(e.target.value) || 0;
              if (v !== Number(opportunity.estimated_value)) patch({ estimated_value: v });
            }}
          />
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Probabilidad de cierre (%)
          </Label>
          <Input
            className="mt-1"
            type="number"
            min={0}
            max={100}
            value={probability}
            onChange={(e) => setProbability(e.target.value)}
            onBlur={() => {
              const v = Math.min(100, Math.max(0, Number(probability) || 0));
              setProbability(String(v));
              if (v !== Number(opportunity.probability)) patch({ probability: v });
            }}
          />
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Próxima acción
          </Label>
          <Select
            value={selectedAction}
            onValueChange={(v) => {
              if (v === "Otro") {
                patch({ next_action: customAction || "Otro" });
              } else {
                setCustomAction("");
                patch({ next_action: v });
              }
            }}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Sin definir" />
            </SelectTrigger>
            <SelectContent>
              {NEXT_ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedAction === "Otro" && (
            <Input
              className="mt-2"
              placeholder="Describe la acción"
              value={customAction}
              onChange={(e) => setCustomAction(e.target.value)}
              onBlur={() => patch({ next_action: customAction || "Otro" })}
            />
          )}
        </div>

        <div>
          <Label className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
            <CalendarClock className="h-3 w-3" /> Fecha del próximo contacto
          </Label>
          <Input
            className="mt-1"
            type="date"
            defaultValue={opportunity.next_contact_date ?? ""}
            onChange={(e) => patch({ next_contact_date: e.target.value || null })}
          />
        </div>

        <div className="sm:col-span-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Responsable
          </Label>
          <Select
            value={opportunity.owner_user_id}
            onValueChange={(v) => patch({ owner_user_id: v })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder={ownerLabel} />
            </SelectTrigger>
            <SelectContent>
              {responsables.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            Por ahora el responsable es el usuario que creó la cotización. En una próxima versión
            podrá asignarse a un Agente del sistema.
          </p>
        </div>
      </div>

      {saving && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Guardando...
        </p>
      )}
    </div>
  );
}
