# 20 — Auditoría general ViaE Sales Hub (agosto 2026)

> Informe de estado. **No incluye cambios de código**: es diagnóstico + plan.
> Evidencia: código en `src/**`, base viva (`pg_policies`, `pg_proc`, `COUNT(*)` real)
> y linter de la base (190 advertencias).

## Resumen ejecutivo

| Dimensión | Estado | Nota |
| --- | --- | --- |
| Funcionalidad núcleo (Leads → Oportunidad → Cotización → Reserva) | ✅ Operativa | Usable comercialmente hoy |
| Motores avanzados (tarifas, disponibilidad, itinerarios, inventario, orquestador, paquetes) | 🔵 Solo esquema | 0 imports desde rutas/componentes |
| Modelo de datos | 🟡 En transición | 78 tablas, ~45 vacías, duplicación real de entidades |
| Seguridad | 🟡 Buena base, 2 huecos concretos | RLS completa; 1 función escribible por anónimos |
| UX / navegación por rol | 🟡 Débil | Menú casi idéntico para todos los roles |
| Producción / SEO | 🟡 Aceptable | `robots.txt` indexa enlaces privados |

Veredicto: **el sistema sirve para operar hoy**, pero acumula deuda estructural que se
vuelve mucho más caro de corregir a medida que entren datos reales (tenants, monedas,
identidades). Hay que estabilizar antes de seguir agregando motores.

---

## 1. Auditoría funcional

### Completo (CRUD + flujo end-to-end)

| Módulo | Evidencia |
| --- | --- |
| Consultas / Leads | `routes/_authenticated/leads.tsx`, `leads_.$id.tsx`, `lib/leads.ts`, asignación manual/automática |
| CRM de clientes | `clients.tsx`, `clients_.$id.tsx` (ficha 360°), `lib/clients.ts` + `lib/crm.ts` |
| Pipeline / Oportunidades | Kanban + lista + ficha, `lib/opportunities.ts`, `lib/pipeline.ts`, historial append-only |
| Cotizaciones legacy | listado, alta, edición, duplicado, archivado, PDF, enlace público `/cotizacion/$token` |
| Smart Quotes | cabecera editable, ítems inline, versionado, panel de compartir, público `/propuesta/$token` |
| Reservas (expediente 360°) | `bookings_.$id.tsx` (913 líneas): resumen, operación (recursos/transporte/checklist/incidencias), economía, documentos, comunicaciones, comisiones, timeline |
| Proveedores / Organizaciones / Agentes / Recursos | listados + fichas + formularios completos |
| Transporte / Agenda / Panel conductor | `transport.tsx`, `agenda.tsx`, `driver.tsx` (730 líneas, móvil-first) |
| Acuerdos comerciales | `agreements.tsx` + panel en ficha de organización |

### Parcial

- **Central operativa** (`operations.tsx`): asignación manual; no usa `orchestrator`/`availability`.
- **Roles y permisos**: `use-account` expone solo `isAdmin` / `isOperations` / `isApproved`.
  El gating se repite inline en ~17 rutas; no hay matriz de permisos por módulo.
  **No existe rol `driver`**: `/driver` es visible para cualquier cuenta aprobada.
- **Configuración** (`settings.tsx`): branding y moneda; sin administración de permisos.
- **Comunicaciones**: `communication_events` registra, no envía (WhatsApp/email reales pendientes).

### Solo estructura (0 uso desde la UI)

`tariffs`, `availability`, `itineraries`, `inventory`/`products`, `productPricing`,
`productAvailability`, `orchestrator` + `orchestratorResolution`, `packages`,
`resource-catalog`, `persons`/`person_roles`, `commissions` (devengo; solo hay simulación).

---

## 2. Auditoría de arquitectura

78 tablas, 174 claves foráneas. **~45 tablas con 0 filas.** Conviven dos modelos:
legacy mono-usuario (`user_id`, `organization_id` nullable) y multi-tenant nuevo
(`organization_id NOT NULL`).

### Duplicaciones reales

