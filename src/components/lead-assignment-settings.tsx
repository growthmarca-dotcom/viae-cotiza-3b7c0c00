import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Workflow } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { fetchCompany, saveCompany } from "@/lib/company";
import {
  ASSIGNMENT_RULE_LABELS,
  DEFAULT_ASSIGNMENT_RULES,
  parseAssignmentRules,
  type LeadAssignmentMode,
  type LeadAssignmentRules,
} from "@/lib/leads";

/**
 * Configuración de distribución de leads (v1.7).
 * El modo automático usa las reglas activadas para sugerir el agente;
 * la asignación siempre queda registrada en el historial del lead.
 */
export function LeadAssignmentSettings() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["company-settings"], queryFn: fetchCompany });
  const [mode, setMode] = useState<LeadAssignmentMode>("manual");
  const [enabled, setEnabled] = useState(true);
  const [rules, setRules] = useState<LeadAssignmentRules>(DEFAULT_ASSIGNMENT_RULES);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const row = data?.row;
    if (!row) return;
    setMode((row.lead_assignment_mode as LeadAssignmentMode) ?? "manual");
    setEnabled(row.lead_assignment_enabled !== false);
    setRules(parseAssignmentRules(row.lead_assignment_rules));
  }, [data]);

  async function handleSave() {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sesión no válida.");
      await saveCompany(userId, {
        lead_assignment_mode: mode,
        lead_assignment_enabled: enabled,
        lead_assignment_rules: rules,
      });
      toast.success("Configuración de asignación guardada");
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 text-muted-foreground shadow-sm">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Cargando configuración...
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
        <Workflow className="h-5 w-5 text-gold" /> Distribución de leads
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Define cómo se reparten las consultas entrantes entre los agentes de la red comercial.
      </p>

      <div className="mt-4 flex gap-2">
        {(["manual", "automatic"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              mode === m
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {m === "manual" ? "Manual" : "Automático"}
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between rounded-xl border border-border p-4">
        <div>
          <Label>Asignación activa</Label>
          <p className="text-xs text-muted-foreground">
            Si está desactivada, todos los leads entran a la bandeja como "Sin asignar".
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <div className="mt-5">
        <p className="text-sm font-medium">Criterios de asignación automática</p>
        <p className="text-xs text-muted-foreground">
          El sistema sugiere el agente más adecuado según los criterios activados. La asignación
          final siempre puede corregirse a mano.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {ASSIGNMENT_RULE_LABELS.map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <span className={mode === "automatic" ? "" : "text-muted-foreground"}>{label}</span>
              <Switch
                checked={rules[key]}
                disabled={mode !== "automatic"}
                onCheckedChange={(v) => setRules((r) => ({ ...r, [key]: v }))}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar asignación
        </Button>
      </div>
    </section>
  );
}
