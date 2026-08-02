# 01 — Roadmap

> ✅ Implementado · 🟡 Parcial · 🔵 Planificado

## Índice
1. [Estado por versión](#estado-por-versión)
2. [Próximos pasos naturales](#próximos-pasos-naturales)
3. [Deuda técnica conocida](#deuda-técnica-conocida)

## Estado por versión

| Versión | Alcance | Estado |
| --- | --- | --- |
| 0.1–0.5 | Auth email/password, dashboard, cotizaciones, enlace público, PDF, branding | ✅ |
| 0.5.x | Roles, aprobación de cuentas, recuperación de admin, auditoría de permisos | ✅ |
| 0.6 | CRM de clientes + pipeline de oportunidades + multimoneda ARS/USD | ✅ |
| 0.7 | Módulo de agentes (ficha, estadísticas, vinculación con usuario) | ✅ |
| 0.8 | Consolidación: moneda de análisis global, archivado, auditoría, export CSV | ✅ |
| 1.0 | Recursos operativos (alojamiento, vehículo, guía, etc.) | ✅ |
| 1.1 | Red de transporte distribuida + servicios de transporte por reserva | ✅ |
| 1.2 | Panel operativo del conductor (`/driver`) | ✅ |
| 1.3 | Operación avanzada: agenda, advertencias de asignación, notificaciones | ✅ |
| 1.4 | Inteligencia operativa: duración estimada, geografía, seguimiento, filtros | ✅ |
| 1.5 | Comunicación operativa: realtime, `communication_events`, seguimiento público | ✅ |
| 1.6 | Economía del transporte: venta, costo, margen, TC manual, cobro/liquidación | ✅ |
| 1.7 | CRM comercial y leads: bandeja, ciclo de vida, asignación, conversión | ✅ |
| 1.8 | Central operativa de reservas (rol `operations`, estado operativo, bandeja) | ✅ |
| 1.8.1 | Checklist operativo e incidencias | ✅ |
| 1.8.2 / .1 | Catálogo inteligente de recursos + UX en acordeón, geografía AR | ✅ |
| 1.9 | Módulo de proveedores (`/providers`, evaluación, métricas) | ✅ |
| 1.9.1 | Entidades comerciales unificadas (`organizations`, `organization_roles`) | 🟡 conviven con `companies` y `providers` |
| 1.9.2 | Acuerdos comerciales (`commercial_agreements`, `/agreements`) | ✅ |
| 1.9.3 A | Normalización económica (`agreement_rules`, `booking_service_economics`, `rate_at`) | ✅ |
| 1.9.4 A | Motor de comisiones **en simulación** (`resolve_agreement`, `compute_commission`) | 🟡 sin devengo ni persistencia |
| 1.9.5 F1 | `booking_passengers`, `booking_number` VIA-AA-000001, `booking_timeline` | ✅ |
| 1.9.5.1 | Preparación tarifaria de pasajeros (`passenger_type`, edad dinámica) | ✅ estructural |
| 1.9.5.2 A | Motor de eventos internos del timeline (triggers) | ✅ |
| 1.9.5.3 | `booking_trip_state` derivado (sin persistencia) | ✅ |
| 1.9.5.4 | Expediente de Viaje 360° — primera capa visual (7 pestañas) | ✅ |

## Próximos pasos naturales

Ninguno de estos está iniciado (🔵):

1. **v1.9.4 Fase B** — devengo real de comisiones: escritura en `commissions`,
   estados (`commission_status`), y uso de `commission_history`.
2. **Liquidaciones** — cierres por período, pagos a agentes y proveedores.
3. **Materializar `trip_state`** — persistir el estado derivado en `bookings`
   y alimentar alertas y bandejas con él.
4. **Motor tarifario** — usar `groupComposition` / `calculate_passenger_age`
   para tarifas por edad y tarifas mayoristas.
5. **Consolidación de entidades** — retirar `companies` y `providers` en favor
   de `organizations` + `organization_roles`.
6. **Envío real de comunicaciones** — WhatsApp/email sobre `communication_events`.
7. **Portal de cliente** — hoy solo existe seguimiento por token sin login.

## Deuda técnica conocida

| Tema | Detalle |
| --- | --- |
| Duplicación de entidades | `organizations` vs `companies`/`providers` (migración incompleta) |
| Comisiones | Capa de cálculo sin persistencia; la UI aclara "simulación" |
| Estados duplicados | `bookings.status` (manual) y `booking_trip_state` (derivado) conviven |
| Transporte vs servicios | `transport_services` y `booking_services` tienen economía separada |
| Tests | No hay suite de pruebas automatizadas; la verificación es typecheck + consultas SQL |