| Duplicación | Problema | Recomendación |
| --- | --- | --- |
| `clients` / `leads` / `agents` vs `persons` | `persons` y `person_roles` **vacías**; nombre/email duplicados en cada tabla; `person_id` nullable | Poblar `persons`, luego `person_id NOT NULL` y deprecar campos planos |
| `companies` vs `providers` vs `organizations` | mismo shape (trade_name, tax_id, contacto); `resources` referencia a los tres (`company_id`, `owner_company_id`, `provider_id`) | Declarar `organizations` canónica; `providers` = rol, no entidad |
| `exchange_rates` vs `currency_exchange_rates` | dos sistemas de TC; el viejo usa moneda como **texto libre**, ambos vacíos | Eliminar `exchange_rates`, consolidar en `currency_exchange_rates` |
| `organization_roles` vs `organization_members` | `members.role` es un enum paralelo sin FK a `organization_roles` | FK o fusión |
| `resources` (76 col.) vs `products` | catálogo operativo monolítico vs catálogo genérico | Modelar recursos como variante de producto o documentar la separación |
| `transport_services` vs `booking_services` | economía, estado y partes casi idénticas; `transport_services.booking_id` nullable | Fusionar con `kind='transport'` + extensión |
| `quotations` vs `smart_quotes` | ambas guardan cliente, moneda, total y estado | `quotations` debería ser proyección/documento de `smart_quotes` |

### Campos y restricciones faltantes

- `organization_id` **nullable en ~24 tablas** (`resources`, `transport_services`,
  `booking_services`, `booking_service_economics`, `commissions`, `smart_quotes`,
  `tariff_*`, `availability_*`, `search_*`, `package_*`…). El aislamiento multi-tenant
  depende solo de la política RLS, no del esquema. **Es la deuda más costosa de postergar.**
- Monedas como `text` libre (`quotations.currency`, `transport_services.*_currency`,
  `resources.rental_deposit_currency`) en lugar de FK a `currencies.id`.
- Sin `created_by`/`updated_by` estándar en tablas transaccionales core.
- Borrado lógico inconsistente: `record_status` en 6 tablas, `archived` en cotizaciones,
  `status` ad hoc en el resto.
- `opportunity_history` sin `created_at`/`updated_at`.

**Escalabilidad**: el diseño *permite* llegar a plataforma profesional (tenant raíz,
motores separados, snapshots económicos inmutables), pero no está *cerrado*: falta
completar la migración de identidad y unificar catálogos antes de que haya volumen.

---

## 3. Auditoría de seguridad

Base sólida: RLS habilitada en **todas** las tablas de `public`, ninguna con `GRANT`
a `anon`, ninguna política menciona `anon`, todas las funciones `SECURITY DEFINER`
tienen `search_path` fijo, y `supabaseAdmin` solo se importa dinámicamente dentro de
handlers de servidor.

| # | Hallazgo | Severidad |
| --- | --- | --- |
| 1 | `ensure_provider_organization(uuid)` es `SECURITY DEFINER`, **ejecutable por anónimos y sin verificar `auth.uid()`**: un llamador no autenticado que conozca un `provider_id` puede crear una `organization`, un `organization_role` y modificar `providers.organization_id`. | **Crítico** |
| 2 | ~70 funciones `SECURITY DEFINER` conservan el `EXECUTE` por defecto para `anon`/`PUBLIC` (incluidas `smart_quote_share_token`, `smart_quote_share_revoke`, `mark_notifications_read`, `simulate_commission`, `claim_admin_if_none`). Todas verifican internamente sesión/rol, así que hoy no filtran datos, pero el permiso es superficie innecesaria y una sola función mal escrita se vuelve el caso 1. | **Alto** |
| 3 | `robots.txt` permite indexar `/cotizacion/*`, `/propuesta/*`, `/seguimiento/*`: si un cliente publica el enlace, el buscador puede indexar cotizaciones con precios y datos personales. | **Alto** |
| 4 | `organization_id` nullable en tablas sensibles (`booking_service_economics`, `commissions`, `transport_services`): filas huérfanas pueden escapar del filtro por tenant. | **Alto** |
| 5 | Sin rol `driver`: `/driver` accesible a cualquier cuenta aprobada (el dato sí está acotado por RLS a los recursos del conductor, el riesgo es de exposición de UI y de futuras consultas). | **Medio** |
| 6 | Políticas `USING (true)` en `currencies`, `currency_exchange_rates`, `opportunity_stage_config`, `product_categories`, **`providers`** — restringidas a `authenticated`, pero `providers` contiene datos comerciales de terceros visibles a cualquier usuario aprobado (incluidos agentes externos). | **Medio** |
| 7 | Sin rate-limiting en las rutas públicas por token (entropía 122–160 bits, fuerza bruta impráctica; falta defensa en profundidad ante escaneo/DoS). | **Bajo** |
| 8 | Buckets `quotation-images` / `company-logos`: acceso vía signed URL correcto, pero no se verificó que el bucket sea privado a nivel de bucket. | **Bajo (a verificar)** |

