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

# SaaS Membership Lifecycle (v1.10.7.1.3)

```
Organization
     ↓
Invitation          (organization_invitations, status = pending)
     ↓
Organization Member (organization_members, status = active)
     ↓
Access              (RLS por pertenencia: org_identity_can_* / is_member_of)
```

| Tabla | Rol en el ciclo |
| --- | --- |
| `organization_members` | usuarios con **acceso activo** a la organización y su rol interno |
| `organization_invitations` | **flujo previo al acceso**: correo invitado, rol propuesto, token y vencimiento |

## organization_invitations

- Campos: `organization_id`, `email`, `role` (`organization_member_role`),
  `status` (`organization_member_status`, default `pending`), `invited_by`,
  `token` (uuid único), `expires_at` (default +14 días), `accepted_at`,
  `accepted_by`, `created_at`, `updated_at`.
- Índices: `organization_id`, `lower(email)`, `token` (único), `status`.
- Índice único parcial `uq_org_invitations_pending` → **no se permiten dos
  invitaciones pendientes** para el mismo correo en la misma organización.
- Trigger `set_updated_at_org_invitations` (reutiliza `tg_set_updated_at`).

## RLS de organization_invitations

- Lectura: Administración global o miembro de la organización (`is_member_of`).
- Alta / edición: Administración global, `organization_owner` u `organization_admin`.
- Baja: Administración global o `organization_owner`.
- Sin acceso `anon`.

## RPC de aprovisionamiento (SECURITY DEFINER, solo `authenticated`)

| Función | Permiso | Efecto |
| --- | --- | --- |
| `invite_organization_member(_org_id, _email, _role)` | admin global, owner, org admin | crea invitación `pending` con `invited_by = auth.uid()` |
| `accept_organization_invitation(_token)` | usuario autenticado con token válido | valida token y expiración, crea/reactiva `organization_members` activo con el rol invitado, marca la invitación aceptada (`accepted_at`, `accepted_by`) |
| `change_organization_member_role(_member_id, _new_role)` | admin global, owner, org admin | cambia rol e `is_owner`; bloquea quitar el **último owner activo** |
| `remove_organization_member(_member_id)` | admin global, owner | pasa el miembro a `inactive` (no borra historial); bloquea al último owner activo |

Compatibilidad: no se crean invitaciones históricas, `organization_members` no se
modifica y la migración es idempotente. `bookings`, `quotations`, `smart_quotes`,
`persons`, `person_roles` y los motores existentes quedan intactos.

## Roadmap de la capa de identidad SaaS

| Versión | Alcance | Estado |
| --- | --- | --- |
| v1.10.7.1.1 Membership Layer | `organization_members`, enums, helpers, RLS y backfill | ✅ |
| v1.10.7.1.2 Identity Security Alignment | RLS de `persons`/`person_roles` acotada por pertenencia | ✅ |
| v1.10.7.1.3 Membership Provisioning Layer | `organization_invitations` + RPC de invitación, aceptación, cambio de rol y revocación | ✅ |
| v1.10.7.1.2b Migración progresiva | acotar inventario y motores nuevos por pertenencia | 🔵 |
| v1.10.7.1.4 UI de miembros | pantalla de gestión de miembros e invitaciones por organización | 🔵 |


---

# CRM 360 Consolidation Audit (v1.10.7.2.0)

Auditoría **solo lectura**. No se crearon tablas, ni se modificaron migraciones,
RLS, relaciones ni código. Estado observado: `persons` = 0 filas,
`person_roles` = 0, `clients` = 3, `leads` = 1, `opportunities` = 1,
`booking_passengers` = 0, `agents` = 1, `organizations` = 2,
`organization_members` = 2, `quotations` = 15, `bookings` = 3, `profiles` = 5.

## 1. Tablas CRM encontradas

