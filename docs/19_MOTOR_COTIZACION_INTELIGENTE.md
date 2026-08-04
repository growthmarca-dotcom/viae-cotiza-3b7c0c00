# 19 — Motor de Cotización Inteligente (v1.10.6 Fase A)

Estado: **Fase A — solo estructura y trazabilidad**.
No hay cálculo tarifario automático, validación de disponibilidad, reservas,
bloqueo de inventario, envío por WhatsApp, firma digital, pagos ni IA generativa.

---

## 1. Principio

Una **cotización inteligente** (`smart_quotes`) no es un texto con precios: es la
composición trazable de:

- productos y variantes del **Inventario Global**
- tarifas resueltas por el **Motor Tarifario por Producto**
- cupos consultados en el **Motor de Disponibilidad**
- combinaciones propuestas por el **Orquestador Multiproveedor** y el
  **Motor de Paquetes Dinámicos**

Cada componente guarda **snapshots inmutables** del precio y de la
disponibilidad al momento del cálculo. Si mañana cambia una tarifa, la
cotización enviada al cliente sigue siendo auditable.

---

## 2. Arquitectura de datos

```
smart_quotes
 ├── smart_quote_items            (1:N)  componentes cotizados
 │     └── smart_quote_pricing    (1:N)  traza del cálculo por pasajero/regla
 ├── smart_quote_versions         (1:N)  versionado comercial (snapshot)
 └── smart_quote_sources          (1:N)  origen de la información
```

### smart_quotes
Cabecera comercial: origen (`manual`, `orchestrator`, `package`, `external`),
estado, título, destino (país / provincia / ciudad), fechas, pasajeros,
moneda, monto total y `snapshot` consolidado.

Ciclo de vida:

```
draft → calculating → ready → sent → accepted
                                  └→ rejected
   cualquiera → expired
```

### smart_quote_items
Un componente cotizado. Referencia opcional a `products`, `product_variants` y
`package_templates`. Guarda `pricing_snapshot` y `availability_snapshot`.

### smart_quote_pricing
Traza fina del cálculo: perfil tarifario aplicado
(`product_pricing_profiles`), regla concreta (`pricing_rules`), tipo de
pasajero, cantidad, monto base y monto calculado. Permite responder
"¿por qué este precio?".

### smart_quote_versions
Copia inmutable de la propuesta (`snapshot`) por número de versión, con estado
`draft | published | retired`. La versión enviada al cliente queda congelada.

### smart_quote_sources
De dónde salió la información: `internal` (inventario propio), `provider`,
`api` o `manual`, con proveedor y organización asociados.

---

## 3. Flujo completo (visión objetivo)

```
Cliente / Agente
  solicita viaje
        │
        ▼
  ORQUESTADOR              search_requests / search_results
  encuentra opciones
        │
        ▼
  MOTOR DE PAQUETES        package_templates / package_compositions
  combina servicios
        │
        ▼
  MOTOR TARIFARIO          product_pricing_profiles / pricing_rules
  calcula precio           → smart_quote_pricing
        │
        ▼
  MOTOR DISPONIBILIDAD     availability_sources / service_availability
  valida existencia        → availability_snapshot
        │
        ▼
  SMART QUOTE              smart_quotes + items + versions + sources
  guarda propuesta trazable
```

En Fase A solo existe el último bloque como estructura; los enlaces se
activarán en fases posteriores.

---

## 4. Relación con `quotations` actuales

| Aspecto | `quotations` (actual, en producción) | `smart_quotes` (nuevo) |
|---|---|---|
| Origen de datos | carga manual del agente | inventario, tarifas y disponibilidad consultadas |
| Precios | montos escritos a mano | resueltos y trazados por regla |
| Trazabilidad | historial de cambios | snapshots inmutables + versiones |
| Enlace público / PDF | sí, activo | no en Fase A |
| Reservas y comisiones | integrado | sin integración |

`quotations` **no se modifica**. Ambos modelos coexisten: `quotations` sigue
siendo el circuito comercial vivo, y `smart_quotes` es la base del futuro
motor. La convergencia (generar una `quotation` desde una `smart_quote`) es un
paso posterior del roadmap.

