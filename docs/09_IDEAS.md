# 09 — Ideas y backlog

> **Nada de este documento está implementado.** Es material de trabajo, no
> descripción del producto. Lo que existe hoy está en `05_MODULOS.md`.

## Índice
1. [Ideas con base ya preparada](#ideas-con-base-ya-preparada)
2. [Ideas sin base técnica aún](#ideas-sin-base-técnica-aún)
3. [Mejoras de UX propuestas](#mejoras-de-ux-propuestas)
4. [Higiene técnica](#higiene-técnica)
5. [Preguntas abiertas](#preguntas-abiertas)

## Ideas con base ya preparada

El esquema o la capa de dominio ya contemplan estos casos, falta activarlos.

| Idea | Base existente |
| --- | --- |
| Devengo real de comisiones y estados de comisión | `commissions`, `commission_status`, `commission_history` (vacías) |
| Liquidaciones por período a agentes y proveedores | Estados de cobro/liquidación en transporte, acuerdos versionados |
| Materializar el estado operativo del viaje | `booking_trip_state()` con contrato estable |
| Alertas y bandeja por estado operativo | `pending_items` y `progress` ya calculados |
| Motor tarifario por composición del grupo | `passenger_type`, `calculate_passenger_age`, `groupComposition` |
| Envío real de WhatsApp / email | `communication_events`, `agent_wa_status`, estados de lectura |
| Exponer parte del timeline al cliente | `timeline_visibility` en cada evento |
| Consolidar entidades comerciales | `organizations` + `organization_roles`, `ensure_provider_organization()` |
| Vencimiento automático de invitaciones | `expire_stale_invitations()` (sin programación periódica) |

## Ideas sin base técnica aún

- Portal del cliente con login (hoy solo seguimiento por token).
- Pagos online y conciliación bancaria.
- Documentos generados automáticamente (vouchers, itinerarios).
- Firma digital de acuerdos.
- Reportes exportables a Excel con formato (hoy solo CSV plano).
- Aplicación móvil dedicada para conductores.
- Integraciones con mayoristas o GDS.
- Asistente de IA para redactar cotizaciones o resumir el expediente.
- Multi-tenant real (varias agencias en la misma instalación).

## Mejoras de UX propuestas

- Buscador global (reservas, clientes, cotizaciones, número `VIA-…`).
- Vista de calendario mensual del viaje además de la agenda diaria.
- Comparador de versiones de cotización.
- Panel del agente con sus objetivos y avance.
- Acciones rápidas desde el listado de reservas sin abrir el expediente.

## Higiene técnica

- Suite de pruebas automatizadas (hoy: typecheck + linter de base + consultas manuales).
- Retirar `companies` y `providers` una vez consolidado `organizations`.
- Unificar la economía de `transport_services` con `booking_service_economics`.
- Índices de rendimiento sobre `booking_timeline` y `communication_events` cuando crezcan.
- Política de retención/archivado para tablas de historial.

## Preguntas abiertas

1. ¿La comisión se devenga al confirmar el servicio o al cobrar al cliente?
2. ¿Las liquidaciones se cierran por mes calendario o por fecha de viaje?
3. ¿El cliente final debería ver montos o solo el estado del viaje?
4. ¿Las tarifas mayoristas se cargan por rango de edad o por tipo de pasajero?
5. ¿Qué eventos del timeline son aptos para mostrar al cliente sin generar consultas extra?