| Tabla | Propósito actual | Columnas principales | Relaciones | Organización | Usuario | Duplica `persons` |
| --- | --- | --- | --- | --- | --- | --- |
| `clients` | ficha comercial del cliente final (CRM módulo 1) | `full_name`, `last_name`, `email`, `phone`, `company`, `city`, `country`, `destination`, `travel_start/end`, `pax_count`, `opportunity_status`, `record_status` | referenciada por `opportunities`, `quotations`, `bookings`, `leads.client_id` | ❌ sin `organization_id` (aislada por `user_id`) | `user_id` = dueño del registro | 🔴 **alta** (nombre, email, teléfono, ciudad, país) |
| `leads` | captación previa al cliente | `first_name`, `last_name`, `whatsapp`, `email`, `country`, `city`, `language`, `source`, `status`, `assigned_agent_id`, `client_id`, `opportunity_id`, `quotation_id`, `converted_at` | → `clients`, `opportunities`, `quotations`, `agents` | ❌ | `user_id` creador | 🟠 media (datos de contacto de la misma persona antes de convertir) |
| `opportunities` | pipeline comercial | `client_id`, `quotation_id`, `title`, `stage`, `estimated_value`, `currency`, `probability`, `next_action`, `owner_user_id`, `assigned_agent_id` | → `clients`, `quotations`, `agents` | ❌ (heredada del cliente) | `user_id`, `owner_user_id` | ⚪ no (es transacción, no identidad) |
| `booking_passengers` | pasajeros del expediente 360 | `booking_id`, `first_name`, `last_name`, `document_type/number`, `birth_date`, `nationality`, `email`, `phone`, `passenger_type`, `is_lead_passenger`, `relationship_to_lead_passenger` | → `bookings` | ❌ | `user_id` creador | 🔴 **alta** (coincide casi 1:1 con `persons`) |
| `agents` | red comercial (puede existir sin acceso) | `first_name`, `last_name`, `email`, `whatsapp`, `company`, ciudad/país, `languages`, `specialties`, `commission_*`, `access_status`, `availability`, cupos y prioridad | `user_id` → `auth.users` (opcional), referenciada por `leads`, `opportunities`, `commissions` | ❌ (implícita por `created_by`) | `user_id` cuando está `linked` | 🟠 media (identidad + configuración operativa mezcladas) |
| `profiles` | perfil de la cuenta de plataforma | `full_name`, `agency_name`, `phone`, `avatar_url`, `status` | 1:1 `auth.users` | ❌ | sí (PK = user id) | 🟠 media (identidad del usuario interno) |
| `persons` | maestro de identidad CRM 360 | `organization_id`, `first_name`, `last_name`, `email`, `phone`, `document_type/number`, `birth_date`, `nationality`, `language`, `avatar_url` | → `organizations`, `person_roles` | ✅ | ❌ (identidad ≠ cuenta) | — |
| `person_roles` | rol de la persona por organización | `person_id`, `organization_id`, `role_type` | → `persons`, `organizations` | ✅ | ❌ | — |
| `organization_members` | acceso de usuarios a la organización | `organization_id`, `user_id`, `role`, `status`, `is_owner` | → `organizations`, `auth.users` | ✅ | ✅ | ⚪ no (es acceso, no identidad) |
| `commissions`, `lead_history`, `communication_events` | historial y economía | snapshots inmutables / eventos | → leads, bookings, agreements | parcial | creador | ⚪ no |

## 2. Flujos actuales y pérdida de información

```
A) Captación   Lead ──convert──> Client ──> Opportunity
B) Venta       Client ──> Quotation ──> Booking
C) Operación   Booking ──> booking_passengers ──> Expediente 360
```

Puntos donde hoy se pierde información:

1. **Lead → Client**: se copian nombre/contacto; no queda una identidad única, la
   misma persona puede existir como lead y como cliente sin vínculo fuerte.
2. **Client → Booking**: el cliente no se vuelve pasajero. `booking_passengers`
   se tipea a mano, así que el titular queda duplicado y sin documento en `clients`.
3. **Pasajero recurrente**: un pasajero que viaja tres veces genera tres filas sin
   historial consolidado (no hay "traveler profile").
4. **Sin organización**: `clients`, `leads`, `opportunities`, `booking_passengers`
   y `agents` no tienen `organization_id`; el aislamiento es por `user_id` + roles
   globales, incompatible con White Label real.
5. **Agentes**: la persona del agente y su configuración comercial viven en la
   misma fila, y el acceso está duplicado entre `agents.user_id` y
   `organization_members`.

## 3. Relación con `persons` — opción recomendada

Se evaluaron dos caminos:

| Opción | Descripción | Veredicto |
| --- | --- | --- |
| A) `persons` reemplaza `clients` | migración destructiva de la tabla más referenciada (quotations, bookings, opportunities, leads) | ❌ riesgo alto, rompe módulos y RLS legacy |
| B) `persons` = capa de identidad relacionada | `clients` conserva su rol comercial y apunta a la persona (`person_id`) | ✅ **recomendada** |

