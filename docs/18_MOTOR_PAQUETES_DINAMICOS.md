# 18 — Motor de Paquetes Dinámicos (v1.10.5 Fase A)

> Estado: **estructura únicamente**. No genera paquetes con IA, no calcula el
> precio final, no reserva, no cobra y no publica nada al público.

## 1. Objetivo

Representar paquetes turísticos como **composición de productos existentes del
Inventario Global**, sin duplicar catálogo. La estructura debe soportar tres
modalidades:

| Modalidad | Cómo se representa |
| --- | --- |
| Paquete prediseñado | `package_templates` + `package_template_items` con `required = true` |
| Paquete generado por reglas | Items opcionales resueltos por `package_rules` |
| Paquete personalizado (futuro) | Plantilla base + selección libre dentro de `package_constraints` |

Un producto nunca se copia: siempre se referencia por `product_id` (y
opcionalmente `product_variant_id`).

## 2. Arquitectura de datos

| Tabla | Rol |
| --- | --- |
| `package_templates` | Plantilla: nombre, destino, duración, estado, prioridad |
| `package_template_items` | Productos incluidos, obligatorios u opcionales, con orden |
| `package_rules` | Reglas de composición (compatibilidad, exclusión, requisito, recomendación, mejora) |
| `package_constraints` | Restricciones duras (presupuesto, edad, duración, destino, disponibilidad, proveedor) |
| `package_versions` | Versionado con `snapshot` inmutable del contenido publicado |

### Enums

- `package_template_status`: `draft`, `active`, `inactive`, `archived`
- `package_item_component_type`: `accommodation`, `activity`, `excursion`, `transfer`, `rental`, `other`
- `package_rule_type`: `compatibility`, `exclusion`, `requirement`, `recommendation`, `upgrade`
- `package_constraint_type`: `budget`, `age`, `duration`, `destination`, `availability`, `provider`
- `package_constraint_operator`: `equals`, `greater_than`, `less_than`, `between`
- `package_version_status`: `draft`, `published`, `retired`

### Diagrama

```
package_templates
   ├── package_template_items ──► products / product_variants  (Inventario Global)
   ├── package_rules            (qué se puede combinar y cuándo)
   ├── package_constraints      (límites duros)
   └── package_versions         (snapshot publicado)
```

### Ejemplo de plantilla

```
Paquete Patagonia (7 días)
  Obligatorio:  Hotel (accommodation)
  Opcional:     Excursión Glaciar (excursion)
                Traslado aeropuerto (transfer)
                Trekking (activity)
```

## 3. Reglas y restricciones

`package_rules` es declarativa: `condition` describe cuándo aplica y `action`
qué efecto produce. Se evalúa por `priority` ascendente.

```
Si hay niños                → recommendation: agregar actividad familiar
Si duración > 5 días        → upgrade: permitir excursión adicional
Si hay traslado A           → exclusion: descartar traslado B
Si hay excursión de montaña → requirement: seguro obligatorio
```

`package_constraints` son **filtros duros**: si no se cumplen, la plantilla no
es aplicable. Ninguna regla ni recomendación puede sobrescribirlas.

```
budget      less_than    { "amount": 1500000, "currency": "ARS" }
age         greater_than { "years": 12 }
duration    between      { "min": 3, "max": 10 }
```

## 4. Versionado

`package_versions` guarda un `snapshot` jsonb con el contenido completo de la
plantilla al momento de publicar. Ciclo: `draft → published → retired`.
Un paquete ya cotizado debe poder reconstruirse tal como se ofreció, aunque la
plantilla haya cambiado después.

## 5. Ejemplos por perfil de viajero

### Familia (2 adultos + 2 menores, 7 días)

```
Hotel familiar (obligatorio, 1 habitación triple + 1 doble)
+ Traslado in/out (regla: requirement por destino con aeropuerto)
+ Excursión familiar (regla: recommendation activada por menores)
- Trekking de alta montaña (constraint: age greater_than 12)
```

### Pareja (2 adultos, 4 días)

```
Hotel boutique (obligatorio, 1 habitación doble)
+ Excursión privada (recommendation)
+ Cena romántica (upgrade)
- Actividad familiar (exclusion: sin menores)
```

### Grupo (12 pasajeros, 5 días)

```
Hotel con bloqueo de habitaciones (obligatorio)
+ Traslado en minibús (compatibility: vehículo según cantidad)
+ Excursión grupal con guía (requirement por cantidad)
- Traslado en auto privado (exclusion por capacidad)
```

### Corporativo (8 pasajeros, 3 días)

```
Hotel categoría business (obligatorio)
+ Traslados ejecutivos punto a punto (requirement)
+ Sala de reuniones (upgrade)
- Excursiones recreativas (exclusion por preference corporativa)
```

## 6. Relación con el Orquestador y demás motores

El motor de paquetes **consume**:

| Fuente | Aporte |
| --- | --- |
| `products` / `product_variants` (`docs/13`) | Qué se puede incluir |
| `pricing_rules` (`docs/14`) | Precio estimado de cada componente |
| `product_availability_profiles` (`docs/15`) | Si cada componente es ofrecible |
| `search_results` del Orquestador (`docs/16`) | Candidatos ya resueltos por fuente |

Y **entrega** candidatos de paquete que el motor de resolución
(`docs/17_ORQUESTADOR_RESOLUCION.md`) puntúa y materializa como
`package_compositions` + `package_components`.

```
package_templates (qué paquetes existen)
        │
        ▼
Orquestador Fase A ──► search_results (candidatos por componente)
        │
        ▼
Orquestador Fase B ──► scores + package_compositions (opciones concretas)
        │
        ▼
Cotización → Reserva  (flujos existentes, sin cambios)
```

Distinción clave: `package_templates` es el **catálogo de qué se puede armar**;
`package_compositions` es **una opción concreta armada para una búsqueda**.

## 7. Seguridad (RLS)

| Rol | Acceso |
| --- | --- |
| Administrador | CRUD completo sobre las 5 tablas |
| Dueño de la plantilla | Gestiona sus propios paquetes y todo lo dependiente |
| Operaciones | Lectura |
| Agentes | Lectura de paquetes disponibles |
| Proveedor | Solo lectura de plantillas donde participa alguno de sus productos |
| Cliente | Sin acceso |
| Anónimo | Sin acceso (sin GRANT a `anon`) |

Funciones auxiliares `SECURITY DEFINER`:

- `provider_in_package_template(uuid)` — detecta participación vía `can_manage_product`
- `can_read_package_template(uuid)`
- `can_manage_package_template(uuid)`

## 8. Fuera de alcance en esta fase

Generación automática con IA, cálculo final de precio, reservas, pagos y
publicación pública.

## 9. Confirmación de impacto

No se modificaron `bookings`, `quotations`, `booking_services`,
`transport_services`, `commissions`, ni las tablas de inventario, tarifas,
disponibilidad, itinerarios o del Expediente 360°. Solo se agregaron tablas,
enums, funciones auxiliares y políticas nuevas, más los tipos en
`src/lib/packages.ts`.
