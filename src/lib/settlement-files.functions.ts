import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Archivos de liquidaciones (facturas y comprobantes de pago) — Fase C1.2.
 *
 * El bucket `commission-documents` es PRIVADO: no hay URLs públicas. La subida
 * y la lectura pasan siempre por el servidor, que primero verifica quién es el
 * usuario y si le corresponde ese documento (administración o beneficiario) y
 * después firma una URL temporal.
 */

const BUCKET = "commission-documents";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/jpg": ["jpg", "jpeg"],
  "image/png": ["png"],
};

type UploadInput = {
  settlementId: string;
  kind: "invoice" | "payment_proof";
  fileName: string;
  mimeType: string;
  /** Contenido del archivo en base64 (sin prefijo data:). */
  content: string;
};

function validateFile(fileName: string, mimeType: string, bytes: number) {
  const mime = mimeType.toLowerCase();
  const exts = ALLOWED[mime];
  if (!exts) return "invalid_mime_type";
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  // No confiamos sólo en la extensión: tienen que coincidir tipo y extensión.
  if (!exts.includes(ext)) return "invalid_extension";
  if (bytes <= 0) return "empty_file";
  if (bytes > MAX_BYTES) return "file_too_large";
  return null;
}

export const uploadSettlementFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: UploadInput) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (data.kind === "payment_proof" && !isAdmin) {
      return { ok: false as const, reason: "forbidden" };
    }

    if (!isAdmin) {
      const { data: isBeneficiary } = await supabase.rpc("is_settlement_beneficiary", {
        _user_id: userId,
        _settlement_id: data.settlementId,
      });
      if (!isBeneficiary) return { ok: false as const, reason: "forbidden" };
    }

    const bytes = Buffer.from(data.content, "base64");
    const invalid = validateFile(data.fileName, data.mimeType, bytes.byteLength);
    if (invalid) return { ok: false as const, reason: invalid };

    const ext = (data.fileName.split(".").pop() ?? "bin").toLowerCase();
    const path = `${data.settlementId}/${data.kind}/${crypto.randomUUID()}.${ext}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: data.mimeType, upsert: false });
    if (error) return { ok: false as const, reason: error.message };

    return { ok: true as const, path, size: bytes.byteLength };
  });

export const getSettlementFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { path: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // RLS decide: si el usuario no puede leer el documento ni el pago que
    // referencian ese archivo, no se firma nada.
    const [{ data: doc }, { data: payment }] = await Promise.all([
      supabase
        .from("commission_settlement_documents")
        .select("id")
        .eq("file_path", data.path)
        .maybeSingle(),
      supabase
        .from("commission_settlement_payments")
        .select("id")
        .eq("payment_proof_path", data.path)
        .maybeSingle(),
    ]);
    if (!doc && !payment) return { ok: false as const, reason: "forbidden" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(data.path, 120);
    if (error || !signed) return { ok: false as const, reason: "sign_failed" };

    return { ok: true as const, url: signed.signedUrl };
  });
