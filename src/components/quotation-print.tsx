import type { CompanyInfo } from "@/lib/company";
import { convertTotals, formatMoney } from "@/lib/currency";


export type PrintQuotation = {
  title: string;
  destination: string | null;
  travel_start: string | null;
  travel_end: string | null;
  nights: number | null;
  pax_count: number | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  accommodation_name: string | null;
  accommodation_address: string | null;
  accommodation_description: string | null;
  accommodation_services: string | null;
  cancellation_policy: string | null;
  price_per_night: number | null;
  taxes: number | null;
  other_charges?: number | null;
  total_amount: number | null;
  currency: string;
  exchange_rate?: number | null;
  notes: string | null;

  created_at: string;
};

/**
 * Documento pensado exclusivamente para impresión / PDF.
 * Oculto en pantalla, visible sólo al imprimir (ver @media print en styles.css).
 * Usa el logo, los colores y los datos de contacto de la configuración de empresa.
 */
export function QuotationPrintDocument({
  quotation: q,
  company,
  imageUrls = [],
}: {
  quotation: PrintQuotation;
  company: Omit<CompanyInfo, "analysisCurrency">;
  imageUrls?: string[];
}) {
  const guest = `${q.guest_first_name ?? ""} ${q.guest_last_name ?? ""}`.trim();
  const money = (v: number | null | undefined) =>
    `${q.currency} ${Number(v ?? 0).toLocaleString()}`;
  const totals = convertTotals(q.total_amount, q.currency, q.exchange_rate ?? null);


  const contact = [company.whatsapp, company.email, company.website].filter(Boolean);
  const socials = [
    company.instagram && `Instagram: ${company.instagram}`,
    company.facebook && `Facebook: ${company.facebook}`,
    company.tiktok && `TikTok: ${company.tiktok}`,
    company.linkedin && `LinkedIn: ${company.linkedin}`,
  ].filter(Boolean) as string[];

  return (
    <div data-print-only className="print-doc" style={{ color: "#1a1a1a" }}>
      <header
        className="print-header"
        style={{ borderBottom: `3px solid ${company.accentColor}`, background: company.primaryColor }}
      >
        <div className="print-header-inner">
          <div className="print-brand">
            {company.logoUrl ? (
              <img src={company.logoUrl} alt={company.companyName ?? "Logo"} className="print-logo" />
            ) : null}
            <div>
              {company.companyName ? (
                <div className="print-brand-name">{company.companyName}</div>
              ) : null}
              {company.address ? <div className="print-brand-sub">{company.address}</div> : null}
            </div>
          </div>
          <div className="print-contact">
            {contact.map((c) => (
              <div key={c as string}>{c}</div>
            ))}
          </div>
        </div>
      </header>

      <section className="print-title">
        <div className="print-eyebrow" style={{ color: company.accentColor }}>
          Cotización de viaje
        </div>
        <h1 style={{ color: company.primaryColor }}>{q.title}</h1>
        <div className="print-meta">
          {guest ? <span>Cliente: {guest}</span> : null}
          {q.destination ? <span>Destino: {q.destination}</span> : null}
          <span>Fecha: {new Date(q.created_at).toLocaleDateString()}</span>
        </div>
      </section>

      {imageUrls.length > 0 ? (
        <section className="print-gallery">
          {imageUrls.slice(0, 3).map((u, i) => (
            <img key={u} src={u} alt={`Foto ${i + 1}`} />
          ))}
        </section>
      ) : null}

      <section className="print-grid">
        <PrintField label="Ingreso" value={q.travel_start} />
        <PrintField label="Salida" value={q.travel_end} />
        <PrintField label="Noches" value={q.nights} />
        <PrintField label="Pasajeros" value={q.pax_count} />
      </section>

      <PrintBlock title="Alojamiento" color={company.primaryColor}>
        <PrintField label="Nombre" value={q.accommodation_name} />
        <PrintField label="Dirección" value={q.accommodation_address} />
        {q.accommodation_description ? (
          <p className="print-text">{q.accommodation_description}</p>
        ) : null}
      </PrintBlock>

      {q.accommodation_services ? (
        <PrintBlock title="Servicios incluidos" color={company.primaryColor}>
          <p className="print-text">{q.accommodation_services}</p>
        </PrintBlock>
      ) : null}

      <PrintBlock title="Inversión" color={company.primaryColor}>
        {q.price_per_night != null ? (
          <PrintLine label="Precio por noche" value={money(q.price_per_night)} />
        ) : null}
        {q.taxes != null ? <PrintLine label="Impuestos" value={money(q.taxes)} /> : null}
        {q.other_charges != null ? (
          <PrintLine label="Otros cargos" value={money(q.other_charges)} />
        ) : null}
        <div className="print-total" style={{ borderTop: `2px solid ${company.accentColor}` }}>
          <span>Total</span>
          <strong style={{ color: company.primaryColor }}>{money(q.total_amount)}</strong>
        </div>
        <PrintLine label="Moneda utilizada" value={q.currency} />
        <PrintLine
          label="Tipo de cambio utilizado"
          value={totals.rate != null ? `1 USD = ARS ${totals.rate.toLocaleString("es-AR")}` : "—"}
        />
        <PrintLine
          label="Total en USD"
          value={totals.totalUsd != null ? formatMoney("USD", totals.totalUsd) : "—"}
        />
        <PrintLine
          label="Total en ARS"
          value={totals.totalArs != null ? formatMoney("ARS", totals.totalArs) : "—"}
        />
        <PrintLine
          label="Fecha de la cotización"
          value={new Date(q.created_at).toLocaleDateString()}
        />
      </PrintBlock>


      {q.cancellation_policy ? (
        <PrintBlock title="Política de cancelación" color={company.primaryColor}>
          <p className="print-text">{q.cancellation_policy}</p>
        </PrintBlock>
      ) : null}

      {q.notes ? (
        <PrintBlock title="Observaciones" color={company.primaryColor}>
          <p className="print-text">{q.notes}</p>
        </PrintBlock>
      ) : null}

      <footer className="print-footer" style={{ borderTop: `2px solid ${company.accentColor}` }}>
        <div>
          {company.footerText ??
            (company.companyName
              ? `${company.companyName} — Cotización sin valor contractual.`
              : "Cotización sin valor contractual.")}
        </div>
        {socials.length > 0 ? <div className="print-socials">{socials.join(" · ")}</div> : null}
      </footer>
    </div>
  );
}

function PrintBlock({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <section className="print-block">
      <h2 style={{ color }}>{title}</h2>
      {children}
    </section>
  );
}

function PrintField({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="print-field">
      <span className="print-label">{label}</span>
      <span className="print-value">{value == null || value === "" ? "—" : String(value)}</span>
    </div>
  );
}

function PrintLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="print-line">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
