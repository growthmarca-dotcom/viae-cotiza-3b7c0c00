# 14 — Motor de Reglas Tarifarias por Producto (v1.10.1 Fase A)

> Estado: **estructura únicamente**. No hay cálculo de precios, no hay
> integración con mayoristas, no hay cotización automática, no hay motor de
> búsqueda, no hay disponibilidad ni reservas.

## 1. Propósito

Permitir que cada producto del **Inventario Global** (`products`) pueda declarar
cómo se tarifa: por pasajero, por composición del grupo, por temporada, con
suplementos, descuentos, porcentajes o montos fijos.

Este motor **no reemplaza** el módulo de cotizaciones actual. Es la capa de
reglas que más adelante será consumida por:

- Cotizaciones
- Orquestador multiproveedor
- Marketplace
- White Label

## 2. Modelo de datos

```
products ──┬── product_variants
           │
           └── product_pricing_profiles (perfil tarifario)
                     ├── pricing_rules              (reglas de precio)
                     ├── passenger_pricing_groups   (composición del grupo)
                     └── pricing_conditions         (condiciones comerciales)
```

### 2.1 `product_pricing_profiles`

Perfil tarifario asociado a un producto y, opcionalmente, a una variante
concreta (por ejemplo, una habitación o un horario de excursión).

| Campo | Notas |
|---|---|
| `product_id` | obligatorio → `products` |
| `product_variant_id` | opcional → `product_variants` |
| `name`, `currency` | `currency` por defecto `ARS` |
| `status` | `draft`, `active`, `inactive`, `archived` |
| `valid_from`, `valid_until` | vigencia del perfil |
| `priority` | menor número = evaluación más temprana (default 100) |
| `metadata` | extensible, `jsonb` |

### 2.2 `pricing_rules`

| Grupo | Campos |
|---|---|
| Tipo | `rule_type`: `passenger`, `group`, `seasonal`, `fixed`, `percentage`, `supplement`, `discount` |
| Pasajero | `passenger_type`: `adult`, `child`, `infant`, `senior`, `any` |
| Condiciones | `min_age`, `max_age`, `min_quantity`, `max_quantity`, `season_code` |
| Cálculo | `calculation_type`: `fixed_amount`, `percentage`, `per_unit`; `value`, `currency` |
| Control | `priority`, `active`, `notes` |

### 2.3 `passenger_pricing_groups`

Define composiciones válidas del grupo: `adult_min/max`, `child_min/max`,
`infant_min/max`.

Ejemplos:

- **Familia**: 2 adultos + 2 niños
- **Grupo**: 10 pasajeros (`adult_min = 10`)

### 2.4 `pricing_conditions`

Condiciones futuras, sin evaluación todavía:
`day_of_week`, `destination`, `booking_window`, `nationality`, `partner`,
`organization`, con operador `equals`, `between`, `greater_than`, `less_than` y
`value jsonb`.

## 3. Relación con otros módulos

### 3.1 Con `products` (Inventario Global)

El perfil siempre cuelga de un producto. Si el producto se elimina, sus perfiles
y reglas se eliminan en cascada. El inventario responde *qué se vende*; este
motor responde *a qué precio podría venderse*.

### 3.2 Relación futura con Disponibilidad

`service_availability` y `availability_cache` responden *si hay lugar*. El motor
tarifario responderá *cuánto cuesta*. La composición futura será:

```
disponibilidad (cupo) + reglas tarifarias (precio) → oferta cotizable
```

No hay ninguna dependencia técnica todavía: ambas capas son independientes.

### 3.3 Relación con pasajeros

`booking_passengers` ya distingue `passenger_type` y edad dinámica. Cuando se
active el cálculo, la edad del pasajero en la fecha de viaje se cruzará con
`min_age`/`max_age` y la cantidad de pasajeros con `min_quantity`/`max_quantity`
y con `passenger_pricing_groups`.

### 3.4 Relación con Comisiones y Acuerdos

Las comisiones (`commissions`, `agreement_rules`) se aplican sobre importes ya
resueltos. El motor tarifario se ubica **antes**: produce el precio de venta
base sobre el que luego opera el motor de acuerdos.

## 4. Ejemplos de uso

### Hotel (alojamiento)

- Perfil: *Tarifa 2026 — Habitación Doble* (variante = Doble, `ARS`)
- Regla 1: `passenger` / `adult` / `per_unit` / 85.000 (por noche y adulto)
- Regla 2: `passenger` / `child` / `percentage` / 50 (`min_age` 2, `max_age` 11)
- Regla 3: `passenger` / `infant` / `fixed_amount` / 0 (`max_age` 1)
- Regla 4: `seasonal` / `season_code` = `HIGH` / `percentage` / 25 (suplemento)
- Condición: `booking_window` / `greater_than` / `{"days": 30}` (early booking)

### Excursión

- Perfil: *Excursión Cerro — Regular*
- Regla 1: `passenger` / `adult` / `fixed_amount` / 42.000
- Regla 2: `group` / `any` / `percentage` / -10 con `min_quantity` 10
- Grupo: *Grupo* → `adult_min` 10
- Condición: `day_of_week` / `equals` / `{"days": [6, 0]}`

### Traslado

- Perfil: *Traslado Aeropuerto — Van*
- Regla 1: `fixed` / `any` / `fixed_amount` / 60.000 (precio por servicio)
- Regla 2: `supplement` / `any` / `fixed_amount` / 15.000 (nocturno)
- Condición: `destination` / `equals` / `{"city": "Bariloche"}`

## 5. Seguridad (RLS)

Todas las tablas tienen RLS habilitado y `anon` sin acceso.

| Rol | Perfiles y reglas |
|---|---|
| Admin | CRUD completo |
| Dueño del producto (`products.user_id`) | CRUD de sus productos |
| Proveedor (de la organización del producto) | CRUD de sus productos |
| Operaciones | solo lectura |
| Agente | solo lectura |
| Cliente | sin acceso |
| Anon | sin acceso |

La gestión se resuelve con `can_manage_product(product_id)` y el helper nuevo
`can_manage_pricing_profile(profile_id)` (`SECURITY DEFINER`, `search_path`
fijo), evitando recursión de políticas.

## 6. Pendiente (fases siguientes)

- **Fase B**: motor de resolución (`resolve_product_price`) con score de
  especificidad, similar a `resolve_agreement`.
- **Fase C**: simulación de precio solo lectura en la ficha de producto.
- **Fase D**: consumo desde cotizaciones y desde el orquestador.
- **Fase E**: cruce con disponibilidad y con temporadas de `tariff_seasons`.
- **Fase F**: exposición al marketplace y white label.

## 7. Impacto en módulos existentes

Ninguno. No se modificaron `bookings`, `quotations`, `booking_services`,
`commissions`, `transport_services`, las tablas de disponibilidad ni el
inventario existente. Solo se agregaron tablas, enums, índices, políticas y un
helper de permisos nuevos.
