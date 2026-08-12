import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  Inbox,
  Loader2,
  PencilLine,
  UserRound,
} from "lucide-react";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/currency";
import {
  moveOpportunityStage,
  stageClasses,
  type Opportunity,
  type OpportunityStage,
} from "@/lib/opportunities";
import {
  PIPELINE_GROUP_LABEL,
  daysInStageLabel,
  sumByCurrency,
  type PipelineStage,
} from "@/lib/pipeline";

type Props = {
  stages: PipelineStage[];
  opportunities: Opportunity[];
  clientName: (id: string | null) => string;
  agentName: (o: Opportunity) => string;
  canEdit: (o: Opportunity) => boolean;
  onChanged: () => void;
  onEditTracking: (o: Opportunity) => void;
};

/** Tablero Kanban del pipeline comercial (v1.10.8.2). */
export function OpportunityKanban({
  stages,
  opportunities,
  clientName,
  agentName,
  canEdit,
  onChanged,
  onEditTracking,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollBy(direction: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(280, el.clientWidth * 0.8), behavior: "smooth" });
  }

  return (
    <div className="relative w-full min-w-0 max-w-full">
      <div className="mb-2 flex justify-end gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => scrollBy(-1)}>
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Etapas anteriores</span>
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => scrollBy(1)}>
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Etapas siguientes</span>
        </Button>
      </div>

      {/* Área horizontal desplazable: el scroll pertenece al Pipeline, no a la página. */}
      <div
        ref={scrollerRef}
        className="w-full min-w-0 max-w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain pb-4"
      >
        <div className="flex w-max flex-nowrap items-start gap-4">
          {stages.map((stage) => {
            const items = opportunities.filter((o) => o.stage === stage.stage);
            const totals = sumByCurrency(items);
            return (
              <section
                key={stage.stage}
                className="flex w-[268px] shrink-0 grow-0 basis-[268px] snap-start flex-col rounded-2xl border border-border bg-secondary/40 sm:w-[290px] sm:basis-[290px]"
              >
                <header className="border-b border-border px-4 py-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <h2 className="truncate font-display text-sm font-semibold">{stage.label}</h2>
                    <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-xs font-medium">
                      {items.length}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {PIPELINE_GROUP_LABEL[stage.group] ?? stage.group}
                  </p>
                  <p className="mt-1 text-xs font-medium text-foreground">
                    {totals.length === 0
                      ? "Sin valor estimado"
                      : totals.map((t) => formatMoney(t.currency, t.total)).join(" · ")}
                  </p>
                </header>

                <div className="max-h-[65vh] flex-1 space-y-3 overflow-y-auto p-3">
                  {items.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                      Sin oportunidades
                    </p>
                  ) : (
                    items.map((o) => (
                      <OpportunityKanbanCard
                        key={o.id}
                        opportunity={o}
                        stages={stages}
                        clientName={clientName}
                        agentName={agentName}
                        editable={canEdit(o)}
                        onChanged={onChanged}
                        onEditTracking={onEditTracking}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}


function OpportunityKanbanCard({
  opportunity: o,
  stages,
  clientName,
  agentName,
  editable,
  onChanged,
  onEditTracking,
}: {
  opportunity: Opportunity;
  stages: PipelineStage[];
  clientName: (id: string | null) => string;
  agentName: (o: Opportunity) => string;
  editable: boolean;
  onChanged: () => void;
  onEditTracking: (o: Opportunity) => void;
}) {
  const [moving, setMoving] = useState(false);

  async function move(stage: string) {
    if (stage === o.stage) return;
    setMoving(true);
    try {
      await moveOpportunityStage({ id: o.id, stage: stage as OpportunityStage });
      toast.success("Etapa actualizada");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar la etapa");
    } finally {
      setMoving(false);
    }
  }

  return (
    <article className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <Link
        to="/opportunities/$id"
        params={{ id: o.id }}
        className="block font-medium leading-tight hover:underline"
      >
        {o.title}
      </Link>
      <p className="mt-1 truncate text-xs text-muted-foreground">{clientName(o.client_id)}</p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">
          {formatMoney(o.currency, Number(o.estimated_value ?? 0))}
        </span>
        <span
          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${stageClasses(o.stage)}`}
        >
          {o.currency}
        </span>
      </div>

      <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
        <div className="flex min-w-0 items-center gap-1.5">
          <UserRound className="h-3 w-3 shrink-0" />
          <span className="truncate">{agentName(o)}</span>
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <CalendarClock className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {o.next_action || "Sin próxima acción"}
            {o.next_contact_date ? ` · ${new Date(o.next_contact_date).toLocaleDateString()}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 shrink-0" />
          <span>{daysInStageLabel(o)}</span>
        </div>
      </dl>

      <div className="mt-3 space-y-2">
        <Select value={o.stage} onValueChange={move} disabled={!editable || moving}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {stages.map((s) => (
              <SelectItem key={s.stage} value={s.stage}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline" className="h-8 flex-1 text-xs">
            <Link to="/opportunities/$id" params={{ id: o.id }}>
              Detalle
            </Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            disabled={!editable}
            onClick={() => onEditTracking(o)}
          >
            {moving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PencilLine className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </article>
  );
}
