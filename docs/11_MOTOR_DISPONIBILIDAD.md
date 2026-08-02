# 11 — Motor de Disponibilidad Multiproveedor (Fase 0 · solo estructura)

Estado: **infraestructura creada, sin lógica**. No hay búsquedas reales, no hay
conexión a APIs externas, no hay RPC, no hay triggers de negocio y ningún flujo
existente (reservas, transporte, cotizaciones, motor tarifario, comisiones,
Expediente 360°) fue modificado.

## 1. Propósito

Preparar la base para resolver disponibilidad desde múltiples orígenes
(APIs de mayoristas, caché, calendario propio del proveedor y solicitud manual)
con un orden de prioridad configurable por organización y tipo de servicio.

## 2. Entidades

### 2.1 `availability_sources`
Cada origen posible de disponibilidad.

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | uuid | PK |
| `owner_id` | uuid | dueño del registro (tenant actual) |
| `organization_id` | uuid → `organizations` | ON DELETE CASCADE |
| `provider_id` | uuid → `providers` | nullable, ON DELETE SET NULL |
| `source_type` | `availability_source_type` | `manual` · `api` · `cache` · `external` |
| `source_name` | text | ej. "API HotelDO" |
| `priority` | integer | menor = se evalúa antes |
| `enabled` | boolean | default `true` |
| `configuration` | jsonb | credenciales/parámetros lógicos (sin secretos) |
| `created_at` / `updated_at` | timestamptz | trigger `tg_set_updated_at` |

Una organización puede tener varios orígenes.

### 2.2 `service_availability`
Calendario propio del proveedor. **Los cupos no se calculan automáticamente.**

`service_id`, `availability_date`, `start_time`, `end_time`,
`available_units`, `reserved_units`, `status`, `owner_id`, `organization_id`, `notes`.

Estados (`availability_status`): `available`, `limited`, `full`, `closed`, `blocked`.

Checks: unidades no negativas y `end_time >= start_time`.
`service_id` es un uuid libre a propósito: en fases posteriores podrá apuntar a
`transport_services`, `booking_services` o `resources` sin migrar datos.

### 2.3 `availability_cache`
Resultado temporal de consultas externas: `source_id`, `service_id`,
`query_hash`, `availability_result` (jsonb), `expires_at`, `created_at`.
Sin expiración automática ni limpieza programada.

### 2.4 `availability_requests`
Auditoría futura de consultas: `service_id`, `source_id`,
`request_type` (`manual` · `api` · `cache` · `fallback`),
`status` (`pending` · `processing` · `completed` · `failed`),
`response_time` (ms), `error_message`, `created_at`.

### 2.5 `availability_policies`
Orden de búsqueda por organización y tipo de servicio:
`organization_id`, `service_kind` (`booking_service_kind`), `policy_name`,
`priority_order` (jsonb), `fallback_manual`, `cache_minutes`, `enabled`.

Ejemplo de `priority_order`:

```json
["api:hoteldo", "api:ratehawk", "manual:calendar", "manual:request"]
```

## 3. Índices

- `availability_sources`: owner, organización, proveedor, (organización, prioridad)
- `service_availability`: (service_id, availability_date), owner, organización
- `availability_cache`: query_hash, source, expires_at
- `availability_requests`: service, source, created_at desc
- `availability_policies`: owner, (organización, service_kind)

## 4. Seguridad (RLS)

RLS habilitado en las 5 tablas. `anon` sin ningún grant.

| Rol | Acceso |
| --- | --- |
| Administrador | CRUD completo en las 5 tablas |
| Operaciones | solo lectura |
| Agente | solo lectura |
| Proveedor | lectura de orígenes y políticas de su organización; **CRUD completo únicamente de `service_availability` de su organización** |
| Anónimo | sin acceso |

La pertenencia del proveedor se valida vía `providers.organization_id = <tabla>.organization_id AND providers.user_id = auth.uid()`, igual que en el motor tarifario.

## 5. Fuera de alcance en esta fase

- Motor de resolución / fallback en cascada
- Conectores a APIs (HotelDO, Ratehawk, etc.)
- Cálculo o descuento de cupos
- UI de calendario
- Integración con reservas o cotizaciones

## 6. Capa de dominio

`src/lib/availability.ts` — tipos, etiquetas en español y `DEFAULT_PRIORITY_ORDER`
de referencia. Sin llamadas a la base de datos.