Fundamentos: `clients` es referenciada por 4 módulos productivos; `persons` está
vacía (migración limpia y sin conflictos); los campos coincidentes son
`first/last_name`, `email`, `phone`, `city`, `country`; `persons` aporta lo que
falta (documento, fecha de nacimiento, nacionalidad, idioma, organización).
Riesgos a controlar en la migración: deduplicación por `lower(email)` +
documento, `clients` sin `organization_id` (hay que resolver la organización de
destino antes del backfill), y doble fuente de verdad temporal mientras coexistan.

## 4. `booking_passengers`

Recomendación: **agregar `person_id` nullable** (no tabla intermedia, no
separación). La relación natural es `persons 1 ── N booking_passengers`: la
persona es la identidad estable y la fila de pasajero es el snapshot del viaje
(tipo de pasajero, titular, relación con el titular, notas de ese booking). Una
tabla intermedia no aporta porque la relación ya es 1:N y el snapshot debe seguir
siendo inmutable por reserva. Mantener los campos actuales para no romper el
expediente ni la preparación tarifaria por edad.

## 5. Agentes

`agents` mezcla hoy tres cosas: identidad (nombre, email, whatsapp, ciudad),
acceso (`user_id`, `access_status`, invitaciones) y configuración comercial
(comisión, cupos, prioridad, zona, disponibilidad). Integración futura:

- identidad → `persons` + `person_roles.role_type = 'agent'`;
- acceso → `organization_members` (rol `agent`), deprecando `agents.access_status`
  y el flujo de invitación propio a favor de `organization_invitations`;
- configuración comercial y comisiones → permanecen en `agents` (perfil de agente),
  ahora con `person_id` y `organization_id`.

## 6. Oportunidades

Estructura sana y transaccional: `client_id`, `quotation_id`, `stage`,
`estimated_value`/`currency`, `probability`, `next_action`, `owner_user_id`,
`assigned_agent_id`, `record_status`. No requiere identidad propia: hereda la
persona a través de `clients.person_id`. Solo necesita `organization_id` en la
fase de multi-tenancy para el aislamiento por marca.

## 7. Modelo recomendado CRM 360

```
                      persons  (identidad única por organización)
                         |
   +---------------------+----------------------+------------------+
   |                     |                      |                  |
customer_profile   traveler_profile        relationships         history
(= clients con      (= booking_passengers   (person ↔ person:     (leads,
 person_id)          con person_id)          familia, empresa)     timeline,
   |                     |                                         communications)
   +--> opportunities --> quotations --> bookings --> expediente 360
```

| Acción | Tablas |
| --- | --- |
| Mantener | `opportunities`, `quotations`, `bookings`, `commissions`, `communication_events`, `lead_history`, `organization_members`, `organization_invitations` |
| Extender | `clients` (+`person_id`, `organization_id`), `booking_passengers` (+`person_id`), `agents` (+`person_id`, `organization_id`), `leads` (+`person_id`, `organization_id`), `persons` (preferencias, deduplicación) |
| Migrar | datos de identidad de `clients`, `leads`, `booking_passengers` y `agents` hacia `persons` (backfill idempotente, sin borrar origen) |
| Eliminar en futuras versiones | ninguna tabla; solo **columnas** redundantes de identidad una vez que `person_id` sea obligatorio y la UI lea de `persons` (candidatas: contacto duplicado en `leads`, `access_status`/invitaciones de `agents`) |

## 8. Plan de migración por fases (propuesto, no ejecutado)

| Fase | Alcance | Riesgo |
| --- | --- | --- |
| v1.10.7.2.1 Person Link Layer | `person_id` nullable en `clients`, `leads`, `booking_passengers`, `agents`. Sin lógica ni UI. | bajo |
| v1.10.7.2.2 Backfill de identidad | crear `persons` desde los registros existentes con deduplicación por email/documento y resolución de organización. Origen intacto. | medio |
| v1.10.7.2.3 Customer & Traveler Profiles | UI de ficha 360, búsqueda unificada, historial por persona. | bajo |
| v1.10.7.2.4 Org Scoping | `organization_id` en `clients`, `leads`, `opportunities` y RLS por pertenencia. | alto (toca RLS productivo) |
| v1.10.7.2.5 Person as source of truth | lectura de identidad desde `persons`; columnas duplicadas quedan solo de lectura. | medio |
| v1.10.7.2.6 Cleanup | baja de columnas redundantes y unificación del acceso de agentes en `organization_members`. | medio |

