# 04 — Base de datos

> Esquema `public`. **43 tablas**, todas con RLS habilitado. Fuente: migraciones y
> catálogo actual de la base.

## Índice
1. [Tablas por dominio](#tablas-por-dominio)
2. [Tipos enumerados](#tipos-enumerados)
3. [Funciones](#funciones)
4. [Triggers principales](#triggers-principales)
5. [Storage](#storage)
6. [Notas de integridad](#notas-de-integridad)

## Tablas por dominio

### Identidad y control
| Tabla | Contenido | Estado |
| --- | --- | --- |
| `profiles` | Perfil del usuario, `status` (`account_status`), nombre, agencia | ✅ |
| `user_roles` | Roles por usuario (tabla separada, nunca en el perfil) | ✅ |
| `permission_audit_log` | Cambios de rol y permisos | ✅ |
| `audit_log` | Auditoría genérica de entidades | ✅ |
| `company_settings` | Branding, contacto, moneda de análisis | ✅ |
| `notifications` | Notificaciones internas (realtime) | ✅ |

### Comercial
| Tabla | Contenido | Estado |
| --- | --- | --- |
| `clients` | Centro de clientes | ✅ |
| `leads` / `lead_history` | Consultas entrantes y su ciclo de vida | ✅ |
| `opportunities` | Pipeline comercial (una por cotización) | ✅ |
| `quotations` / `quotation_history` | Cotizaciones, enlace público, PDF, versiones | ✅ |
| `agents` | Red comercial (puede existir sin usuario) | ✅ |
| `companies` | Entidades previas a `organizations` | 🟡 legado |
| `organizations` / `organization_roles` | Entidad comercial unificada y sus papeles | 🟡 en migración |
| `providers` / `provider_evaluations` | Proveedores y evaluación interna | 🟡 legado parcial |

### Acuerdos y comisiones
| Tabla | Contenido | Estado |
| --- | --- | --- |
| `commercial_agreements` | Acuerdos por contraparte, versión y vigencia | ✅ |
| `agreement_rules` | Reglas por alcance (destino, tipo de servicio, etc.) | ✅ |
| `agreement_history` | Historial inmutable de acuerdos | ✅ |
| `commissions` | Devengo de comisiones — **vacía por diseño** | 🟡 |
| `commission_history` | Preparada para la fase de devengo | 🔵 sin uso |
| `exchange_rates` | Tipos de cambio manuales con snapshot por fecha | ✅ |

### Reservas y expediente
| Tabla | Contenido | Estado |
| --- | --- | --- |
| `bookings` | Reserva; `booking_number` `VIA-AA-000001`, estado comercial y operativo | ✅ |
| `booking_status_history` | Historial de estados | ✅ |
| `booking_services` | Servicios incluidos en la reserva | ✅ |
| `booking_service_economics` | Venta, impuestos, extras, costo y margen por servicio | ✅ |
| `booking_passengers` | Pasajeros, titular, tipo tarifario, documento | ✅ |
| `booking_payments` | Cobros y pagos de la reserva | ✅ |
| `booking_documents` | Documentos asociados | ✅ |
| `booking_checklist_items` | Checklist operativo (se siembra por trigger) | ✅ |
| `booking_incidents` | Incidencias con prioridad y estado | ✅ |
| `booking_resources` | Recursos asignados a la reserva | ✅ |
| `booking_timeline` | Expediente narrativo **append-only** | ✅ |

### Recursos y transporte
| Tabla | Contenido | Estado |
| --- | --- | --- |
| `resources` | Catálogo operativo (77 columnas: clase, subtipo, vehículo, cobertura) | ✅ |
| `resource_extras` / `resource_extra_links` | Catálogo de extras y su vinculación | ✅ |
| `resource_availability_log` | Cambios de disponibilidad | ✅ |
| `transport_services` | Servicios de transporte (60 columnas: operación + economía) | ✅ |
| `transport_service_extras` | Extras del servicio de transporte | ✅ |
| `transport_service_history` | Historial del servicio | ✅ |
| `communication_events` | Eventos de comunicación registrados (sin envío real) | 🟡 |

## Tipos enumerados

54 enums. Los más relevantes:

| Enum | Valores |
| --- | --- |
| `app_role` | admin, agent, provider, operations |
| `account_status` | pending, approved, rejected, suspended |
| `record_status` | activo / archivado (archivado en lugar de borrado) |
| `booking_status` | estado **comercial** manual de la reserva |
| `booking_operation_status` | estado operativo de la central de operaciones |
| `client_trip_status` | estado mostrado al cliente en el seguimiento público |
| `booking_timeline_event` | created, updated, status_changed, payment_received, service_confirmed, provider_confirmed, resource_assigned, document_added, checklist_completed, incident_opened, incident_resolved, communication_sent, communication_read |
| `timeline_visibility` | visibilidad interna / cliente del evento |
| `passenger_type` | adult, child, infant, senior, other |
| `commission_status`, `commission_type`, `agreement_base` | percentage/fixed y bases gross, net, cost, margin |
| `transport_*` | tipo, estado, cobro, liquidación, modo de pago |
| `lead_status`, `lead_source`, `lead_assignment_mode` | ciclo de vida de la consulta |
| `incident_category`, `incident_priority`, `incident_status` | incidencias |
| `resource_category`, `resource_class`, `resource_owner_type`, `vehicle_type`, `resource_availability` | catálogo de recursos |

## Funciones

Seguridad y roles: `has_role`, `is_approved`, `is_operations`, `is_driver`,
`admins_exist`, `claim_admin_if_none`, `current_agent_id`,
`current_driver_resource_ids`, `handle_new_user`, `expire_stale_invitations`.

Expediente y operación: `booking_trip_state` (derivado, `STABLE`),
`create_booking_timeline_event` (solo `service_role`), `default_checklist_items`,
`calculate_passenger_age`, `sync_booking_client_status`, `booking_public_tracking`
(seguimiento por token), `driver_service_context`, `sync_transport_resource_state`,
`notify_operations_team`, `mark_notifications_read`.

Economía: `rate_at`, `resolve_agreement` (score por especificidad),
`compute_commission`, `simulate_commission`, `simulate_commission_transport`,
`ensure_provider_organization`.

## Triggers principales

| Trigger | Efecto |
| --- | --- |
| `tg_booking_number` | Genera `VIA-AA-000001` en reservas nuevas |
| `tg_seed_booking_checklist` | Crea el checklist base al crear la reserva |
| `tg_timeline_append_only` | Prohíbe UPDATE y DELETE en `booking_timeline` |
| `tg_timeline_*` (bookings, payments, services, documents, checklist, incidents, communication) | Alimentan el timeline automáticamente |
| `tg_commission_immutable` | Impide alterar comisiones registradas |
| `prevent_last_admin_removal` | No permite quedarse sin administradores |
| `log_role_change`, `log_status_change`, `log_quotation_change`, `tg_audit*` | Auditoría |
| `tg_lead_*`, `tg_opportunity_assignment_stamp`, `validate_opportunity` | CRM |
| `tg_notify_driver_assignment`, `tg_notify_transport_events` | Notificaciones |
| `tg_sync_driver_availability`, `tg_resource_availability_log` | Disponibilidad de recursos |
| `tg_set_updated_at` | Mantiene `updated_at` |

## Storage

- `quotation-images` — hasta 10 imágenes por cotización; lectura mediante signed URLs.

## Notas de integridad

- Todas las tablas del esquema `public` tienen RLS **habilitado** y al menos una política.
- Un solo pasajero titular activo por reserva (índice único parcial).
- `commissions` y `commission_history` permanecen vacías en la fase actual.
- Los importes se guardan con su moneda; la conversión usa `exchange_rates` / `rate_at`.
