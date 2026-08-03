# 15 — Conexión Inventario Global + Motor de Disponibilidad (v1.10.2 Fase A)

> Estado: **estructura únicamente**. No hay buscador, cotizador, bloqueo de
> inventario, APIs externas, sincronización OTA ni reservas.

## 1. Objetivo

Permitir que un producto del Inventario Global (`products`) —y opcionalmente
una variante concreta (`product_variants`)— tenga **disponibilidad propia**,
reutilizando el Motor de Disponibilidad ya existente sin alterar su lógica.

## 2. Arquitectura

```
products
   ↓
product_variants
   ↓
product_pricing_profiles          (v1.10.1 — cuánto cuesta)
   ↓
product_availability_profiles     (v1.10.2 — cuándo y cuánto hay)
   ├── product_availability_rules (calendario, bloqueos, mínimos)
   └── service_availability       (cupo concreto por fecha)
   ↓
Orquestador Multiproveedor        (🔵 futuro)
```

El Motor de Disponibilidad conserva sus 5 tablas
(`availability_sources`, `service_availability`, `availability_cache`,
`availability_requests`, `availability_policies`). La conexión es **aditiva**.

## 3. Cambios sobre el motor existente

### 3.1 `availability_sources`

| Columna nueva | Notas |
|---|---|
| `product_id` | opcional → `products` |
| `product_variant_id` | opcional → `product_variants` |

Las fuentes existentes (por organización/proveedor) siguen funcionando igual;
ambas columnas son nulas por defecto.

### 3.2 `service_availability`

| Columna nueva | Notas |
|---|---|
| `product_id`, `product_variant_id` | opcionales → catálogo |
| `availability_type` | `capacity`, `units`, `seats`, `rooms`, `vehicles`, `slots` (default `capacity`) |
| `available_quantity` | cupo en la unidad del `availability_type` |
| `minimum_quantity`, `maximum_quantity` | mínimos/máximos de venta |
| `booking_cutoff_hours` | horas de cierre de venta antes del inicio |
| `metadata` | `jsonb` extensible |

`service_id` pasa a ser opcional, con la restricción
`service_id IS NOT NULL OR product_id IS NOT NULL`: cada fila describe **o** un
servicio operativo **o** un producto del catálogo. Las filas existentes no
cambian y `available_units` / `reserved_units` mantienen su semántica actual.

## 4. Tablas nuevas

### 4.1 `product_availability_profiles`

Perfil de disponibilidad por producto (y variante opcional).

| Campo | Notas |
|---|---|
| `availability_mode` | `calendar` (calendario propio), `request` (a pedido), `external` (fuente externa) |
| `status` | `draft`, `active`, `inactive` |
| `priority` | menor número = evaluación más temprana (default 100) |
| `notes` | libre |

### 4.2 `product_availability_rules`

| Campo | Notas |
|---|---|
| `rule_type` | `weekly`, `date_range`, `blackout`, `minimum_stay`, `minimum_notice` |
| `day_of_week` | 0 = domingo … 6 = sábado (para `weekly`) |
| `start_date`, `end_date` | para `date_range` y `blackout` |
| `quantity` | cupo asociado a la regla |
| `status`, `metadata` | control y extensión |

## 5. Ejemplos

### Hotel

- Producto: *Hotel Los Andes* → variante *Habitación Doble*
- Perfil: *Calendario 2026*, `availability_mode = calendar`, `status = active`
- Regla 1: `date_range` 2026-06-01 → 2026-09-30, `quantity` 12
- Regla 2: `blackout` 2026-07-18 → 2026-07-25 (evento privado)
- Regla 3: `minimum_stay`, `quantity` 2 (dos noches mínimas)
- `service_availability`: `availability_type = rooms`, `available_quantity = 12`

### Excursión

- Producto: *Excursión Cerro* → variante *Salida 09:00*
- Perfil: *Salidas regulares*, `calendar`
- Regla: `weekly` `day_of_week` 6 y 0, `quantity` 18
- `service_availability`: `availability_type = seats`, `booking_cutoff_hours = 12`,
  `minimum_quantity = 2`

### Traslado

- Producto: *Traslado Aeropuerto* → variante *Van 12 pax*
- Perfil: *A pedido*, `availability_mode = request`
- Regla: `minimum_notice`, `quantity` 6 (seis horas de aviso)

### Rent a car

- Producto: *Alquiler SUV* → variante *Compacto automático*
- Perfil: *Flota Bariloche*, `calendar`
- Regla: `date_range` temporada alta, `quantity` 4
- `service_availability`: `availability_type = vehicles`, `available_quantity = 4`

## 6. Seguridad (RLS)

Todas las tablas nuevas tienen RLS habilitado y `anon` sin acceso.

| Rol | Perfiles y reglas de disponibilidad |
|---|---|
| Admin | CRUD completo |
| Dueño del producto (`products.user_id`) | CRUD de sus productos |
| Proveedor de la organización del producto | CRUD de sus productos |
| Operaciones | solo lectura |
| Agente | solo lectura |
| Cliente | sin acceso |
| Anon | sin acceso |

Se reutiliza `can_manage_product(product_id)` y se agrega
`can_manage_availability_profile(profile_id)` (`SECURITY DEFINER`,
`search_path` fijo) para evitar recursión de políticas. Las políticas de las
tablas preexistentes del Motor de Disponibilidad **no se modificaron**.

## 7. Pendiente (fases siguientes)

- **Fase B**: expansión de reglas a calendario efectivo (`resolve_availability`).
- **Fase C**: cruce disponibilidad + reglas tarifarias → oferta cotizable.
- **Fase D**: bloqueo/hold de cupo y confirmación.
- **Fase E**: conectores externos y sincronización OTA.
- **Fase F**: exposición al buscador, marketplace y white label.

## 8. Impacto en módulos existentes

Ninguno. No se modificaron `bookings`, `booking_services`,
`transport_services`, `commissions`, `quotations`, el Expediente 360° ni la
lógica existente de disponibilidad: solo se agregaron columnas opcionales,
tablas, enums, índices, políticas y un helper de permisos.
