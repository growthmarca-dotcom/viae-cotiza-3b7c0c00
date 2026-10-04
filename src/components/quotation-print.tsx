import { paymentMethodLabels, readQuotationPromotions } from "@/lib/promotions";
import type { CompanyInfo } from "@/lib/company";
import { convertTotals, formatMoney } from "@/lib/currency";
import {
  CATEGORY_LABELS,
  QUOTATION_ITEM_CATEGORIES,
  type QuotationItemCategory,
} from "@/lib/quotationItems";

/** Servicio de la cotización integral tal como se imprime (sin datos internos). */
export type PrintQuotationItem = {
  category: string;
  title: string | null;
  description: string | null;
  provider_name?: string | null;
  service_date: string | null;
  end_date: string | null;
  time_label: string | null;
  origin: string | null;
  destination: string | null;
  quantity: number | null;
  pax_count: number | null;
  unit_amount: number | null;
  taxes: number | null;
  notes: string | null;
  /** Fotos del producto del Catálogo, en su orden (primera = portada). */
  gallery?: string[];
};


export type PrintQuotation = {
  /** Número comercial legible (COT-AA-000000). Sólo referencia visual. */
  quotation_number?: string | null;
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
  payment_methods?: string[] | null;
  promotions?: unknown;
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
  items = [],
  accommodationGallery = [],
  accommodationMapsUrl = null,
  recommendations = [],
}: {
  recommendations?: { product_id: string; title: string; description: string; destination: string; from_price?: string; cover: string | null }[];
  accommodationGallery?: string[];
  accommodationMapsUrl?: string | null;
  quotation: PrintQuotation;
  items?: PrintQuotationItem[];
  // El documento del cliente nunca lleva ajustes internos (moneda de análisis
  // ni marca del desarrollador).
  company: Omit<CompanyInfo, "analysisCurrency" | "showDeveloperBranding">;
  imageUrls?: string[];
}) {
  const guest = `${q.guest_first_name ?? ""} ${q.guest_last_name ?? ""}`.trim();
  const money = (v: number | null | undefined) =>
    `${q.currency} ${Number(v ?? 0).toLocaleString()}`;
  const totals = convertTotals(q.total_amount, q.currency, q.exchange_rate ?? null);


  const itemAmount = (i: PrintQuotationItem) =>
    Number(i.quantity ?? 1) * Number(i.unit_amount ?? 0) + Number(i.taxes ?? 0);
  const groups = QUOTATION_ITEM_CATEGORIES.map((c) => ({
    category: c.value as QuotationItemCategory,
    label: c.label,
    list: items.filter((i) => i.category === c.value && itemAmount(i) > 0),
  })).filter((g) => g.list.length > 0);
  const detail = (i: PrintQuotationItem) =>
    [
      i.provider_name,
      i.service_date && i.end_date
        ? `${i.service_date} → ${i.end_date}`
        : (i.service_date ?? i.end_date),
      i.time_label,
      i.origin && i.destination ? `${i.origin} → ${i.destination}` : (i.origin ?? i.destination),
      i.pax_count != null ? `${i.pax_count} pax` : null,
      i.quantity != null && Number(i.quantity) > 1 ? `x${Number(i.quantity)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

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
          {q.quotation_number ? ` Nº ${q.quotation_number}` : ""}
        </div>
        <h1 style={{ color: company.primaryColor }}>{q.title}</h1>
        <div className="print-meta">
          {guest ? <span>Cliente: {guest}</span> : null}
          {q.destination ? <span>Destino: {q.destination}</span> : null}
          <span>Fecha: {new Date(q.created_at).toLocaleDateString()}</span>
        </div>
      </section>

      {imageUrls.length > 0 ? <PrintPhotos images={imageUrls} title="Foto" /> : null}

      <section className="print-grid">
        <PrintField label="Ingreso" value={q.travel_start} />
        <PrintField label="Salida" value={q.travel_end} />
        <PrintField label="Noches" value={q.nights} />
        <PrintField label="Pasajeros" value={q.pax_count} />
      </section>

      <PrintBlock title="Alojamiento" color={company.primaryColor}>
        <PrintField label="Nombre" value={q.accommodation_name} />
        <PrintField label="Dirección" value={q.accommodation_address} />
        <PrintField label="Destino" value={q.destination} />
        {accommodationMapsUrl ? (
          <a href={accommodationMapsUrl} className="print-maps" style={{ background: company.primaryColor }}>
            Ver ubicación en Google Maps
          </a>
        ) : null}
        {q.accommodation_description ? (
          <p className="print-text">{q.accommodation_description}</p>
        ) : null}
        {accommodationGallery.length > 0 ? (
          <PrintPhotos images={accommodationGallery} title={q.accommodation_name ?? "Alojamiento"} />
        ) : null}
      </PrintBlock>

      {q.accommodation_services ? (
        <PrintBlock title="Servicios incluidos" color={company.primaryColor}>
          <p className="print-text">{q.accommodation_services}</p>
        </PrintBlock>
      ) : null}

      {groups.map((g) => (
        <PrintBlock key={g.category} title={g.label} color={company.primaryColor}>
          {g.list.map((i, idx) => (
            <div key={`${g.category}-${idx}`} className="print-item">
              <div className="print-line">
                <strong>{i.title || CATEGORY_LABELS[g.category]}</strong>
                <span>{money(itemAmount(i))}</span>
              </div>
              {detail(i) ? <div className="print-item-detail">{detail(i)}</div> : null}
              {i.description ? <p className="print-text">{i.description}</p> : null}
              {i.notes ? <p className="print-text">{i.notes}</p> : null}
              {i.gallery && i.gallery.length > 0 ? (
                <PrintPhotos images={i.gallery} title={i.title ?? CATEGORY_LABELS[g.category]} />
              ) : null}
            </div>
          ))}
        </PrintBlock>
      ))}

      <PrintBlock title="Inversión" color={company.primaryColor}>
        {q.price_per_night != null ? (
          <PrintLine label="Precio por noche" value={money(q.price_per_night)} />
        ) : null}
        {q.taxes != null ? <PrintLine label="Impuestos" value={money(q.taxes)} /> : null}
        {q.other_charges != null ? (
          <PrintLine label="Otros cargos" value={money(q.other_charges)} />
        ) : null}
        {groups.map((g) => (
          <PrintLine
            key={`sub-${g.category}`}
            label={g.label}
            value={money(g.list.reduce((a, i) => a + itemAmount(i), 0))}
          />
        ))}
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


      {readQuotationPromotions(q.promotions).length > 0 ? (
        <PrintBlock title="Promociones disponibles" color={company.primaryColor}>
          <p className="print-text" style={{ fontStyle: "italic" }}>Opciones comerciales ofrecidas para esta propuesta (no acumulables salvo indicación).</p>
          {readQuotationPromotions(q.promotions).map((p, i) => (
            <p key={i} className="print-text">• <strong>{p.title}</strong>{p.text ? ` — ${p.text}` : ""}</p>
          ))}
        </PrintBlock>
      ) : null}

      {paymentMethodLabels(q.payment_methods).length > 0 ? (
        <PrintBlock title="Medios de pago" color={company.primaryColor}>
          <p className="print-text">{paymentMethodLabels(q.payment_methods).join(" · ")}</p>
        </PrintBlock>
      ) : null}

      {q.cancellation_policy ? (
        <PrintBlock title="Política de cancelación" color={company.primaryColor}>
          <p className="print-text">{q.cancellation_policy}</p>
        </PrintBlock>
      ) : null}

      {recommendations.length > 0 ? (
        <PrintBlock title="Recomendados (opcionales, no incluidos en el total)" color={company.primaryColor}>
          {recommendations.map((r) => (
            <div key={r.product_id} className="print-item" style={{ display: "flex", gap: 12, breakInside: "avoid" }}>
              {r.cover ? (
                <img src={r.cover} alt={r.title} style={{ width: 120, height: 80, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
              ) : null}
              <div>
                <p className="print-text" style={{ fontWeight: 600 }}>{r.title}</p>
                {r.destination ? <p className="print-text">{r.destination}</p> : null}
                {r.description ? <p className="print-text">{r.description}</p> : null}
                {r.from_price?.trim() ? <p className="print-text" style={{ fontWeight: 600 }}>Desde $ {r.from_price.trim()}</p> : null}
              </div>
            </div>
          ))}
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

/** Portada grande y el resto en grilla ordenada, sin deformar (object-fit: cover). */
function PrintPhotos({ images, title }: { images: string[]; title: string }) {
  const [cover, ...rest] = images;
  return (
    <div className="print-photos">
      <img src={cover} alt={`${title} — portada`} className="print-cover" loading="eager" />
      {rest.length > 0 ? (
        <div className="print-thumbs">
          {rest.map((u, i) => (
            <img key={u} src={u} alt={`${title} — foto ${i + 2}`} loading="eager" />
          ))}
        </div>
      ) : null}
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