Lo que **sí** está bien: `booking_service_economics`, `commissions`, `agreement_rules`
y `transport_services` restringen costos/márgenes a admin/operaciones/dueño; los
enlaces públicos validan token, vigencia y estado, y filtran costos, márgenes y proveedor.

---

## 4. Auditoría de experiencia de usuario

- **Navegación no segmentada por rol** (`app-shell.tsx`): `baseNav` tiene 13 ítems
  visibles para todos; solo `operationsNav` (4) y `adminNav` (1) están condicionados.
  Un agente ve "Recursos", "Transporte", "Agentes" y "Panel conductor" aunque dentro
  no pueda operar. Un **proveedor** no tiene panel propio: recibe el CRM completo de agencia.
- **Mobile**: la barra inferior replica los 13–18 ítems en scroll horizontal sin
  indicio de continuidad. `use-mobile` solo se usa en `ui/sidebar.tsx` (no en el shell real).
- **Tablas**: 12 archivos con `<table>` vs 11 con `overflow-x-auto` → hay tablas que
  desbordan en móvil. 21 diálogos `max-w-4xl+` sin variante Drawer.
- **Claridad**: 18 secciones en el menú sin agrupación jerárquica (comercial / operación /
  maestros / administración) → curva de aprendizaje alta para un vendedor nuevo.
- **Bien**: `AccountGate` explica con claridad los estados pending/rejected/suspended;
  `/driver` está pensado móvil-first; las fichas 360° concentran bien la información.

Mejoras: menú por rol, agrupación del menú, panel dedicado de proveedor, revisión de
tablas en móvil, y accesos rápidos ("Nueva consulta", "Nueva oportunidad") desde el dashboard.

---

## 5. Auditoría del modelo de negocio

| Necesidad | Soporte |
| --- | --- |
| Agencia de viajes | ✅ ciclo completo consulta → propuesta → reserva → operación |
| Red de agentes externos | 🟡 fichas, asignación y visibilidad propia; sin portal ni liquidación al agente |
| Central operativa | ✅ estado operativo, checklist, incidencias, agenda |
| Transporte turístico y traslados | ✅ servicios, choferes, economía por servicio |
| Proveedores externos | 🟡 ficha y evaluación; **sin portal de proveedor** (confirmación/tarifas propias) |
| Comisiones | 🟡 solo simulación: `commissions` y `commission_history` vacías por diseño |
| Seguimiento comercial | ✅ pipeline, historial, seguimiento público del viaje |
| SaaS multi-tenant | 🟡 `organizations` + `organization_members` + invitaciones existen, pero el aislamiento no está garantizado por esquema (ver §2) y no hay planes/facturación |

Falta para monetizar: devengo real de comisiones, portal de proveedor/agente, cobros
y planes de suscripción.

---

## 6. Auditoría SEO y producción

- `__root.tsx` define `head()` completo (title, description, og, twitter, viewport) ✅.
- `index.tsx` **sin `head()` propio** → landing con meta genérico.
- Las tres rutas públicas por token tienen títulos **estáticos e idénticos** entre
  cotizaciones; sin `og:image`, sin canonical → todas las previsualizaciones compartidas
  se ven iguales.
