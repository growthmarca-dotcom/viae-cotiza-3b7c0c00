# 02 — Changelog

> Reconstruido a partir de las migraciones (`supabase/migrations/`, 48 archivos entre
> 2026-07-31 y 2026-08-02) y del código actual. Solo se listan cambios efectivamente
> aplicados.

## Índice
- [1.9.5.x — Expediente de Viaje 360°](#195x--expediente-de-viaje-360)
- [1.9.x — Organizaciones, acuerdos y comisiones](#19x--organizaciones-acuerdos-y-comisiones)
- [1.8.x — Central operativa](#18x--central-operativa)
- [1.6–1.7 — Economía y leads](#1617--economía-y-leads)
- [1.0–1.5 — Reservas, recursos y transporte](#1015--reservas-recursos-y-transporte)
- [0.x — Base comercial](#0x--base-comercial)

## 1.9.5.x — Expediente de Viaje 360°

### 1.9.5.4 — Primera capa visual ✅
- Cabecera del expediente con **estado comercial y estado operativo separados**,
  barra de avance y listado de pendientes (`booking-dossier-header.tsx`).
- `/bookings/$id` reorganizado en 7 pestañas: Resumen, Servicios y operación,
  Economía, Documentos, Comunicaciones, Comisiones, Timeline.
- Nuevos paneles: `booking-timeline-panel`, `booking-economy-panel`,
  `booking-communications-panel`. Los paneles previos (recursos, transporte,
  checklist, incidencias, proveedor) pasaron a subpestañas.
- Nueva capa de dominio `src/lib/timeline.ts` (etiquetas, categorías, metadata).
- Sin cambios de base de datos ni de RLS.

### 1.9.5.3 — Trip state derivado ✅
- Función `booking_trip_state(uuid) -> jsonb` (`STABLE`, respeta RLS) con estados
  `draft → quoted → partially_confirmed → confirmed → operational → finished → cancelled`.
- `src/lib/trip-state.ts`. No se persiste el resultado.

### 1.9.5.2 A — Motor de eventos del timeline ✅
- `create_booking_timeline_event(...)` (`SECURITY DEFINER`, solo `service_role`).
- Triggers de alimentación en `bookings`, `booking_payments`, `booking_services`,
  `booking_documents`, `booking_checklist_items`, `booking_incidents`,
  `communication_events`.

### 1.9.5.1 — Preparación tarifaria de pasajeros ✅
- Enum `passenger_type` (`adult`, `child`, `infant`, `senior`, `other`).
- `calculate_passenger_age(birth_date, travel_date)` y helpers TS
  (`calculatePassengerAge`, `groupComposition`). Sin cálculo de precios.

### 1.9.5 Fase 1 ✅
- Tabla `booking_passengers` (+ índice de un solo titular activo por reserva) y panel de UI.
- `bookings.booking_number` con formato humano `VIA-AA-000001` (`tg_booking_number`).
- Tabla `booking_timeline` + enums `booking_timeline_event`, `timeline_visibility` +
  trigger `tg_timeline_append_only` (sin UPDATE ni DELETE).

## 1.9.x — Organizaciones, acuerdos y comisiones

- **1.9.4 A** 🟡 — Enum `commission_status`, tabla `commissions` (vacía, inmutable
  por `tg_commission_immutable`), `resolve_agreement()`, `compute_commission()`,
  `simulate_commission()`, `simulate_commission_transport()`,
  `commission-simulation-panel.tsx`. No genera movimientos contables.
- **1.9.3 A** ✅ — `agreement_rules`, `agreement_history`,
  `booking_service_economics`, snapshots de tipo de cambio y `rate_at()`.
- **1.9.2** ✅ — `commercial_agreements`, `/agreements`, panel en la ficha de organización.
- **1.9.1** 🟡 — `organizations` + `organization_roles`, `/organizations`,
  `ensure_provider_organization()`. `companies` y `providers` siguen vivos.
- **1.9** ✅ — `providers`, `provider_evaluations`, `/providers` y métricas.

## 1.8.x — Central operativa

- **1.8.2 / .1** ✅ — `resource_class`, subtipos, propietario, datos técnicos,
  `resource_extras` + `resource_extra_links`, formulario en acordeón, geografía AR.
- **1.8.1** ✅ — `booking_checklist_items` (`default_checklist_items()` +
  `tg_seed_booking_checklist`), `booking_incidents`, avance operativo.
- **1.8** ✅ — Rol `operations`, `booking_operation_status`, bandeja `/operations`,
  `booking_services`, dashboard operativo.

## 1.6–1.7 — Economía y leads

- **1.7** ✅ — `leads`, `lead_history`, asignación manual/automática
  (`lead_assignment_mode`), conversión a cliente, métricas por agente.
- **1.6** ✅ — `booking_service_economics` previo/`transport_services` con venta,
  costo y margen; `exchange_rates` con TC manual; estados de cobro y liquidación.

## 1.0–1.5 — Reservas, recursos y transporte

- **1.5** ✅ — Notificaciones realtime (`notifications`, `notify_operations_team`),
  `communication_events`, seguimiento público `/seguimiento/$token`
  (`booking_public_tracking`), branding del desarrollador.
- **1.4** ✅ — Duración estimada, catálogo geográfico, campana global, filtros por zona.
- **1.3** ✅ — `/agenda`, advertencias de asignación, notificaciones internas.
- **1.2** ✅ — `/driver` con aceptar/rechazar y estados de viaje
  (`current_driver_resource_ids`, `driver_service_context`).
- **1.1** ✅ — `transport_services`, `transport_service_history`, `/transport`.
- **1.0** ✅ — `resources`, `booking_resources`, `resource_availability_log`, `bookings`.

## 0.x — Base comercial

- **0.8** ✅ — Moneda de análisis global, `record_status` (archivado), `audit_log`,
  exportación CSV, invitación y vinculación de usuarios a agentes.
- **0.7** ✅ — `agents`, ficha, estadísticas y `assigned_agent_id` en el CRM.
- **0.6** ✅ — `clients`, `opportunities`, multimoneda ARS/USD con TC manual.
- **0.5** ✅ — `user_roles` + `has_role()`, `account_status`, `/admin`,
  `permission_audit_log`, `prevent_last_admin_removal`, `claim_admin_if_none`,
  `company_settings` (logo, colores, contacto), PDF con branding.
- **0.1–0.4** ✅ — Auth email/password, dashboard, `quotations` + `quotation_history`,
  bucket `quotation-images`, enlace público `/cotizacion/$token` validado en servidor.
