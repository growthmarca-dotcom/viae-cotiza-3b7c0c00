# 12 — Motor de Itinerarios (Fase 0 · solo estructura)

Estado: **infraestructura creada, sin lógica**. No genera itinerarios, no calcula
precios, no consulta disponibilidad, no llama APIs. No se crearon RPC, triggers,
algoritmos ni integraciones. Ningún flujo existente (reservas, transporte,
disponibilidad, motor tarifario, comisiones, Expediente 360°) fue modificado.

## 1. Objetivo

Contar con un catálogo de **plantillas de viaje reutilizables** (city breaks,
circuitos, excursiones, paquetes, armados a medida), sus reglas de construcción y
su versionado, más un registro de **solicitudes de itinerario** provenientes de
distintos canales (CRM, widget, API, manual, marca blanca).

En fases posteriores el motor combinará plantilla + reglas + disponibilidad +
tarifas para producir un itinerario cotizable. Esta fase solo fija el modelo.

## 2. Modelo

### 2.1 `itinerary_templates`
`owner_id`, `organization_id` → `organizations`, `code` (único por owner),
`name`, `description`, `destination`, `itinerary_type`
(`city_break` · `circuit` · `excursion` · `package` · `custom`),
`duration_days`, `duration_nights`, `active`, `created_at`, `updated_at`.

### 2.2 `itinerary_template_items`
Servicios que componen la plantilla: `template_id` (CASCADE), `sequence`,
`day_number`, `service_kind` (`hotel` · `transfer` · `activity` · `car_rental` ·
`insurance` · `flight` · `meal` · `custom`), `title`, `mandatory`, `optional`, `notes`.

Los campos `mandatory` y `optional` se mantienen separados tal como fueron
especificados: permiten distinguir el bloque base del itinerario de los
complementos ofrecibles.

### 2.3 `itinerary_rules`
Reglas de construcción por plantilla: `minimum_passengers`, `maximum_passengers`,
`minimum_nights`, `maximum_nights`, `compatible_destinations` (`text[]`),
`compatible_seasons` (`uuid[]`, referirá a `tariff_seasons` cuando el motor se
active), `priority`, `active`.

Checks: máximos ≥ mínimos en pasajeros y noches.

### 2.4 `itinerary_versions`
Versionado: `template_id`, `version` (único por plantilla), `published`,
`snapshot` (jsonb, para congelar la estructura publicada), `created_by`, `created_at`.

### 2.5 `itinerary_requests`
Registro de futuras construcciones, **sin resultados todavía**:
`organization_id`, `destination`, `travel_start`, `travel_end`, `adults`,
`children`, `infants`, `request_source` (`crm` · `widget` · `api` · `manual` ·
`whitelabel`), `status` (`pending` · `processing` · `completed` · `cancelled`),
`notes`, `created_at`.

## 3. Relaciones

```
organizations ──< itinerary_templates ──< itinerary_template_items
                          │
                          ├──< itinerary_rules
                          └──< itinerary_versions

organizations ──< itinerary_requests
```

Índices: código único por owner, destino y estado activo en plantillas;
(template, día, secuencia) en ítems; (template, prioridad) en reglas;
(template, versión) único en versiones; organización, estado, destino y fecha en solicitudes.

## 4. Seguridad (RLS)

RLS habilitado en las 5 tablas. `anon` sin grants.

| Rol | Acceso |
| --- | --- |
| Administrador | CRUD completo |
| Operaciones | solo lectura |
| Agente | solo lectura |
| Proveedor | sin acceso |
| Anónimo | sin acceso |

En `itinerary_requests` el creador también puede leer sus propias solicitudes
(`owner_id = auth.uid()`).

## 5. Flujo futuro (no implementado)

1. Llega una `itinerary_request` desde CRM, widget, API o marca blanca.
2. El motor selecciona plantillas candidatas por destino, duración y pasajeros
   aplicando `itinerary_rules` por `priority`.
3. Para cada `itinerary_template_item` se resuelve disponibilidad a través del
   Motor de Disponibilidad (`docs/11`).
4. Se aplica el Motor Tarifario (`docs/10`) para precios por categoría de pasajero
   y temporada.
5. Se materializa una propuesta cotizable, con la versión publicada de la
   plantilla como referencia inmutable.
6. La solicitud pasa a `completed` y puede convertirse en cotización o reserva.

Nada de lo anterior existe todavía en código.

## 6. Capa de dominio

`src/lib/itineraries.ts` — tipos, etiquetas en español. Sin acceso a base de datos.
