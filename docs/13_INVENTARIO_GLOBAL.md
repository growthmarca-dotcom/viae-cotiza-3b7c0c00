# 13 — Inventario Global (v1.10.0 · Fase A · solo estructura)

Estado: **infraestructura creada, sin lógica comercial**. No hay precios,
temporadas, cupos, calendarios, búsqueda, APIs externas, armado automático de
paquetes ni reservas automáticas. No se modificó `bookings`, `booking_services`,
`transport_services`, `resources`, el motor tarifario, el de disponibilidad, el
de comisiones ni el Expediente 360°.

## 1. Principio de separación

| Concepto | Responde a | Tablas |
| --- | --- | --- |
| **Inventario** | ¿Qué se comercializa? | `products`, `product_variants`, `product_attributes`, `product_media`, `product_categories` |
| **Recursos** | ¿Con qué se presta? | `resources`, `resource_extras`, `transport_services` |

Un hotel, una habitación, una excursión, un traslado vendible, un paquete o un
rent a car son **inventario**. Un vehículo, un chofer, un equipo o una unidad
operativa son **recursos**. El Inventario Global **no reemplaza** `resources`:
son capas complementarias y en fases futuras se vincularán (un producto vendible
se presta con uno o más recursos).

## 2. Modelo

### 2.1 `products`
Catálogo comercial central.

`user_id` (tenant, default `auth.uid()`), `organization_id` → `organizations`
(NOT NULL, `ON DELETE CASCADE`), `category`
(`accommodation` · `activity` · `excursion` · `transfer` · `rental` · `package` · `other`),
`name`, `description`, `short_description`, `status`
(`draft` · `active` · `inactive` · `archived`), ubicación (`country`, `state`,
`city`, `latitude`, `longitude`), `metadata jsonb`, `created_at`, `updated_at`.

Índices: `user_id`, `organization_id`, `category`, `status`, `(country, state, city)`.

### 2.2 `product_variants`
Versiones vendibles del mismo producto: habitación doble / suite; excursión
regular / premium / privada.

`product_id` (CASCADE), `name`, `description`, `capacity_min`, `capacity_max`,
`duration_minutes`, `status`, `metadata`, timestamps. Restricciones: capacidades
no negativas y `capacity_max >= capacity_min`; duración no negativa.

### 2.3 `product_categories`
Catálogo configurable de categorías: `code` (único), `name`, `description`,
`active`, timestamps. Se sembraron las 7 categorías base del enum.

### 2.4 `product_attributes`
Características dinámicas: `product_id` (CASCADE), `attribute_key`,
`attribute_value`. Único por `(product_id, attribute_key)`.

Ejemplos: hotel → `desayuno_incluido`, `spa`; excursión → `dificultad`,
`idioma`, `edad_minima`.

### 2.5 `product_media`
Contenido comercial: `product_id` (CASCADE), `type` (`image` · `video` ·
`document`), `url`, `title`, `order_index`, `created_at`.

## 3. Seguridad (RLS)

Todas las tablas tienen RLS habilitado, `GRANT` explícito a `authenticated` y
`service_role`, y **ningún acceso para `anon`**.

| Perfil | products | variants / attributes / media | product_categories |
| --- | --- | --- | --- |
| Administrador | CRUD total | CRUD total | CRUD total |
| Organización propietaria (`user_id`) | gestiona lo propio | gestiona lo propio | lectura |
| Proveedor vinculado (`providers.organization_id`) | solo sus productos | solo los de sus productos | lectura |
| Operaciones | lectura | lectura | lectura |
| Agente | lectura | lectura | lectura |
| `anon` | sin acceso | sin acceso | sin acceso |

El acceso de escritura sobre las tablas hijas se resuelve con la función
`can_manage_product(uuid)` (`SECURITY DEFINER`, `search_path = public`,
ejecución revocada a `PUBLIC` y `anon`), que evita repetir la subconsulta de
propiedad en cada política.

`updated_at` se mantiene con `tg_set_updated_at` en todas las tablas que lo tienen.

## 4. Relaciones futuras (no implementadas)

`products` y `product_variants` serán la fuente única de verdad de "lo vendible"
para:

| Motor / capa | Uso previsto |
| --- | --- |
| Motor Tarifario | `tariff_plans` / `tariff_rules` por producto y variante |
| Motor de Disponibilidad | `service_availability` y cupos por variante |
| Motor de Itinerarios | `itinerary_template_items` referenciando productos reales |
| Motor de Búsqueda | índice de productos activos por destino y categoría |
| Orquestador Multiproveedor | resolución de producto + tarifa + disponibilidad |
| Marketplace | catálogo publicable entre organizaciones |
| White Label | vidriera por marca con branding propio |

```
                    ┌─────────────────────┐
                    │      products       │  (qué se vende)
                    │  + variants/attrs   │
                    └──────────┬──────────┘
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        Tarifario       Disponibilidad     Itinerarios
              └────────────────┼────────────────┘
                               ▼
                   Orquestador Multiproveedor
                               ▼
                Búsqueda · Marketplace · White Label
                               ▼
                   Cotización → Reserva → Operación
                               ▼
                        resources (con qué)
```

## 5. Fuera de alcance de esta fase

Precios, temporadas, cupos, calendarios, APIs externas, búsqueda, paquetes
automáticos y reservas automáticas. Tampoco se creó interfaz de usuario ni se
modificó ningún módulo existente.