- `robots.txt`: `Allow: /` sin `Disallow` de rutas privadas ni `Sitemap:` (ver §3).
- Entorno: solo variables publishable de Supabase; **0 `console.log`**, **0 TODO/FIXME**.
- `src/start.ts` con middleware CSRF, `src/server.ts` con normalización de errores SSR ✅.
- `nitro` está fijado en una versión **beta** en devDependencies.
- Sin tests automatizados (`package.json` sin script de test).
- Archivos grandes a vigilar: `resource-form-dialog.tsx` (1161), `smartQuotes.ts` (1100),
  `bookings_.$id.tsx` (913), `resources.ts` (895), `driver.tsx` (730).
- Dominio productivo activo: `sales.viaetravel.com`.

---

## 7. Deuda técnica priorizada

1. `ensure_provider_organization` escribible por anónimos. **(bloqueante)**
2. `EXECUTE` por defecto a `anon`/`PUBLIC` en ~70 funciones `SECURITY DEFINER`.
3. `organization_id` nullable en ~24 tablas → más caro cada día que entren datos.
4. Identidad a medio migrar (`persons` vacía, `person_id` nullable, datos duplicados).
5. Duplicaciones de entidad: `companies`/`providers`, `exchange_rates`, `resources`/`products`, `transport_services`/`booking_services`.
6. Monedas como texto libre en lugar de FK a `currencies`.
7. Permisos dispersos inline en 17 rutas, sin rol `driver` ni matriz de permisos.
8. `robots.txt` indexando enlaces privados.
9. ~45 tablas vacías con RLS y triggers que hay que mantener sin beneficio actual.
10. Sin tests ni CI; archivos de 900–1200 líneas.
11. Sin `created_by/updated_by` ni convención única de borrado lógico.

Regla práctica: **1–3, 6 y 8 deben corregirse ahora**; cada mes que pasen requerirán
backfill sobre datos reales de clientes.

---

## 8. Plan de continuación

### FASE 1 — Correcciones imprescindibles (antes de seguir)
1. Añadir verificación de sesión/rol a `ensure_provider_organization` y `REVOKE EXECUTE`
   de `anon`/`PUBLIC` en todas las funciones `SECURITY DEFINER` no públicas
   (dejar solo `booking_public_tracking`).
2. Endurecer `robots.txt` (Disallow de `/cotizacion/`, `/propuesta/`, `/seguimiento/`) + `Sitemap`.
3. Backfill y `NOT NULL` de `organization_id` en las tablas del §2; endurecer las
   políticas `USING (true)`, en especial `providers`.
4. Crear rol `driver` y centralizar permisos en un único helper de autorización.
5. Segmentar el menú por rol y agrupar secciones.

### FASE 2 — Completar funcionalidades principales
6. Migración de identidad: poblar `persons`/`person_roles`, vincular clientes/leads/agentes/pasajeros y deprecar campos duplicados.
7. Unificar terceros (`companies` + `providers` → `organizations` con roles) y eliminar `exchange_rates`.
8. Normalizar monedas a FK `currencies` y usar siempre `lib/money.ts`.
9. Activar el devengo real de comisiones (hoy solo simulación) y liquidaciones.
10. Envío real de comunicaciones (WhatsApp/email) sobre `communication_events`.
11. Revisión responsive: tablas, diálogos y barra inferior móvil.

### FASE 3 — Versión comercial
12. Portal de proveedor y portal de agente (alcance acotado a sus datos).
13. `head()` dinámico con `og:image` en las rutas públicas por token.
14. Tests de los flujos críticos + CI; refactor de los 5 archivos más grandes.
15. Rate limiting en rutas públicas; revisión de buckets de storage.
16. Planes, facturación y onboarding de organizaciones.

### FASE 4 — Plataforma turística
17. Activar los motores dormidos en orden: Inventario → Tarifario → Disponibilidad →
    Paquetes → Orquestador → Itinerarios, cada uno con UI y datos reales antes del siguiente.
18. Unificar `resources` bajo `products` y `transport_services` bajo `booking_services`.
19. Conectar canales externos (proveedores/API) mediante el orquestador.
20. Marketplace / distribución B2B multi-tenant.
