# 16 — Orquestador Multiproveedor (v1.10.3 Fase A)

> Estado: **estructura únicamente**. No ejecuta búsquedas reales, no reserva,
> no cobra, no bloquea cupos y no modifica ningún módulo existente.

## 1. Objetivo

El Orquestador Multiproveedor es la capa que **consulta** productos,
disponibilidad y tarifas de múltiples fuentes (propias y, en el futuro,
externas) para **generar opciones combinadas** que luego alimentarán
cotizaciones, itinerarios, marketplace y white label.

En esta fase se crea sólo la infraestructura de datos y trazabilidad:
cada búsqueda, cada ítem solicitado, cada resultado y cada componente de
paquete queda registrado y auditable.

Lo que el Orquestador **no** hace (ni ahora ni por diseño en esta capa):

- no crea reservas (`bookings`, `booking_services`)
- no procesa pagos
- no bloquea ni descuenta cupos
- no reemplaza el módulo de cotizaciones
- no ejecuta ranking ni recomendaciones con IA

## 2. Arquitectura de datos

| Tabla | Rol |
| --- | --- |
| `search_requests` | Solicitud de búsqueda: tipo, destino, fechas, pasajeros, estado |
| `search_items` | Elementos pedidos dentro de la solicitud (hotel + excursión + traslado) |
| `search_results` | Resultados encontrados por producto/variante/proveedor, con estado de disponibilidad y de precio |
| `search_result_components` | Desglose de un resultado tipo paquete en sus componentes |
| `provider_search_sources` | Registro de fuentes consultables por organización/proveedor, con prioridad |

### Enums

- `search_request_type`: `package`, `accommodation`, `activity`, `transfer`, `rental`, `custom`
- `search_request_status`: `pending`, `processing`, `completed`, `failed`, `expired`
- `search_service_category`: `accommodation`, `activity`, `transfer`, `rental`, `package`
- `search_availability_status`: `available`, `unavailable`, `request_only`, `unknown`
- `search_pricing_status`: `calculated`, `unavailable`, `pending`
- `search_source_type`: `internal`, `api`, `manual`
- `search_component_type`: `product`, `transfer`, `accommodation`, `activity`, `rental`

### Diagrama

```
search_requests
   ├── search_items                (qué se pidió)
   └── search_results              (qué se encontró)
           └── search_result_components   (armado del paquete)

provider_search_sources  ──► fuentes que el orquestador puede consultar
```

## 3. Reglas de arquitectura — orden de consulta

El Orquestador debe resolver siempre en este orden, sin saltear pasos:

```
1. Inventario propio            (products / product_variants)
2. Disponibilidad propia        (product_availability_* / service_availability)
3. Tarifas propias              (product_pricing_profiles / pricing_rules)
4. Integraciones externas       (futuro — availability_sources tipo api)
5. Solicitud manual             (si no existe disponibilidad resoluble)
```

Reglas invariantes:

- **Nunca reemplaza una fuente existente.** El orquestador consulta; los
  motores de inventario, disponibilidad y tarifas siguen siendo la única
  autoridad sobre sus datos.
- Un resultado sin precio calculable se marca `pricing_status = pending` o
  `unavailable`, nunca se inventa un monto.
- Un resultado sin verificación de cupo se marca
  `availability_status = unknown` o `request_only`.
- Cada resultado guarda su `source_type` para trazabilidad.

Constante espejo en código: `ORCHESTRATION_ORDER` en `src/lib/orchestrator.ts`.

## 4. Flujo futuro (Fase B en adelante)

```
Agente / widget / API
        │
        ▼
  search_requests (pending)
        │
        ▼
  search_items  ──►  Orquestador
                        │
        ┌───────────────┼────────────────┬─────────────────┐
        ▼               ▼                ▼                 ▼
   Inventario     Disponibilidad     Tarifario      Fuentes externas
        └───────────────┴────────────────┴─────────────────┘
                        │
                        ▼
              search_results (+ components)
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
  Cotización (quotations)        Itinerario (templates)
        │
        ▼
  Reserva (bookings)  ← única capa que confirma y bloquea
```

## 5. Relación con los demás motores

- **Inventario Global** (`docs/13_INVENTARIO_GLOBAL.md`): fuente de qué se
  puede vender. `search_results.product_id` / `product_variant_id`.
- **Motor Tarifario por Producto** (`docs/14_MOTOR_TARIFARIO_PRODUCTOS.md`):
  aporta el monto estimado; el orquestador sólo lo transporta.
- **Motor de Disponibilidad** (`docs/11_MOTOR_DISPONIBILIDAD.md` y
  `docs/15_INVENTARIO_DISPONIBILIDAD.md`): define si el producto puede
  ofrecerse en las fechas pedidas. El orquestador **lee**, nunca reserva.
- **Motor de Itinerarios** (`docs/12_MOTOR_ITINERARIOS.md`): una plantilla de
  itinerario podrá traducirse en `search_items` y un paquete resultante en
  `search_result_components`.
- **Reservas y Expediente 360°**: fuera del alcance del orquestador. Un
  resultado seleccionado se materializa manualmente en cotización o reserva
  mediante los flujos existentes, sin cambios en esos módulos.
- **Comisiones**: se calculan recién sobre servicios reservados; el
  orquestador no devenga nada.

## 6. Seguridad (RLS)

| Rol | Acceso |
| --- | --- |
| Administrador | CRUD completo sobre las 5 tablas |
| Operaciones | Lectura de solicitudes, ítems, resultados y fuentes |
| Agente | Lectura y gestión únicamente de sus propias solicitudes (`user_id = auth.uid()`) y de todo lo que dependa de ellas |
| Proveedor | Sólo resultados y componentes ligados a productos que gestiona (`can_manage_product`) |
| Cliente | Sin acceso |
| Anónimo | Sin acceso (sin GRANT a `anon`) |

Funciones auxiliares `SECURITY DEFINER` creadas para evitar recursión:

- `can_read_search_request(uuid)`
- `can_manage_search_request(uuid)`
- `can_read_search_result(uuid)`
- `can_manage_search_result(uuid)`

## 7. Fuera de alcance en esta fase

Motor de ranking, IA de recomendaciones, reservas automáticas, pagos, APIs
reales, bloqueo de cupos y marketplace público.

## 8. Confirmación de impacto

No se modificaron `bookings`, `booking_services`, `quotations`,
`transport_services`, `commissions`, ni las tablas de inventario,
tarifas y disponibilidad existentes. Sólo se agregaron tablas, enums,
funciones auxiliares y políticas nuevas, más los tipos en
`src/lib/orchestrator.ts`.