Sin cambios en base de datos ni en código en esta versión.

---

# CRM 360 Link Layer (v1.10.7.2.1)

Primera fase de integración real: las entidades comerciales existentes ya pueden
apuntar al maestro de identidad. **Solo relaciones** — sin backfill, sin
deduplicación y sin cambios en la lógica comercial.

```
persons
   |
   + clients            (clients.person_id)
   + leads              (leads.person_id)
   + booking_passengers (booking_passengers.person_id)
   + agents             (agents.person_id)
```

## Columnas agregadas

| Tabla | Columna | FK | ON DELETE | Índice |
| --- | --- | --- | --- | --- |
| `clients` | `person_id uuid null` | `persons.id` | `SET NULL` | `idx_clients_person_id` |
| `leads` | `person_id uuid null` | `persons.id` | `SET NULL` | `idx_leads_person_id` |
| `booking_passengers` | `person_id uuid null` | `persons.id` | `SET NULL` | `idx_booking_passengers_person_id` |
| `agents` | `person_id uuid null` | `persons.id` | `SET NULL` | `idx_agents_person_id` |

`ON DELETE SET NULL` protege el histórico comercial: borrar una identidad nunca
elimina un cliente, lead, pasajero o agente. Migración idempotente
(`ADD COLUMN IF NOT EXISTS`, constraints e índices condicionales) y reversible
(basta con quitar columna, FK e índice).

## Invariantes respetadas

- No se eliminó ni modificó ninguna columna existente, ni se tocaron datos.
- `bookings`, `quotations`, `smart_quotes` y los motores del core sin cambios.
- `booking_passengers` conserva `first_name`, `last_name`, `document_type/number`,
  `birth_date` y `passenger_type` como snapshot del viaje.
- `agents` conserva `user_id`, comisiones, estados e invitaciones; la separación
  futura será: `persons` = identidad, `organization_members` = acceso,
  `agents` = función comercial y comisiones.
- RLS sin cambios: `person_id` es nullable y las políticas legacy siguen
  gobernando por `user_id` y roles globales; la FK no otorga lectura de `persons`
  (esa tabla mantiene su RLS por pertenencia a la organización, `org_identity_can_*`).

## Riesgos pendientes

1. `clients`, `leads`, `booking_passengers` y `agents` siguen **sin
   `organization_id`**: al hacer el backfill hay que resolver a qué organización
   pertenece cada identidad (v1.10.7.2.2 / .2.4).
2. Doble fuente de verdad temporal: identidad duplicada entre la tabla legacy y
   `persons` hasta la fase de consolidación.
3. Una fila legacy con `person_id` de otra organización no está bloqueada por
   constraint; se controlará en el backfill y en el scoping por organización.
4. Ninguna UI escribe `person_id` todavía: el vínculo se llena en fases futuras.

## Roadmap CRM 360 actualizado

| Versión | Alcance | Estado |
| --- | --- | --- |
| v1.10.7.2.0 Consolidation Audit | auditoría de arquitectura CRM y plan por fases | ✅ |
| v1.10.7.2.1 Person Link Layer | `person_id` nullable + FK + índices en `clients`, `leads`, `booking_passengers`, `agents` | ✅ |
| v1.10.7.2.2 Backfill de identidad | creación de `persons` desde registros existentes con deduplicación | 🔵 |
| v1.10.7.2.3 Customer & Traveler Profiles | ficha 360, búsqueda unificada e historial por persona | 🔵 |

# CRM Organization Scoping Audit (v1.10.7.2.1.1)

Auditoría **solo lectura**: no se crearon tablas ni columnas, no se modificó RLS,
no se ejecutaron migraciones ni se cambió código o datos.

## 1. Tablas CRM legacy auditadas

| Tabla | Relación con usuario | FK relevantes | Campos de propiedad | Filas |
| --- | --- | --- | --- | --- |
| `clients` | `user_id` → `auth.users` (CASCADE) | `person_id` → `persons` | `user_id` (dueño de facto) | 3 |
| `leads` | vía `assigned_agent_id` | `client_id`, `opportunity_id`, `quotation_id`, `assigned_agent_id`, `person_id` | `assigned_agent_id` | 1 |
| `opportunities` | vía `assigned_agent_id` / cliente | `client_id`, `quotation_id`, `assigned_agent_id` | `assigned_agent_id` | 1 |
| `agents` | `user_id` → `auth.users` (nullable), `created_by` | `person_id` | `created_by`, `user_id` | 1 |
| `booking_passengers` | `user_id` (creador) | `booking_id` → `bookings`, `person_id` | `user_id` | 0 |

