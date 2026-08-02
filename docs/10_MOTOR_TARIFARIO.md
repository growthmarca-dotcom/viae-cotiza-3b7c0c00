# 10 — Motor Tarifario Multiproveedor (v1.9.6 Fase 0)

> **Estado: 🟡 solo estructura.** No calcula precios, no participa de reservas,
> cotizaciones, transporte ni comisiones. Ninguna funcionalidad existente cambió.

## Índice
1. [Objetivo](#objetivo)
2. [Entidades](#entidades)
3. [Relaciones](#relaciones)
4. [Enums](#enums)
5. [Seguridad y RLS](#seguridad-y-rls)
6. [Capa de dominio](#capa-de-dominio)
7. [Fuera de alcance](#fuera-de-alcance)

## Objetivo

Sentar la base de datos del futuro motor de tarifas: planes por servicio,
temporadas reutilizables, categorías de pasajero con edades configurables,
reglas de precio y condiciones extensibles. La resolución de precio llegará en
una fase posterior (en la base, con el criterio de `resolve_agreement`).

## Entidades

| Tabla | Contenido | Estado |
| --- | --- | --- |
| `passenger_categories` | Catálogo por propietario: código, etiqueta, `passenger_type`, `min_age`/`max_age`, `occupies_seat`, `is_free`, `requires_document`, orden | ✅ estructura |
| `tariff_seasons` | Temporada (`high`, `mid`, `low`, `special`) con `date_from`/`date_to` y prioridad | ✅ estructura |
| `tariff_plans` | Plan de un servicio: organización, proveedor, recurso, `service_kind`, `transport_service_type`, moneda, vigencia, prioridad, versión, estado | ✅ estructura |
| `tariff_rules` | Precio por plan + temporada + categoría + ocupación, con `min_quantity`/`max_quantity`, moneda, `price`, prioridad, vigencia y estado | ✅ estructura |
| `tariff_rule_conditions` | Condición de la regla: tipo, operador, valor numérico/texto/JSON, `is_restriction`, prioridad | ✅ estructura |

Todas incluyen `user_id` (propietario), `record_status` (archivado en lugar de
borrado), `created_at`/`updated_at` con trigger `tg_set_updated_at`.
`tariff_plans` y `tariff_rules` además auditan con `tg_audit`.

### Restricciones de integridad

- Rango de edades coherente en `passenger_categories`.
- `date_to >= date_from` en temporadas; `valid_until >= valid_from` en planes y reglas.
- `price >= 0`, `occupancy > 0`, `max_quantity >= min_quantity`.
- Operador de condición limitado a `eq, neq, gt, gte, lt, lte, between, in, not_in`.
- Código de categoría único por propietario.

## Relaciones

```text
organizations ──┬─> tariff_plans ──> tariff_rules ──> tariff_rule_conditions
providers ──────┘        │                 │
resources ───────────────┘                 ├──> tariff_seasons
                                           └──> passenger_categories
```

Las claves a `organizations`, `providers`, `resources`, `tariff_seasons` y
`passenger_categories` son `ON DELETE SET NULL`; las reglas y condiciones se
eliminan en cascada con su plan/regla padre.

## Enums

| Enum | Valores |
| --- | --- |
| `tariff_status` | draft, active, inactive, archived |
| `tariff_season_type` | high, mid, low, special |
| `tariff_condition_type` | nights, operating_days, min_advance_days, group_size, promotion, restriction, other |

## Seguridad y RLS

RLS habilitado en las 5 tablas; `anon` sin ningún privilegio.

| Rol | Acceso |
| --- | --- |
| `admin` | CRUD completo en todas las tablas |
| `operations` | Solo lectura (`is_operations`) |
| `agent` | Solo lectura de planes, reglas y condiciones `active` (plan activo) |
| `provider` | Gestiona únicamente las tarifas de la organización a la que está vinculado (`providers.user_id = auth.uid()`); lectura de temporadas de su organización |

Recuento verificado: `passenger_categories` 2 políticas, `tariff_seasons` 3,
`tariff_plans` 4, `tariff_rules` 4, `tariff_rule_conditions` 4.

## Capa de dominio

`src/lib/tariffs.ts` — solo tipos, etiquetas y el catálogo de referencia
`DEFAULT_PASSENGER_CATEGORIES` (Adulto, Niño, Infante, Senior, Residente,
Estudiante, Guía, Coordinador, Free, Chofer). No hace consultas ni cálculos.

## Fuera de alcance

- Resolución y cálculo de precios.
- UI de administración de tarifas.
- Integración con cotizaciones, reservas, transporte y comisiones.
- Siembra automática de categorías o temporadas.
