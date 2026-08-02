# 06 — Seguridad y RLS

## Índice
1. [Principios](#principios)
2. [Roles y su origen](#roles-y-su-origen)
3. [Matriz de acceso](#matriz-de-acceso)
4. [Cobertura de RLS](#cobertura-de-rls)
5. [Datos sensibles](#datos-sensibles)
6. [Superficie pública](#superficie-pública)
7. [Auditoría e inmutabilidad](#auditoría-e-inmutabilidad)
8. [Riesgos conocidos](#riesgos-conocidos)

## Principios

1. Los roles viven en `user_roles`, **nunca** en `profiles` — se consultan con
   `has_role(uid, role)` (`SECURITY DEFINER`, evita recursión en las políticas).
2. El recorte de datos lo hace la base (RLS y funciones), no el cliente.
3. Sin registro libre: cuenta `pending` hasta la aprobación (`is_approved`).
4. `anon` no tiene acceso a datos internos; lo público pasa por token validado en el servidor.
5. Los historiales son append-only y protegidos por triggers.

## Roles y su origen

| Rol / condición | Cómo se determina |
| --- | --- |
| `admin` | `has_role(uid,'admin')` |
| `operations` | `is_operations(uid)` = admin **o** rol `operations` |
| `agent` | Rol `agent` + vínculo `agents.user_id` (`current_agent_id()`) |
| `provider` | Rol `provider` + organización/proveedor asociado |
| Conductor | `is_driver(uid)` + `current_driver_resource_ids()` |
| Cuenta habilitada | `is_approved(uid)` (o admin) |

## Matriz de acceso

| Dominio | admin | operations | agent | provider | conductor | anon |
| --- | --- | --- | --- | --- | --- | --- |
| Cotizaciones / CRM / leads | total | lectura operativa | solo lo propio | — | — | — |
| Reservas y expediente | total | total operativo | reservas asignadas | servicios propios | servicios asignados | — |
| Costos, márgenes, comisiones | total | **sin costos ni márgenes** | resumen propio | — | — | — |
| Recursos y transporte | total | total | según asignación | recursos propios | los propios | — |
| Acuerdos comerciales | total | lectura | — | — | — | — |
| Timeline de la reserva | total | total | reservas propias | — | — | — |
| Usuarios, roles, auditoría | total | — | — | — | — | — |
| Configuración de empresa | escritura | lectura | lectura | — | — | — |
| Cotización pública / seguimiento | — | — | — | — | — | solo por token, campos filtrados |

## Cobertura de RLS

Las **43 tablas** del esquema `public` tienen `ROW LEVEL SECURITY` habilitado y al
menos una política. Recuento de políticas por tabla (referencia rápida):

| Tabla | Políticas | Tabla | Políticas |
| --- | --- | --- | --- |
| `bookings` | 6 | `transport_services` | 6 |
| `profiles` | 6 | `booking_timeline` | 5 |
| `resources` | 5 | `booking_passengers` | 4 |
| `organizations` | 4 | `agreement_rules` | 4 |
| `user_roles` | 4 | `booking_resources` | 4 |
| `resource_extra_links` | 4 | `transport_service_extras` | 4 |
| `quotations`, `clients`, `leads`, `opportunities`, `commissions`, `commercial_agreements`, `booking_services`, `booking_payments`, `booking_documents`, `booking_service_economics`, `communication_events`, `providers`, `provider_evaluations`, `companies`, `exchange_rates`, `resource_extras` | 3 | `agents`, `notifications`, `company_settings`, `organization_roles`, `permission_audit_log`, `lead_history`, `booking_checklist_items`, `booking_incidents`, `resource_availability_log`, `transport_service_history` | 2 |
| `audit_log`, `agreement_history`, `commission_history`, `quotation_history`, `booking_status_history` | 1 (solo lectura restringida) | | |

## Datos sensibles

| Dato | Regla |
| --- | --- |
| Costos, márgenes y comisiones | Solo Administrador; `operations` ve operación sin economía sensible |
| Documentos y datos de pasajeros (DNI, pasaporte, contacto) | Nunca en enlaces públicos ni PDF; protegidos por RLS |
| Claves de servicio y contraseña de base | No accesibles desde la aplicación |
| Imágenes de cotizaciones | Bucket privado, acceso por signed URL |

## Superficie pública

| Ruta | Mecanismo |
| --- | --- |
| `/cotizacion/$token` | Server function con validación del token en el servidor; devuelve solo campos publicables. No existe política de lectura pública sobre `quotations` |
| `/seguimiento/$token` | Función `booking_public_tracking(token)`: número de reserva, destino, fechas y estado del viaje; nada más |
| `/` y `/auth` | Sin datos de negocio |

## Auditoría e inmutabilidad

- `audit_log` y `permission_audit_log`: cambios de entidades y de permisos.
- `*_history` (quotation, lead, agreement, booking_status, transport_service, commission): solo inserción.
- `booking_timeline`: append-only por `tg_timeline_append_only`; se escribe únicamente
  desde triggers vía `create_booking_timeline_event` (ejecución concedida solo a `service_role`).
- `commissions`: `tg_commission_immutable` impide modificar registros.
- `prevent_last_admin_removal`: siempre queda al menos un administrador.

## Riesgos conocidos

| Riesgo | Mitigación actual |
| --- | --- |
| Duplicación de reglas entre `providers`/`organizations` | Políticas equivalentes en ambas; consolidar en una versión futura |
| Estados comercial y operativo conviviendo | El operativo es derivado y no editable |
| Comisiones sin devengo | La UI etiqueta explícitamente "Simulación — no genera movimiento contable" |
| Ausencia de tests automatizados | Verificación por typecheck, linter de base y consultas de auditoría |