Ninguna de las cinco tablas tiene `organization_id`. La única tabla del flujo con
esa columna es `bookings` (`organization_id` → `organizations`, ON DELETE SET NULL),
y hoy está **NULL en las 3 reservas existentes**.

## 2. Origen posible de `organization_id`

| Tabla | Fuente candidata | Nivel de confianza |
| --- | --- | --- |
| `clients` | `user_id` → `organization_members.user_id` (activo) | Parcialmente determinista |
| `leads` | `assigned_agent_id` → `agents.user_id` → `organization_members` | Parcialmente determinista |
| `opportunities` | `assigned_agent_id`, con respaldo en `clients.organization_id` | Parcialmente determinista |
| `agents` | `user_id` → `organization_members`; si es NULL, `created_by` | Parcialmente determinista |
| `booking_passengers` | `booking_id` → `bookings.organization_id` | Imposible hoy (origen vacío) |

Motivo de la degradación: `organization_members` permite N:M. La verificación
mostró 3 clientes que resuelven a 6 membresías activas, es decir usuarios que
pertenecen a más de una organización → la resolución por `user_id` **no es única**.
`organizations.user_id` (2 filas con dueño) sirve como desempate únicamente
cuando el usuario es dueño de una sola organización.

## 3. Flujos actuales

- **Cliente**: lo crea un usuario autenticado (agente o admin) y queda atado a
  `user_id`; la organización es implícita, nunca persistida.
- **Lead**: entra por la bandeja `/leads` y se asigna manual o automáticamente a
  un agente; su pertenencia real es la del agente asignado.
- **Opportunity**: tiene agente asignado y cliente asociado; hereda pertenencia
  por dos caminos que pueden discrepar.
- **Agent**: hoy no puede pertenecer formalmente a varias organizaciones desde
  `agents`; la relación multi-organización vive en `organization_members`.
- **Booking passengers**: siempre cuelgan de una reserva, y `bookings` sí tiene
  `organization_id`; el camino existe pero el dato está vacío.

## 4. Riesgo de backfill

| Clasificación | Tablas | Condición |
| --- | --- | --- |
| Seguro | ninguna | requiere membresía única por usuario |
| Parcial | `clients`, `agents`, `leads`, `opportunities` | resoluble con regla de precedencia (owner > membresía única > `created_by`) |
| Manual | `booking_passengers` y todo caso con membresía múltiple | exige primero poblar `bookings.organization_id` y revisión humana |

Riesgo principal: un backfill automático por `user_id` asignaría organización
arbitraria a usuarios multi-organización, generando fugas de datos al activar RLS.

## 5. Propuesta de migración (no implementada)

1. **Fase 1** — `organization_id uuid` nullable + FK + índice en las cinco tablas.
2. **Fase 2** — poblar `bookings.organization_id` (prerrequisito de pasajeros).
3. **Fase 3** — backfill determinista: dueño único → membresía activa única →
   `created_by`; herencia `booking_passengers` ← `bookings`, `opportunities` ←
   `clients`, `leads` ← agente.
4. **Fase 4** — informe de excepciones y resolución manual de ambigüedades.
5. **Fase 5** — `NOT NULL` solo donde la cobertura sea 100 %.
6. **Fase 6** — activar RLS por organización con los helpers `is_member_of` /
   `has_org_role`, manteniendo el acceso legacy de administradores globales.

## 6. Recomendación

No agregar `organization_id` hasta cerrar dos precondiciones: definir la
organización activa por usuario (o el criterio de precedencia formal) y poblar
`bookings.organization_id`. Con volumen actual mínimo (3 clientes, 1 lead,
1 oportunidad, 1 agente, 0 pasajeros) la corrección manual es trivial hoy y
mucho más costosa después.

---

# Booking Organization Scoping Audit (v1.10.7.2.1.2)

Auditoría **solo lectura**: no se crearon tablas ni columnas, no se modificó RLS,
no se ejecutaron migraciones ni se cambiaron código o datos.

Flujo auditado: `bookings → quotations → booking_services → transport_services →
booking_passengers → booking_service_economics / commissions`.

## 1. Tablas analizadas

