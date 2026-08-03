# MASTER ARCHITECTURE MAP — ViaE Sales Hub v1.9.5.x

> Auditoría de arquitectura al 2 de agosto de 2026. Documento **descriptivo**: refleja
> únicamente lo que existe en el código, las migraciones y el catálogo actual de la base.
> Leyenda: ✅ implementado · 🟡 parcial · 🔵 planificado (no existe código).

## Índice
1. [Visión general del sistema](#visión-general-del-sistema)
2. [Mapa de módulos](#mapa-de-módulos)
3. [Relaciones entre módulos](#relaciones-entre-módulos)
4. [Flujo completo de negocio](#flujo-completo-de-negocio)
5. [Entidades principales](#entidades-principales)
6. [Qué está listo](#qué-está-listo)
7. [Qué está parcialmente desarrollado](#qué-está-parcialmente-desarrollado)
8. [Qué falta para ser un SaaS multiproveedor](#qué-falta-para-ser-un-saas-multiproveedor)
9. [Riesgos de arquitectura detectados](#riesgos-de-arquitectura-detectados)

---

## Visión general del sistema

**ViaE Sales Hub** es una aplicación web responsive (una sola app, es-AR) que cubre el
ciclo comercial y operativo de una agencia de viajes: captación → cotización → reserva
→ operación → economía.

| Capa | Tecnología / decisión |
| --- | --- |
| Framework | TanStack Start v1 (SSR edge/worker) + Vite |
| UI | React 19, TypeScript, Tailwind v4 (`src/styles.css`), shadcn/ui |
| Router | TanStack Router (rutas de archivo en `src/routes`) |
| Datos | TanStack Query v5 sobre el cliente tipado del backend |
| Backend | Lovable Cloud (Postgres + Auth + Storage + Realtime) |
| Lógica de negocio | **En la base**: funciones `SECURITY DEFINER`/`STABLE` + triggers |
| Server functions | Solo una: validación del token de cotización pública |

Principios estructurales vigentes:

1. **La seguridad la hace RLS**, no el cliente. 43 tablas, todas con RLS habilitado.
2. **Nunca borrar**: `record_status = 'archived'`.
3. **Historial inmutable**: `booking_timeline`, `audit_log`, `*_history` son append-only.
4. **Costos y márgenes = información sensible**, visible solo para Administrador.
5. **Multimoneda explícita**: nunca se suman monedas distintas en un total.
6. **Instancia única (single-tenant)**: no hay `tenant_id` en ninguna tabla.

---

## Mapa de módulos

| Dominio | Módulo | Ruta | Dominio TS (`src/lib/`) | Estado |
| --- | --- | --- | --- | --- |
| Identidad | Auth + aprobación de cuentas | `/auth` | — (`use-account`) | ✅ |
| Identidad | Administración de usuarios y roles | `/admin` | `audit` | ✅ |
| Identidad | Configuración / branding | `/settings` | `company`, `exchange-rates` | ✅ |
| Comercial | Dashboard | `/dashboard` | `quotations`, `crm` | ✅ |
| Comercial | Leads | `/leads`, `/leads/$id` | `leads` | ✅ |
| Comercial | Clientes (CRM) | `/clients`, `/clients/$id` | `clients`, `crm` | ✅ |
| Comercial | Oportunidades | panel en CRM | `opportunities` | ✅ |
| Comercial | Cotizaciones | `/quotations/*` | `quotations` | ✅ |
| Comercial | Cotización pública | `/cotizacion/$token` | `public-quotation.functions` | ✅ |
| Comercial | Agentes | `/agents`, `/agents/$id` | `agents` | ✅ |
| Entidades | Organizaciones | `/organizations` | `organizations` | 🟡 |
| Entidades | Proveedores (legado) | `/providers` | `providers` | 🟡 |
| Acuerdos | Acuerdos comerciales | `/agreements` | `agreements` | ✅ |
| Acuerdos | Comisiones (simulación) | pestaña en la reserva | `commissions` | 🟡 |
| Operación | Reservas — Expediente 360° | `/bookings/$id` | `bookings`, `timeline`, `trip-state`, `passengers` | ✅ |
| Operación | Central operativa | `/operations` | `operations`, `checklist` | ✅ |
| Operación | Recursos operativos | `/resources/*` | `resources`, `resource-catalog`, `geo` | ✅ |
| Operación | Transporte | `/transport` | `transport`, `transport-ops`, `transport-economics` | ✅ |
| Operación | Agenda | `/agenda` | `transport-ops` | ✅ |
| Operación | Panel del conductor | `/driver` | `driver` | ✅ |
| Cliente | Seguimiento público | `/seguimiento/$token` | `client-tracking` | ✅ |
| Transversal | Comunicaciones | paneles embebidos | `communication`, `notifications` | 🟡 registro sin envío |

Regla vigente: **los componentes no arman consultas propias**; consumen los módulos de
`src/lib/`, que a su vez llaman a tablas bajo RLS o a funciones por RPC.

---

## Relaciones entre módulos

```
                       ┌───────────────────────────────┐
                       │ IDENTIDAD                     │
                       │ profiles · user_roles         │
                       │ company_settings · audit_log  │
                       └──────────────┬────────────────┘
                                      │ define permisos (RLS) en todo el sistema
   ┌──────────────────────────────────┼──────────────────────────────────┐
   │                                  │                                  │
┌──▼──────────────┐   ┌───────────────▼────────────┐   ┌────────────────▼─────────┐
│ COMERCIAL       │   │ ENTIDADES COMERCIALES      │   │ RECURSOS / TRANSPORTE    │
│ leads           │   │ organizations              │   │ resources                │
│ clients         │   │  organization_roles        │   │  resource_extras         │
│ opportunities   │◄──┤ companies (legado)         ├──►│  availability_log        │
│ quotations      │   │ providers (legado)         │   │ transport_services       │
│ agents          │   │  provider_evaluations      │   │  service_extras/history  │
└──┬──────────────┘   └───────────────┬────────────┘   └────────────┬─────────────┘
   │ genera                            │ contraparte                │ ejecuta
   │                          ┌────────▼──────────┐                 │
   │                          │ ACUERDOS          │                 │
   │                          │ commercial_agree. │                 │
   │                          │ agreement_rules   │                 │
   │                          │ agreement_history │                 │
   │                          └────────┬──────────┘                 │
   │                                   │ resuelve regla             │
┌──▼───────────────────────────────────▼────────────────────────────▼─────────────┐
│ RESERVA — EXPEDIENTE DE VIAJE 360°  (bookings)                                  │
│ booking_services · booking_resources · booking_passengers · booking_payments     │
│ booking_documents · booking_checklist_items · booking_incidents                  │
│ booking_service_economics · booking_status_history                               │
│ booking_timeline (append-only, alimentado solo por triggers)                     │
│ booking_trip_state() (estado operativo derivado, no persistido)                  │
└──────────────┬──────────────────────────────┬───────────────────────────────────┘
               │ simulación                   │ eventos
      ┌────────▼──────────┐          ┌────────▼────────────────────┐
      │ COMISIONES 🟡     │          │ COMUNICACIÓN 🟡             │
      │ commissions (0)   │          │ communication_events        │
      │ compute_commission│          │ notifications (realtime)    │
      │ simulate_*        │          │ seguimiento por token ✅    │
      └───────────────────┘          └─────────────────────────────┘
```

Puntos de acoplamiento reales:

| Origen | Destino | Mecanismo |
| --- | --- | --- |
| `quotations` | `clients` + `opportunities` | sincronización en la capa de dominio al crear |
| `leads` | `clients` | conversión sin duplicar registros |
| `bookings` | `booking_checklist_items` | trigger `tg_seed_booking_checklist` |
| cualquier tabla del expediente | `booking_timeline` | triggers `tg_timeline_*` → `create_booking_timeline_event` |
| `booking_services` / `transport_services` | acuerdos | `resolve_agreement` + `compute_commission` (simulación) |
| `exchange_rates` | economía | `rate_at(fecha)` con snapshot en `booking_service_economics` |
| `resources` ↔ `transport_services` | disponibilidad | `sync_transport_resource_state` + `availability_log` |
| eventos operativos | `notifications` | `notify_operations_team` + Realtime |

---

## Flujo completo de negocio

| # | Etapa | Entidades | Disparador / lógica | Estado |
| --- | --- | --- | --- | --- |
| 1 | **Lead** | `leads`, `lead_history` | Alta manual en `/leads`; ciclo de vida; asignación manual o automática (`lead_assignment_mode`) | ✅ |
| 2 | **Cliente** | `clients` | Conversión del lead o sincronización automática al cotizar | ✅ |
| 3 | **Cotización** | `quotations`, `quotation_history`, `opportunities` | Alta detallada, versiones, enlace público por token, PDF con branding; crea/actualiza la oportunidad | ✅ |
| 4 | **Reserva** | `bookings` | Alta manual; `booking_number VIA-AA-000001`; estado comercial manual + `booking_trip_state()` derivado; checklist sembrado | ✅ |
| 5 | **Operación** | `booking_checklist_items`, `booking_incidents`, `booking_documents`, `booking_resources`, `/operations`, `/agenda` | Bandeja operativa, avance %, pendientes, advertencias críticas | ✅ |
| 6 | **Servicio** | `booking_services`, `transport_services`, `resources`, `/driver` | Asignación **manual** con sugerencia geográfica y aviso de solapamiento; conductor acepta/rechaza y avanza estados | ✅ |
| 7 | **Pago / cobro** | `booking_payments`, estados de cobro en transporte | Registro manual; genera evento `payment_received` en el timeline | ✅ registro · 🔵 conciliación / pasarela |
| 8 | **Comisión** | `commercial_agreements`, `agreement_rules`, `compute_commission`, `simulate_commission*` | Resuelve acuerdo + regla por score de especificidad y calcula el importe **al vuelo** | 🟡 solo simulación: `commissions` está vacía por diseño |
| 9 | **Liquidación** | `commission_history`, `transport_settlement_status` | — | 🔵 no existe cierre por período ni pago a contrapartes |

Corte real del flujo: **entre 7 y 8**. Todo lo anterior escribe datos definitivos; desde
la comisión en adelante el sistema solo calcula y muestra, sin generar movimiento contable.

---

## Entidades principales

### `users` (identidad) ✅
`profiles` (estado de cuenta, nombre, agencia) + `user_roles` (tabla separada, nunca en el
perfil) + `permission_audit_log`. Enum `app_role`: `admin`, `agent`, `provider`,
`operations`. "Conductor" **no es un rol**: se deriva de `resources` vinculados al usuario
(`is_driver()`). Toda cuenta nace `pending` y requiere aprobación; sin registro libre ni
acceso anónimo. `prevent_last_admin_removal` protege al último administrador y
`claim_admin_if_none` permite recuperación solo si no hay ninguno.

### `organizations` 🟡
Modelo objetivo de entidad comercial (`organizations` + `organization_roles`: agencia,
mayorista, proveedor, etc.). Conviven `companies` y `providers`, aún en uso por pantallas y
FKs. `ensure_provider_organization()` puentea proveedor → organización. Es la
**deuda estructural más importante** del sistema.

### `agents` ✅
Red comercial: datos personales, idiomas, especialidades, perfil comercial, estadísticas
automáticas. Un agente puede existir **sin usuario**; al invitarlo se vincula el perfil
(`current_agent_id()` resuelve el agente del usuario para RLS). Campos de WhatsApp
preparados (`agent_wa_status`) sin envío real.

### `providers` 🟡
Ficha, clasificación, recursos asociados, reservas, evaluación interna
(`provider_evaluations`) y métricas. Legado en convivencia con `organizations`.

### `resources` ✅
Catálogo operativo con 77 columnas: clase y subtipo, propietario
(`resource_owner_type`), datos técnicos de vehículo, cobertura geográfica completa de
Argentina, extras (`resource_extras` / `resource_extra_links`), rent a car y
disponibilidad auditada (`resource_availability_log`).

### `bookings` ✅
Núcleo del expediente. `booking_number` humano único, **doble estado**: comercial
(`bookings.status`, manual) y operativo (`booking_trip_state()`, derivado: draft → quoted →
partially_confirmed → confirmed → operational → finished → cancelled) con `progress` y
`pending_items`. `booking_status_history` guarda los cambios.

### `services` ✅
Dos familias no unificadas: `booking_services` (servicio genérico de la reserva, con
`booking_service_economics`) y `transport_services` (60 columnas con operación **y**
economía propia). Duplican el concepto de economía del servicio.

### `passengers` ✅ (estructural)
`booking_passengers`: titular único activo por reserva (índice de unicidad),
`passenger_type` (adult/child/infant/senior/other), `birth_date` opcional y recomendada
para menores, `relationship_to_lead_passenger`. La edad **nunca se persiste**
(`calculate_passenger_age` / `calculatePassengerAge`). `groupComposition` es un contrato de
lectura preparado para tarifas futuras; hoy no calcula precios.

### `timeline` ✅
`booking_timeline`: append-only garantizado por `tg_timeline_append_only`. Se alimenta
exclusivamente desde triggers vía `create_booking_timeline_event` (`SECURITY DEFINER`,
concedida solo a `service_role`): creación, cambios de estado, pagos, servicios,
documentos, checklist, incidencias y comunicaciones. Cada evento lleva
`timeline_visibility`; el filtro "visible al cliente" en la UI es **solo visual**.

### `economics` 🟡
`booking_service_economics` (venta, impuestos, extras, descuento, costo, margen y snapshot
de tipo de cambio) + economía embebida en `transport_services` + `exchange_rates` con
`rate_at()`. Margen = venta − costo por servicio. Visible solo para Administrador.
Falta consolidar ambas fuentes en una sola.

---

## Qué está listo

| Bloque | Detalle |
| --- | --- |
| Identidad y permisos | Roles en tabla separada, aprobación de cuentas, recuperación de admin, auditoría de permisos, RLS en las 43 tablas |
| Ciclo comercial | Leads → clientes → oportunidades → cotizaciones, con enlace público y PDF con branding |
| Agentes | Ficha, estadísticas, invitación y vinculación con usuario |
| Reservas | Expediente 360° con 7 pestañas, doble estado, avance y pendientes |
| Operación | Central `/operations`, checklist base, incidencias, documentos, agenda |
| Transporte | Servicios por reserva, sugerencia geográfica, panel del conductor, estados de viaje |
| Recursos | Catálogo inteligente con geografía AR, extras y disponibilidad auditada |
| Acuerdos | `commercial_agreements` + `agreement_rules` versionados con historial inmutable |
| Expediente narrativo | Motor de eventos del timeline completo y protegido |
| Cliente final | Seguimiento público por token, sin login y sin datos sensibles |
| Multimoneda | Tipos de cambio manuales por fecha, moneda de análisis global, totales separados por moneda |

## Qué está parcialmente desarrollado

| Tema | Qué existe | Qué falta |
| --- | --- | --- |
| Comisiones | `resolve_agreement`, `compute_commission`, `simulate_commission*`, UI de simulación | Devengo real: escribir en `commissions`, usar `commission_status` y `commission_history` |
| Liquidaciones | Estados de cobro/liquidación en transporte | Cierre por período, documento de liquidación, pago a agentes y proveedores |
| Entidades comerciales | `organizations` + `organization_roles` | Migrar FKs de `companies`/`providers` y retirar las tablas legado |
| Economía del servicio | `booking_service_economics` y economía en `transport_services` | Modelo único de economía por servicio |
| Trip state | Función derivada estable | Materializarlo para alertas, bandejas e índices |
| Comunicaciones | Registro de eventos + notificaciones internas realtime | Envío real de WhatsApp/email y estados de entrega |
| Tarifas | `passenger_type`, edad dinámica, `groupComposition` | Motor tarifario por composición del grupo y tarifas mayoristas |
| Pagos | Registro manual de cobros | Conciliación, pasarela, comprobantes |
| Exposición al cliente | `timeline_visibility` en cada evento | Selección curada de eventos publicables |

## Qué falta para ser un SaaS multiproveedor

El sistema es hoy **single-tenant, una agencia**. Brechas, en orden de dependencia:

| # | Brecha | Impacto | Trabajo requerido |
| --- | --- | --- | --- |
| 1 | **Sin `tenant_id`** | Bloqueante | Añadir tenant a todas las tablas de negocio, incluirlo en cada política RLS, índices compuestos y funciones `SECURITY DEFINER`; hoy `company_settings` es una fila global |
| 2 | **Aislamiento de datos** | Bloqueante | Toda RLS se apoya en `has_role` / `current_agent_id` sin dimensión de organización: un admin ve todo el sistema, no "su" agencia |
| 3 | **Consolidar `organizations`** | Alto | Es el candidato natural a tenant/contraparte; hasta retirar `companies` y `providers` no hay entidad única para colgar el aislamiento |
| 4 | **Onboarding autoservicio** | Alto | Alta de agencia, invitación de equipo, plan y límites; hoy solo hay aprobación manual por un admin |
| 5 | **Portal del proveedor real** | Alto | El rol `provider` accede a la app interna; falta un espacio propio con confirmación de servicios, tarifas y disponibilidad |
| 6 | **Branding por tenant** | Medio | Logo, colores y datos de contacto son globales (`company_settings`) |
| 7 | **Economía multi-parte** | Medio | Comisión devengada + liquidación por contraparte es requisito para operar entre agencias y proveedores |
| 8 | **Facturación del SaaS** | Medio | Planes, suscripción, medición de uso; no existe integración de pagos |
| 9 | **Integraciones externas** | Medio | Ni webhooks, ni API pública, ni GDS/mayoristas; no hay rutas `api/public/*` |
| 10 | **Observabilidad y límites** | Medio | Sin cuotas, rate limiting, métricas por tenant ni política de retención de historiales |
| 11 | **Pruebas automatizadas** | Medio | Hoy solo typecheck, linter de base y verificación manual; un multi-tenant sin tests de RLS es riesgoso |
| 12 | **Numeración y secuencias** | Bajo | `booking_number` es global: en multi-tenant debe ser único **por** tenant |

## Riesgos de arquitectura detectados

1. **Doble modelo de entidades** (`organizations` vs `companies`/`providers`): riesgo de
   datos divergentes y de reglas de acuerdo aplicadas a la contraparte equivocada.
2. **Doble modelo de economía del servicio**: los totales de un viaje pueden calcularse de
   dos formas distintas según el tipo de servicio.
3. **Estado operativo no persistido**: cada lectura recalcula; sin materializar no hay
   índices, alertas ni histórico del estado del viaje.
4. **Lógica concentrada en la base**: sólido para seguridad, pero difícil de testear y
   versionar; toda regla nueva pasa por migración.
5. **Crecimiento de tablas append-only** (`booking_timeline`, `communication_events`,
   `audit_log`): sin índices de rendimiento ni política de retención.
6. **`commissions` vacía con trigger de inmutabilidad**: la fase de devengo deberá escribir
   respetando ese trigger; conviene definir el orden de escritura antes de activarla.

---

# Motores del Core

Esta sección documenta la arquitectura **funcional** del sistema, diferenciando con claridad
los motores que ya existen en el proyecto de los que están en construcción o planificados.
La marca de cada motor refleja su estado real (no el de su dominio contenedor):

- ✅ implementado · 🟡 en construcción · 🔵 planificado

## ✅ Motores implementados

Motores con código y/o tablas activas en el sistema.

### Motor Comercial (CRM, Leads, Clientes, Cotizaciones, Reservas)
Núcleo del ciclo de negocio. Cubre la captación de `leads`, su conversión a `clients`, la
gestión de `opportunities`, la creación y versionado de `quotations` con enlace público y
PDF con branding, y la materialización en `bookings`. Incluye la red de `agents` con
estadísticas automáticas y la sincronización lead→cliente→oportunidad→cotización.

### Motor Operativo (Expediente 360°, Operaciones, Transporte)
Ejecuta la reserva: `booking_services`, `booking_resources`, `booking_checklist_items`,
`booking_incidents`, `booking_documents` y la bandeja `/operations`. Transporte con
asignación manual y sugerencia geográfica, agenda `/agenda` y panel del conductor `/driver`.
El Expediente 360° (`/bookings/$id`) integra el doble estado (comercial manual + operativo
derivado `booking_trip_state`), timeline inmutable y comunicación por token.

### Motor Tarifario (estructura)
Tablas base creadas en la **Fase 0**: `tariff_plans`, `tariff_seasons`, `tariff_rules`,
`tariff_rule_conditions` y `passenger_categories`. Define temporadas, categorías de
pasajero con edades y reglas, con RLS por rol. **Sin cálculo de precios todavía.**

### Motor de Disponibilidad (estructura)
Infraestructura base de la **Fase 0**: `availability_sources`, `service_availability`,
`availability_cache`, `availability_requests` y `availability_policies`. Describe orígenes
(manual/api/caché/externo), estados y políticas de fallback. **Sin búsquedas ni conectores.**

### Motor de Itinerarios (estructura)
Infraestructura base: `itinerary_templates`, `itinerary_template_items`,
`itinerary_rules`, `itinerary_versions` e `itinerary_requests`. Plantillas reutilizables
con reglas y versionado. **Sin generación automática, combinación ni cálculo de precios.**

### Motor de Comisiones (simulación)
`resolve_agreement` + `compute_commission` + `simulate_commission*` calculan el importe
al vuelo sobre `commercial_agreements` y `agreement_rules`. La tabla `commissions`
existe pero está **vacía por diseño** (inmutable): no hay devengo real ni liquidaciones.

### Motor de Recursos
Catálogo operativo de `resources` (77 columnas): clase y subtipo, propietario, datos
técnicos de vehículo, cobertura geográfica completa de Argentina, `resource_extras`,
rent a car y disponibilidad auditada (`resource_availability_log`).

### Motor de Organizaciones y Acuerdos Comerciales
`organizations` + `organization_roles` como modelo objetivo de entidad comercial, con
`commercial_agreements` y `agreement_rules` versionados con historial inmutable
(`agreement_history`). `companies`/`providers` conviven como legado pendiente de retirar.

## 🟡 Motores en construcción

Motores cuya responsabilidad está definida pero sin implementación activa.

### Motor de Orquestación
Coordina el flujo entre motores durante la creación de una reserva: recibiría la
intención de viaje, invocaría Búsqueda, Disponibilidad, Tarifario e Itinerarios, y
ensamblaría la reserva con su economía. Hoy no existe; el flujo es manual.

### Motor de Búsqueda
Recibe criterios (destino, fechas, grupo) y consulta los orígenes de disponibilidad +
tarifas para devolver opciones ordenadas. Depende del Motor de Disponibilidad y del
Tarifario. Hoy inexistente; las cotizaciones se arman a mano.

### Motor de Inventario
Administra el cupo real por servicio y fecha (`service_availability`), reservando y
liberando unidades a partir de las reservas confirmadas. La estructura existe pero
no hay lógica que ajuste cupos ante cambios de estado.

### Motor de Recomendaciones
Sugiere servicios, extras e itinerarios afines a partir del historial del cliente y el
destino. No existe código ni tablas dedicadas.

### Motor de Empaquetado Dinámico
Combina servicios sueltos (vuelo + hotel + traslado + tours) en paquetes con precio
conjunto y descuentos. Requiere Búsqueda, Tarifario e Itinerarios; hoy no existe.

## 🔵 Motores planificados

Motores necesarios para la fase SaaS multiproveedor (v2.0).

### Motor White Label
Branding por tenant: logo, colores, datos de contacto y dominio propio. Hoy
`company_settings` es una fila global única.

### API Gateway
Punto de entrada público y autenticado para integraciones externas (GDS, mayoristas,
OTAs). Hoy no existen rutas `api/public/*`.

### Motor de Integraciones
Conectores con proveedores externos (GDS, pasarelas de pago, WhatsApp/email). Gestión
de credenciales, reintentos y normalización de respuestas. No existe.

### Motor de Automatización
Reglas disparadas por eventos del timeline (recordatorios, cambios de estado,
reasignaciones) con acciones encadenadas. No existe.

### Motor de Analítica y BI
Agregación de métricas comerciales y operativas por tenant, agente, destino y período;
tableros e informes. Hoy solo hay métricas básicas en el Dashboard.

## Diagrama de relación entre motores

```
                Cliente
                   │
                   ▼
            Motor de Búsqueda 🟡
                   │
                   ▼
         Motor de Orquestación 🟡
            ├────────► Disponibilidad ✅
            ├────────► Tarifario ✅
            ├────────► Itinerarios ✅
            ├────────► Comercial ✅
            ├────────► Operaciones ✅
            ▼
              Reserva ✅
                ▼
          Expediente 360° ✅
                ▼
          Comisiones ✅ (simulación)
                ▼
          Liquidaciones 🔵
```

Lectura del diagrama: el cliente inicia en el **Motor de Búsqueda** (hoy manual), que
entrega opciones a un **Motor de Orquestación** que orquesta los motores estructurales
ya implementados (Disponibilidad, Tarifario, Itinerarios, Comercial, Operaciones). El
resultado se materializa en la **Reserva** y su **Expediente 360°**, desde donde se
simulan **Comisiones**; las **Liquidaciones** reales siguen planificadas.

---

# CRM 360 Identity Layer

Capa central de identidad de personas (v1.10.7.1). Un único maestro por
organización que unifica a quien hoy aparece duplicado en `clients`, `leads`,
`booking_passengers`, `agents` y contactos de proveedores.

```
persons
   |
person_roles
```

- `persons` — identidad: nombre, contacto, documento, nacimiento, nacionalidad,
  idioma, avatar y notas. Siempre ligada a `organizations.id` (White Label).
- `person_roles` — papeles simultáneos de esa persona en la organización, con el
  enum `person_role_type`: `customer`, `passenger`, `agent`, `supplier_contact`,
  `driver`, `employee` (extensible).
- Seguridad (v1.10.7.1.2 Identity Security Alignment): RLS acotada por
  **pertenencia a la organización** (`organization_members`), no por rol global.
  - Lectura: Administración global **o** miembro activo de la misma organización.
  - Alta / edición de `persons`: Administración global, dueño o administrador de
    la organización, u Operaciones **dentro de** esa organización.
  - Alta / edición de `person_roles`: Administración global, dueño o
    administrador de la organización.
  - Baja (`persons` y `person_roles`): Administración global o dueño de la organización.
  - Helpers `SECURITY DEFINER`: `org_identity_can_read`, `org_identity_can_write`,
    `org_identity_can_admin`, `org_identity_can_delete` (apoyados en `has_role`,
    `is_member_of` y `has_org_role`).
- Alcance actual: **solo estructura y seguridad**. Sin vínculo con `bookings`,
  `booking_passengers`, `quotations` ni `smart_quotes`.

## Identity Security Flow

```
auth.users
    ↓
organization_members      (pertenencia + rol interno)
    ↓
organizations             (marca / cliente SaaS)
    ↓
persons / person_roles    (identidad de la organización)
```

| Capa | Significado |
| --- | --- |
| `user_roles` | permisos **globales de la plataforma** (admin, operations, agent, provider) |
| `organization_members` | permisos **dentro del cliente SaaS** (organización) |

Las funciones legacy (`is_approved`, `has_role`, `is_operations`) se mantienen
intactas para los módulos existentes.

## Roadmap del CRM 360

| Versión | Alcance | Estado |
| --- | --- | --- |
| v1.10.7.1 Identity Core | `persons`, `person_roles`, enum de roles, RLS y trigger de `updated_at` | ✅ |
| v1.10.7.1.2 Identity Security Alignment | RLS de `persons`/`person_roles` por pertenencia a la organización | ✅ |
| v1.10.7.2 Customer Profiles | Fichas de persona, preferencias, deduplicación y UI de búsqueda | 🔵 |
| v1.10.7.3 CRM Integration | Vinculación con `clients`, `leads`, `booking_passengers`, `quotations` y `smart_quotes` | 🔵 |

---

# SaaS Identity Layer

Capa de pertenencia usuario ↔ organización (v1.10.7.1.1). Es la base del
aislamiento por marca (White Label): antes de esta capa el único vínculo era
`organizations.user_id` (propiedad 1:1) y los roles globales de `user_roles`.

```
organizations
      |
organization_members
      |
   auth.users
```

## Distinción crítica

| Tabla | Significado |
| --- | --- |
| `organization_roles` | **clasificación de la organización** — qué *es* (cliente, proveedor, etc.) |
| `organization_members` | **usuarios con acceso** a esa organización y su rol interno |

## organization_members

- Campos: `organization_id` → `organizations.id` (cascada), `user_id` → `auth.users.id`,
  `role`, `status`, `is_owner`, `invited_by`, `created_at`, `updated_at`.
- Único por `(user_id, organization_id)`. Índices por organización, usuario y rol.
- Enum `organization_member_role`: `organization_owner`, `organization_admin`,
  `operations`, `agent`, `provider`, `driver`, `viewer` (extensible).
- Enum `organization_member_status`: `active`, `pending`, `inactive`, `suspended`.
- Trigger `trg_organization_members_updated_at` (reutiliza `tg_set_updated_at`).

## Helpers de seguridad (SECURITY DEFINER)

- `is_member_of(_user_id, _org_id)` — pertenencia activa.
- `has_org_role(_user_id, _org_id, _role)` — rol dentro de la organización.
- `can_manage_organization_members(_org_id)` — Administración global, Operaciones,
  o dueño/administrador de esa organización.

Son una **capa de extensión**: el RLS existente de los demás módulos no se
reescribió y sigue apoyado en `has_role`, `is_approved`, `is_operations`.

## RLS de organization_members

- Lectura: propias pertenencias (`user_id = auth.uid()`), o usuario aprobado que
  sea Administración, Operaciones o miembro activo de la organización.
- Alta / edición: `can_manage_organization_members(organization_id)`.
- Baja: Administración global o dueño de la organización.

## Backfill inicial

- Cada `organizations.user_id` → miembro `organization_owner`, `is_owner = true`.
- Cada `agents.user_id` con `access_status = 'linked'` → miembro `agent` de la
  organización de su creador. Idempotente (`ON CONFLICT DO NOTHING`).

## Roadmap de la capa de identidad SaaS

| Versión | Alcance | Estado |
| --- | --- | --- |
| v1.10.7.1.1 Membership Layer | `organization_members`, enums, helpers, RLS y backfill | ✅ |
| v1.10.7.1.2 Identity Security Alignment | RLS de `persons`/`person_roles` acotada por pertenencia | ✅ |
| v1.10.7.1.2b Migración progresiva | acotar inventario y motores nuevos por pertenencia | 🔵 |
| v1.10.7.1.3 Gestión de miembros | UI de invitación, alta/baja y cambio de rol por organización | 🔵 |

