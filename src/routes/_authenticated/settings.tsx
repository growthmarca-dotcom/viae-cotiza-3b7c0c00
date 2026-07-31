import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, Save, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { fetchCompany, saveCompany, uploadLogo, type CompanyRow } from "@/lib/company";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Configuración de empresa — ViaE Sales Hub" },
      {
        name: "description",
        content: "Configura logo, datos de contacto, colores y pie de página de tu empresa.",
      },
    ],
  }),
});

type FormState = {
  company_name: string;
  address: string;
  whatsapp: string;
  email: string;
  website: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  linkedin: string;
  primary_color: string;
  accent_color: string;
  footer_text: string;
  analysis_currency: "ARS" | "USD";
  show_developer_branding: boolean;
};

const EMPTY: FormState = {
  company_name: "",
  address: "",
  whatsapp: "",
  email: "",
  website: "",
  instagram: "",
  facebook: "",
  tiktok: "",
  linkedin: "",
  primary_color: "#1F4636",
  accent_color: "#C4A264",
  footer_text: "",
  analysis_currency: "USD",
  show_developer_branding: true,
};

function rowToForm(row: CompanyRow | null): FormState {
  if (!row) return EMPTY;
  return {
    company_name: row.company_name ?? "",
    address: row.address ?? "",
    whatsapp: row.whatsapp ?? "",
    email: row.email ?? "",
    website: row.website ?? "",
    instagram: row.instagram ?? "",
    facebook: row.facebook ?? "",
    tiktok: row.tiktok ?? "",
    linkedin: row.linkedin ?? "",
    primary_color: row.primary_color ?? EMPTY.primary_color,
    accent_color: row.accent_color ?? EMPTY.accent_color,
    footer_text: row.footer_text ?? "",
    analysis_currency: row.analysis_currency === "ARS" ? "ARS" : "USD",
    show_developer_branding: row.show_developer_branding !== false,
  };
}

function SettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["company-settings"], queryFn: fetchCompany });
  const [form, setForm] = useState<FormState>(EMPTY);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setForm(rowToForm(data.row));
      setLogoPreview(data.info.logoUrl);
    }
  }, [data]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onPickLogo(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("El logo debe ser una imagen.");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sesión no válida.");

      let logoPath = data?.row?.logo_path ?? null;
      if (logoFile) logoPath = await uploadLogo(userId, logoFile);

      await saveCompany(userId, {
        ...form,
        company_name: form.company_name || null,
        address: form.address || null,
        whatsapp: form.whatsapp || null,
        email: form.email || null,
        website: form.website || null,
        instagram: form.instagram || null,
        facebook: form.facebook || null,
        tiktok: form.tiktok || null,
        linkedin: form.linkedin || null,
        footer_text: form.footer_text || null,
        show_developer_branding: form.show_developer_branding,
        logo_path: logoPath,
      });

      setLogoFile(null);
      toast.success("Configuración guardada");
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando configuración...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-24">
      <header>
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          <Building2 className="h-3.5 w-3.5 text-gold" /> Configuración de empresa
        </span>
        <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">Tu empresa</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estos datos se aplican automáticamente en los PDFs y en los enlaces compartidos.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-display text-xl font-semibold">Logo</h2>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-xl border border-border bg-secondary/40">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="h-full w-full object-contain p-2" />
            ) : (
              <Building2 className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex gap-2">
            <label>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickLogo(e.target.files?.[0] ?? null)}
              />
              <span className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-secondary">
                <Upload className="h-4 w-4" /> Subir logo
              </span>
            </label>
            {logoPreview && (
              <Button
                variant="ghost"
                onClick={() => {
                  setLogoFile(null);
                  setLogoPreview(null);
                }}
              >
                <X className="mr-2 h-4 w-4" /> Quitar
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-display text-xl font-semibold">Datos comerciales</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Nombre comercial">
            <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} placeholder="ViaE Viajes" />
          </Field>
          <Field label="Dirección">
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Av. Principal 123" />
          </Field>
          <Field label="WhatsApp">
            <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+54 9 11 ..." />
          </Field>
          <Field label="Email">
            <Input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="hola@empresa.com" />
          </Field>
          <Field label="Sitio web">
            <Input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="www.empresa.com" />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-display text-xl font-semibold">Redes sociales</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Instagram">
            <Input value={form.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@empresa" />
          </Field>
          <Field label="Facebook">
            <Input value={form.facebook} onChange={(e) => set("facebook", e.target.value)} placeholder="/empresa" />
          </Field>
          <Field label="TikTok">
            <Input value={form.tiktok} onChange={(e) => set("tiktok", e.target.value)} placeholder="@empresa" />
          </Field>
          <Field label="LinkedIn">
            <Input value={form.linkedin} onChange={(e) => set("linkedin", e.target.value)} placeholder="/company/empresa" />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-display text-xl font-semibold">Colores institucionales</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Color principal">
            <div className="flex gap-2">
              <input
                type="color"
                value={form.primary_color}
                onChange={(e) => set("primary_color", e.target.value)}
                className="h-10 w-14 cursor-pointer rounded-md border border-border bg-transparent"
              />
              <Input value={form.primary_color} onChange={(e) => set("primary_color", e.target.value)} />
            </div>
          </Field>
          <Field label="Color de acento">
            <div className="flex gap-2">
              <input
                type="color"
                value={form.accent_color}
                onChange={(e) => set("accent_color", e.target.value)}
                className="h-10 w-14 cursor-pointer rounded-md border border-border bg-transparent"
              />
              <Input value={form.accent_color} onChange={(e) => set("accent_color", e.target.value)} />
            </div>
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-display text-xl font-semibold">Moneda de análisis</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Todas las estadísticas del sistema (dashboard, pipeline y rendimiento de agentes) se
          expresan en esta moneda. Los importes registrados en otra moneda se convierten usando el
          tipo de cambio de cada cotización, evitando mezclar valores.
        </p>
        <div className="mt-4 flex gap-2">
          {(["ARS", "USD"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set("analysis_currency", c)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                form.analysis_currency === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {c === "ARS" ? "Pesos argentinos (ARS)" : "Dólares (USD)"}
            </button>
          ))}
        </div>
      </section>


      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-display text-xl font-semibold">Pie de página</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Texto legal o de cierre que aparecerá al final de cada PDF y enlace compartido.
        </p>
        <Textarea
          className="mt-4"
          rows={3}
          value={form.footer_text}
          onChange={(e) => set("footer_text", e.target.value)}
          placeholder="Cotización sujeta a disponibilidad. Precios expresados en la moneda indicada."
        />
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-display text-xl font-semibold">Marca del desarrollador</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Muestra u oculta la firma "Desarrollado por MarCa Growth" en las pantallas internas.
          Nunca aparece en las cotizaciones públicas ni en los PDF del cliente.
        </p>
        <div className="mt-4 flex gap-2">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => set("show_developer_branding", v)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                form.show_developer_branding === v
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {v ? "Mostrar" : "Ocultar"}
            </button>
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