| Tabla | organization_id | Dueño actual del registro | Notas |
|---|---|---|---|
| `bookings` | ✅ existe, nullable | `user_id` (creador) + `assigned_agent_id`, `operations_owner_id` | 3 filas, **100% organization_id NULL** |
| `quotations` | ❌ no existe | `user_id` + `client_id` | 15 filas; sin agente propio |
| `booking_services` | ✅ nullable | `user_id`, `responsible_user_id`, `provider_id` | 0 filas |
| `transport_services` | ✅ nullable | `user_id`, `provider_id`, recursos (driver/vehicle) | 0 filas |
| `booking_passengers` | ❌ no existe | `user_id` + `booking_id` (+ `person_id`) | 0 filas |
| `booking_service_economics` | ✅ nullable | `user_id`, `provider_id` | 0 filas |
| `commissions` | ✅ nullable | `user_id`, `agent_id`, `booking_id`, `quotation_id` | 0 filas |
| `agents` | ❌ no existe | `created_by`, `user_id` (nullable) | 1 fila |
| `providers` / `products` | ✅ existe | `user_id` | entidades de catálogo |
| `organizations` / `organization_members` | — | `user_id` / membresías | 2 orgs, 2 membresías |

## 2. Relaciones encontradas

- **¿Quién crea una booking?** Un usuario autenticado: `bookings.user_id` es el
  creador real. `assigned_agent_id` es comercial y `operations_owner_id` operativo;
  ninguno de los tres implica pertenencia organizacional.
- **Booking ↔ Quotation**: `bookings.quotation_id` es **nullable** — existen reservas
  sin cotización origen. La quotation **no tiene** `organization_id` ni `agent_id`.
- **Servicios operativos**: `booking_services` y `transport_services` cuelgan de
  `booking_id` (NOT NULL) y además tienen `organization_id` y `provider_id` propios.
  Es decir: **pueden apuntar a una organización distinta de la de la booking** (caso
  legítimo: la marca vendedora contrata un proveedor de otra organización).
- **Pasajeros**: sin organización propia; heredan siempre de la booking.
- **Economía / comisiones**: `booking_service_economics` y `commissions` ya llevan
  `organization_id` (rol de *contraparte del acuerdo*, no de tenant vendedor).
- **Agentes**: `agents` no tiene organización; el vínculo es `agents.user_id →
  organization_members`. Un agente puede ser miembro de varias organizaciones
  (hoy ya existe 1 usuario con 2 membresías), por lo que **sí podría vender bajo
  varias marcas** y derivar la organización desde el usuario es ambiguo.
- **Proveedor ≠ Organización**: `providers.organization_id` demuestra que el proveedor
  es un *rol comercial* de una organización, no el tenant dueño del dato. Confundirlos
  daría a un proveedor visibilidad de reservas ajenas.

## 3. Fuente de verdad recomendada

Opciones evaluadas: **A)** Booking · **B)** Quotation · **C)** Agent membership ·
**D)** Organización del creador · **E)** Combinación de reglas.

**Recomendación: A con resolución en cascada (variante de E).**
`bookings.organization_id` es la **única fuente de verdad del núcleo operativo**;
todo lo que cuelga de la booking (servicios, pasajeros, economía, comisiones) hereda
de ella. La cascada solo se usa para *determinar* ese valor al crear la booking:

1. organización explícita elegida en la UI (cuando el usuario es multi-org);
2. si no, organización del `assigned_agent_id` vía `organization_members` activo;
3. si no, única membresía activa del `user_id` creador;
4. si hay ambigüedad → error explícito, nunca adivinar.

Quotation (B) se descarta como fuente por no tener el campo y por ser opcional;
Agent membership (C) y creador (D) se descartan como fuente porque un usuario puede
pertenecer a varias organizaciones. `organization_id` en servicios se reinterpreta
como *contraparte proveedora*, no como tenant.

## 4. Riesgos

1. **Ambigüedad multi-org**: 1 usuario con 2 membresías → backfill por `user_id` no
   es determinista para reservas creadas por él.
2. **Backfill vacío**: las 3 bookings existentes tienen `organization_id` NULL; activar
   RLS por organización hoy dejaría esas reservas invisibles para todos menos admin global.
3. **Semántica doble de `organization_id`** en `booking_services`, `transport_services`,
   `booking_service_economics` y `commissions`: si se usa como tenant y como proveedor
   a la vez, un proveedor podría leer reservas de otra marca.
4. **Quotation huérfana**: sin `organization_id`, las 15 cotizaciones no pueden aislarse
   ni heredar hacia atrás desde una booking inexistente.
