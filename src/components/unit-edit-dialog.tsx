import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Images, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CatalogImage } from "@/components/catalog-image";
import { CATALOG_IMAGE_TYPES, uploadCatalogImage } from "@/lib/catalog";
import { unitImages, updateUnit, type AvailabilityUnit } from "@/lib/accommodationAvailability";

/** Datos y fotos propias de una unidad. Las fotos generales de la propiedad no se tocan. */
export function UnitEditDialog({
  unit,
  organizationId,
  onClose,
  onSaved,
  propertyImages = [],
}: {
  /** Fotos de la galería general de la propiedad (mismas referencias, sin copiar archivos). */
  propertyImages?: string[];
  unit: AvailabilityUnit | null;
  organizationId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const toggleExisting = (src: string) =>
    setImages((prev) => (prev.includes(src) ? prev.filter((x) => x !== src) : [...prev, src]));
  useEffect(() => {
    if (!unit) return;
    setName(unit.name);
    setDescription(unit.description ?? "");
    setCapacity(unit.capacity_max != null ? String(unit.capacity_max) : "");
    setImages(unitImages(unit));
  }, [unit]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const added: string[] = [];
    for (const f of Array.from(files)) {
      try { added.push(await uploadCatalogImage(organizationId ?? "", f)); }
      catch (e) { toast.error(`${f.name}: ${e instanceof Error ? e.message : "error"}`); }
    }
    setImages((prev) => [...prev, ...added]);
    setBusy(false);
  }
  const move = (i: number, d: number) =>
    setImages((prev) => { const n = [...prev]; const j = i + d; if (j < 0 || j >= n.length) return n; [n[i], n[j]] = [n[j], n[i]]; return n; });

  async function save() {
    if (!unit) return;
    setBusy(true);
    try {
      await updateUnit(unit, { name, description, capacity_max: capacity ? Number(capacity) : null, images });
      toast.success("Unidad actualizada");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!unit} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar unidad</DialogTitle>
          <DialogDescription>Datos y fotos propios de esta unidad. Las fotos generales de la propiedad no cambian.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <label className="text-sm">Nombre<Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></label>
          <label className="text-sm">Capacidad máx.<Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} /></label>
        </div>
        <label className="text-sm">Descripción<Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1500} /></label>
        <div className="space-y-2">
          <p className="text-sm font-medium">Fotos de la unidad</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.map((src, i) => (
              <div key={src} className="relative overflow-hidden rounded-lg border">
                <CatalogImage src={src} alt={`Foto ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
                {i === 0 && <span className="absolute left-1 top-1 rounded bg-background/90 px-1.5 text-[10px]">Portada</span>}
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-background/80 p-0.5">
                  <button type="button" aria-label="Mover antes" onClick={() => move(i, -1)}><ArrowLeft className="h-4 w-4" /></button>
                  <button type="button" aria-label="Quitar foto" onClick={() => setImages(images.filter((x) => x !== src))}><Trash2 className="h-4 w-4" /></button>
                  <button type="button" aria-label="Mover después" onClick={() => move(i, 1)}><ArrowRight className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
          {propertyImages.length > 0 && (
            <Button type="button" size="sm" variant="outline" onClick={() => setPicking((v) => !v)}>
              <Images className="mr-2 h-4 w-4" /> {picking ? "Ocultar galería" : "Elegir fotos existentes"}
            </Button>
          )}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Subir fotos (JPG, PNG, WebP · hasta 5 MB)
            <input type="file" multiple accept={CATALOG_IMAGE_TYPES.join(",")} className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
          </label>
          </div>
          {picking && (
            <div className="space-y-1 rounded-lg border border-dashed p-2">
              <p className="text-xs text-muted-foreground">Galería del alojamiento: tocá las fotos que pertenecen a esta unidad. La galería general no cambia.</p>
              <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5">
                {propertyImages.map((src, i) => {
                  const on = images.includes(src);
                  return (
                    <button key={src} type="button" aria-pressed={on} aria-label={`Foto ${i + 1} de la galería`} onClick={() => toggleExisting(src)}
                      className={`relative overflow-hidden rounded-md border-2 ${on ? "border-primary" : "border-transparent opacity-80"}`}>
                      <CatalogImage src={src} alt={`Galería ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
                      {on && <Check className="absolute right-1 top-1 h-4 w-4 rounded-full bg-primary p-0.5 text-primary-foreground" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>Guardar unidad</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
