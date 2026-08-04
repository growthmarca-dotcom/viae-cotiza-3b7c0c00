import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/currency";
import {
  SMART_QUOTE_STATUS_LABELS,
  listSmartQuotes,
  smartQuoteAgentLabel,
  smartQuoteClientLabel,
  smartQuoteStatusClasses,
  type SmartQuoteStatus,
} from "@/lib/smartQuotes";

export const Route = createFileRoute("/_authenticated/smart-quotes/")({
  component: SmartQuotesPage,
  head: () => ({
    meta: [
      { title: "Cotizaciones inteligentes — ViaE Sales Hub" },
      {
        name: "description",
        content:
          "Motor comercial de cotizaciones inteligentes: estado, cliente, oportunidad y agente responsable.",
      },
      { property: "og:title", content: "Cotizaciones inteligentes — ViaE Sales Hub" },
      {
        property: "og:description",
        content: "Listado de Smart Quotes con filtros por estado, agente y cliente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const STATUSES = Object.keys(SMART_QUOTE_STATUS_LABELS) as SmartQuoteStatus[];

function SmartQuotesPage() {
  const [status, setStatus] = useState<SmartQuoteStatus | "all">("all");
  const [agentId, setAgentId] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["smart-quotes"],
    queryFn: () => listSmartQuotes(),
  });

  const rows = data ?? [];

  const agents = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.agent_id) map.set(r.agent_id, smartQuoteAgentLabel(r));
    });
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (agentId !== "all" && r.agent_id !== agentId) return false;
      if (term && !smartQuoteClientLabel(r).toLowerCase().includes(term)) return false;
      return true;
    });
  }, [rows, status, agentId, search]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold sm:text-3xl">
          <Sparkles className="h-5 w-5 text-gold" /> Cotizaciones inteligentes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Motor comercial del flujo Oportunidad → Smart Quote → Propuesta → Reserva.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={status} onValueChange={(v) => setStatus(v as SmartQuoteStatus | "all")}>
          <SelectTrigger>
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {SMART_QUOTE_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={agentId} onValueChange={setAgentId}>
          <SelectTrigger>
            <SelectValue placeholder="Agente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los agentes</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando cotizaciones inteligentes...
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          No hay cotizaciones inteligentes. Se crean desde el detalle de una oportunidad del
          pipeline comercial.
        </p>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Cotización</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Oportunidad</th>
                  <th className="px-4 py-3 font-medium">Agente</th>
                  <th className="px-4 py-3 font-medium">Creada</th>
                  <th className="px-4 py-3 font-medium">Monto</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-border/60 hover:bg-secondary/20">
                    <td className="px-4 py-3">
                      <Link
                        to="/smart-quotes/$id"
                        params={{ id: r.id }}
                        className="font-medium hover:text-primary"
                      >
                        {r.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{smartQuoteClientLabel(r)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.opportunities ? (
                        <Link
                          to="/opportunities/$id"
                          params={{ id: r.opportunities.id }}
                          className="hover:text-primary"
                        >
                          {r.opportunities.title}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{smartQuoteAgentLabel(r)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {r.total_amount == null
                        ? "—"
                        : formatMoney(r.currency, Number(r.total_amount))}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${smartQuoteStatusClasses(r.status)}`}
                      >
                        {SMART_QUOTE_STATUS_LABELS[r.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {filtered.map((r) => (
              <Link
                key={r.id}
                to="/smart-quotes/$id"
                params={{ id: r.id }}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <p className="truncate font-display text-lg font-semibold">{r.title}</p>
                <p className="text-sm text-muted-foreground">
                  {smartQuoteClientLabel(r)} · {smartQuoteAgentLabel(r)}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${smartQuoteStatusClasses(r.status)}`}
                  >
                    {SMART_QUOTE_STATUS_LABELS[r.status]}
                  </span>
                  <span className="text-sm font-medium">
                    {r.total_amount == null ? "—" : formatMoney(r.currency, Number(r.total_amount))}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