5. **Pasajeros e identidad**: `booking_passengers` sin organización obliga a JOIN con
   `bookings` en cada policy (coste y riesgo de olvido en una policy nueva).

## 5. Orden de implementación sugerido (NO implementado)

- **Fase 1 — Estructura**: `organization_id` nullable + FK + índice en `quotations`,
  `booking_passengers` y `agents`; en las tablas que ya lo tienen, separar semántica
  (documentar `organization_id` = tenant vs `provider_organization_id` = contraparte).
- **Fase 2 — Backfill seguro**: resolver por cascada solo cuando la membresía activa es
  única; dejar NULL y registrar en `audit_log` los casos ambiguos. Bookings primero,
  luego propagar a quotation, servicios, pasajeros y economía por `booking_id`.
- **Fase 3 — Validación de excepciones**: reporte de filas NULL, reservas con proveedor
  de otra organización, y usuarios multi-org; resolución manual desde `/admin`.
- **Fase 4 — RLS progresivo**: helpers `booking_org_can_read/write`; activar primero en
  módulos nuevos, luego en bookings con cláusula transitoria
  `organization_id IS NULL OR is_member_of(organization_id)`, y recién cuando el NULL
  llegue a cero endurecer a pertenencia estricta.

**Conclusión**: no se debe activar aislamiento SaaS en el núcleo operativo hasta
completar Fases 1–3. Ningún cambio fue realizado en esta auditoría.

---

# Booking Organization Ownership Model (v1.10.7.2.1.3)

Fase de **fundación**: se crearon únicamente dos funciones de base de datos.
No hubo backfill, no se crearon columnas ni triggers, no se modificó RLS y
ningún dato existente fue alterado.

## 1. Semántica formal

`bookings.organization_id` representa:

> **La organización comercial propietaria de la operación turística.**

**NO** representa proveedor, prestador, empresa externa ni la organización del
servicio. Esas relaciones viven en `booking_services.provider_id`,
`transport_services.provider_id` y `providers.organization_id`.

Regla derivada: todo lo que cuelga de la booking (`booking_services`,
`transport_services`, `booking_passengers`, `booking_service_economics`,
`commissions`) hereda pertenencia de la booking; su propio `organization_id`
—cuando existe— se interpreta como **contraparte proveedora**, nunca como tenant.

## 2. Funciones creadas

### `resolve_booking_organization(_creator_user_id uuid, _agent_id uuid default null, _explicit_org_id uuid default null) returns jsonb`

Prioridad de resolución:

1. `_explicit_org_id` presente y existente → `source=explicit`, `confidence=high`.
2. `_agent_id` → `agents.user_id` → `organization_members` activas.
   Única → `source=agent_membership`, `confidence=high`.
3. Sin agente → membresías activas del creador. Única → `creator_membership`, `confidence=medium`.
4. Múltiples candidatas → **no elige**: `error=ambiguous_organization` + `candidates[]`.
5. Ninguna → `error=no_organization_found`.

### `validate_booking_organization(_booking_id uuid) returns jsonb`

Verifica que la booking exista, que tenga `organization_id`, que la organización
exista y esté `active`, y marca `provider_semantics_conflict` cuando esa
organización también actúa como proveedor en `providers` (violación conceptual
del modelo de propiedad).

Seguridad de ambas: `SECURITY DEFINER`, `SET search_path = public`,
`REVOKE ALL ... FROM PUBLIC, anon`, `GRANT EXECUTE TO authenticated, service_role`.

## 3. Triggers futuros (documentado, NO implementado)

Uso previsto en una fase posterior: trigger `BEFORE INSERT ON bookings` que, si
`NEW.organization_id IS NULL`, invoque `resolve_booking_organization` y aborte con
error explícito cuando el resultado sea ambiguo. **Hoy no existe ningún trigger.**

## 4. Reporte de bookings existentes (solo lectura, sin cambios)

| booking | user_id | assigned_agent_id | organization_id actual | org detectada | confianza |
|---|---|---|---|---|---|
| 03880bd5… | feb6d26c… | 155ae261… | NULL | — | ambigua (2 membresías) |
| 21251e01… | feb6d26c… | 155ae261… | NULL | — | ambigua (2 membresías) |
| 6006cc6c… | feb6d26c… | NULL | NULL | — | ambigua (2 membresías) |

Las 3 reservas quedan sin resolución automática: el único usuario operativo es
miembro activo de **ambas** organizaciones (`04b15cb8…`, `1eabdb41…`), por lo que la
función devuelve `ambiguous_organization` en los tres casos. Se requiere decisión
humana antes de cualquier backfill.