---

## 5. Seguridad (RLS)

| Rol | Acceso |
|---|---|
| Administrador | CRUD completo sobre las 5 tablas |
| Operaciones | gestión operativa completa |
| Agente | lectura de las cotizaciones donde es el agente asignado; gestión de las propias (`user_id`) |
| Proveedor | sin acceso a cotizaciones completas |
| Cliente | sin acceso todavía |
| Anónimo | sin acceso |

Tablas hijas resuelven permisos con funciones `SECURITY DEFINER`
`can_read_smart_quote(uuid)` y `can_manage_smart_quote(uuid)` para evitar
recursión de políticas. Todas las tablas tienen `GRANT` explícito a
`authenticated` y `service_role`; nunca a `anon`.

---

## 6. Ejemplos de composición

### Familia (2 adultos + 2 menores, 7 noches)
- `smart_quotes`: destino Bariloche, `source = package`, moneda ARS
- items: alojamiento familiar (1), excursión Cerro Catedral (4), traslado in/out (2)
- pricing: filas separadas por `passenger_type` (`adult`, `child`) con la regla
  de menores aplicada sobre el monto base

### Pareja (aniversario, 4 noches)
- items: hotel boutique (1), cena privada (1), traslado privado (2)
- pricing: `adult` ×2 sin descuentos; upgrade registrado en `calculation_metadata`

### Grupo (18 pasajeros, salida coordinada)
- items: alojamiento (9 habitaciones dobles), excursión (18), transporte 20 plazas (1)
- sources: `internal` para transporte propio y `provider` para el alojamiento

### Corporativo (evento, 30 pax, 3 días)
- items: alojamiento (30), salón (1), traslados aeropuerto (4), catering (3)
- versions: v1 propuesta inicial, v2 ajuste de presupuesto (`published`), v1 `retired`

---

## 7. Fuera de alcance en Fase A

- envío por WhatsApp
- firma digital
- pagos
- reservas y bloqueo de inventario
- IA generativa
- cálculo automático de precios y validación real de cupos

## v1.10.9.2 — Smart Quote MVP Comercial (Fase B4 parcial)

Primera experiencia usable. Sin motor de cálculo, disponibilidad, tarifas dinámicas,
inventario ni orquestador.

### Base de datos
- `smart_quote_items.title` (NOT NULL, no vacío) y `smart_quote_items.description`
  para carga manual de servicios. RLS sin cambios.

### Rutas
- `/smart-quotes` — listado con filtros por estado, agente y búsqueda de cliente.
- `/smart-quotes/$id` — detalle: contexto comercial, constructor de ítems, propuestas.

### Componentes
- `src/components/smart-quote-create-dialog.tsx`
- `src/components/smart-quote-items-panel.tsx`

### Helpers (`src/lib/smartQuotes.ts`)
- `listSmartQuotes`, `getSmartQuote`, `listSmartQuotesByOpportunity`
- `listSmartQuoteItems`, `addSmartQuoteItem`, `deleteSmartQuoteItem`, `recalcSmartQuoteTotal`
- `updateSmartQuoteStatus`, `allowedSmartQuoteTransitions`
- `createQuotationFromSmartQuote`, `listQuotationsBySmartQuote`

### Reglas de negocio
1. La Smart Quote nace **sólo** desde una oportunidad con organización válida.
2. El estado cambia únicamente por `updateSmartQuoteStatus()` respetando
   `SMART_QUOTE_STATUS_FLOW`.
3. `total_amount` es la suma simple de los ítems cargados manualmente.
4. "Generar propuesta" crea una `quotations` con `smart_quote_id`, `opportunity_id`,
   `organization_id` y `client_id`, reutilizando el PDF y el enlace público existentes.
5. El booking conserva smart_quote_id, quotation_id, opportunity_id, organization_id,
   client_id y agent_id (`createBooking`, v1.10.9.1).
6. Permisos: Admin y Operaciones gestionan todo; el agente sólo sus Smart Quotes.
   Organización, oportunidad, cliente y agente permanecen inmutables.
