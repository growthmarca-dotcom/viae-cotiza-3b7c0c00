import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addServiceExtra,
  listExtras,
  listServiceExtras,
  removeServiceExtra,
} from "@/lib/resource-catalog";

/**
 * Extras solicitados en un servicio de transporte (v1.8.2):
 * cadenas, sillas infantiles, portaesquí, GPS, etc.
 */
export function ServiceExtrasPanel({ serviceId }: { serviceId: string }) {
  const [extraId, setExtraId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [required, setRequired] = useState(true);
  const [saving, setSaving] = useState(false);

  const catalogQuery = useQuery({ queryKey: ["resource-extras", false], queryFn: () => listExtras() });
  const linksQuery = useQuery({
    queryKey: ["service-extras", serviceId],
    queryFn: () => listServiceExtras(serviceId),
  });

  const catalog = catalogQuery.data ?? [];
  const links = linksQuery.data ?? [];
  const nameOf = new Map(catalog.map((e) => [e.id, e.name]));

  async function add() {
    if (!extraId) {
      toast.error("Elegí un extra del catálogo");
      return;
    }
    setSaving(true);
    try {
      await addServiceExtra({
        serviceId,
        extraId,
        quantity: Number(quantity) || 1,
        isRequired: required,
      });
      setExtraId("");
      setQuantity("1");
      linksQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo agregar el extra");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-border/60 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Extras del servicio</p>

      {linksQuery.isLoading ? (
        <p className="mt-2 flex items-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando extras...
        </p>
      ) : links.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Sin extras solicitados.</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {links.map((l) => (
            <span
              key={l.id}
              className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs"
            >
              {nameOf.get(l.extra_id) ?? "Extra"} × {l.quantity ?? 1}
              {l.is_required ? " · obligatorio" : ""}
              <button
                type="button"
                aria-label="Quitar extra"
                onClick={async () => {
                  await removeServiceExtra(l.id);
                  linksQuery.refetch();
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={extraId}
          onChange={(e) => setExtraId(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Agregar extra...</option>
          {catalog.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <Input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="h-9 w-20"
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
          />
          Obligatorio
        </label>
        <Button size="sm" variant="outline" onClick={add} disabled={saving}>
          <Plus className="mr-1 h-4 w-4" /> Agregar
        </Button>
      </div>
    </div>
  );
}