## 5. Riesgos pendientes

1. **Ambigüedad total del dataset actual**: 3/3 bookings sin resolución automática.
2. **Sin trigger**: nuevas bookings pueden seguir naciendo con `organization_id` NULL.
3. **Doble semántica** de `organization_id` en tablas de servicio/economía todavía sin
   separar en columna propia (`provider_organization_id`).
4. **`quotations` y `booking_passengers`** aún sin `organization_id`.
5. **RLS por organización sigue inactivo** en el núcleo operativo: el aislamiento SaaS
   real depende de las fases 2–4 de la auditoría v1.10.7.2.1.2.

---

# Booking Creation Ownership Rules (v1.10.7.2.1.4)

**Regla central: una booking nueva siempre nace con organización propietaria.**
`bookings.organization_id` sigue siendo la fuente de verdad y sigue significando
*organización comercial responsable de la operación turística* (nunca proveedor,
prestador, empresa externa ni organización del servicio).

## 1. Caminos de creación auditados

| Camino | Estado |
| --- | --- |
| Frontend `createBooking()` (`src/lib/bookings.ts`) → `INSERT public.bookings` | único punto de alta de la app (dialogo `booking-create-dialog.tsx`, desde oportunidad o cotización) |
| RPC de creación de bookings | no existe |
| Server functions / edge functions de alta | no existen |
| Triggers previos en `bookings` | `bookings_number`, `bookings_status_history`, `booking_operations_*`, `bookings_audit`, `trg_seed_booking_checklist`, `trg_timeline_bookings` (ninguno resolvía organización) |
| Migraciones / `service_role` | exentos por diseño |

## 2. Enforcement implementado

`tg_booking_require_organization()` — trigger `bookings_require_organization`
BEFORE INSERT ON `public.bookings`:

1. Si no hay `auth.uid()` o el rol es `service_role` → **pasa** (procesos
   administrativos controlados, migraciones, backfills).
2. Si viene `organization_id` explícito → valida permiso con
   `can_create_booking_for_organization(auth.uid(), organization_id)`.
3. Si viene NULL → resuelve con `resolve_booking_organization(user_id, assigned_agent_id, NULL)`
   (agente asignado → única organización activa del creador) y valida permiso.
4. Ambigüedad o ausencia → **bloqueo**.

Mensaje único de error: `Booking requires a valid organization`, con `HINT`
diagnóstico: `ambiguous_organization`, `no_organization_found`,
`organization_not_found` o `not_allowed_for_organization`. El frontend lo
traduce en `bookingCreateErrorMessage()`.

## 3. `can_create_booking_for_organization(_user_id uuid, _org_id uuid) → boolean`

`SECURITY DEFINER`, `search_path = public`, sin `EXECUTE` para `anon`.
Devuelve `true` si el usuario es admin global (`has_role(_user_id,'admin')`) o
miembro **activo** de esa organización con rol
`organization_owner | organization_admin | operations | agent`.

## 4. Pruebas ejecutadas (todas en transacciones con ROLLBACK)

| Caso | Resultado |
| --- | --- |
| Usuario con una organización, sin especificar | OK, `organization_id` resuelto automáticamente |
| Usuario con dos organizaciones, sin especificar | bloqueado (`ambiguous_organization`) |
| Usuario intenta crear en organización ajena | bloqueado (`not_allowed_for_organization`) |
| Admin global con organización explícita | OK |
| Datos existentes (3 bookings con `organization_id` NULL) | sin cambios |

## 5. Log de eventos

`audit_log` existe pero un `RAISE EXCEPTION` en el trigger **revierte** cualquier
insert de auditoría en la misma transacción. Por eso los intentos bloqueados
**no se registran todavía**. Fase futura: registrar usuario, fecha, organización
solicitada y motivo desde una función `SECURITY DEFINER` con canal fuera de la
transacción (p. ej. `pg_net` a un endpoint interno) o validación previa en la
capa de aplicación.

## 6. Riesgos pendientes

- 3 bookings históricas siguen con `organization_id` NULL (sin backfill).
- La columna sigue **nullable**: `NOT NULL` recién cuando el backfill termine.
- RLS por organización sigue inactivo (roles globales vigentes).
- `quotations` y `booking_passengers` aún sin `organization_id`.
- Doble semántica de `organization_id` en servicios/economía sin separar.
