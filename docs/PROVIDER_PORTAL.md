# Portal del Proveedor — ViaE

> Documentación del futuro **Portal del Proveedor** de ViaE Sales Hub: el espacio
> propio donde cada proveedor gestiona su catálogo, disponibilidad, tarifas,
> confirmaciones y liquidaciones, sin operar por WhatsApp ni planillas de Excel.
> Fecha de referencia: 2 de agosto de 2026 · Versión actual: v1.9.5.4
> Leyenda: ✅ implementado · 🟡 en desarrollo · 🔵 planificado (no existe código)

## Índice

1. [Visión del Portal](#1-visión-del-portal)
2. [Tipos de proveedor](#2-tipos-de-proveedor)
3. [Perfil del proveedor](#3-perfil-del-proveedor)
4. [Calendario y cupos](#4-calendario-y-cupos)
5. [Tarifas](#5-tarifas)
6. [Restricciones y blackouts](#6-restricciones-y-blackouts)
7. [Horarios](#7-horarios)
8. [Recursos](#8-recursos)
9. [Confirmaciones](#9-confirmaciones)
10. [Reservas](#10-reservas)
11. [Liquidaciones futuras](#11-liquidaciones-futuras)
12. [Interacción con motores](#12-interacción-con-motores)
13. [Flujo completo del proveedor](#13-flujo-completo-del-proveedor)
14. [Seguridad y aislamiento](#14-seguridad-y-aislamiento)
15. [Estado actual y dependencias](#15-estado-actual-y-dependencias)

---

## 1. Visión del Portal

### El problema

Hoy los proveedores (hoteles, excursiones, transportistas, rent a car, gastronomía,
guías) operan fuera del sistema. La agencia les carga los recursos, les pide
disponibilidad por WhatsApp y les confirma las reservas por mensaje. El proveedor no
tiene visibilidad de su calendario, no publica tarifas dentro del sistema y no sabe
cuánto se le debe hasta que alguien se lo cuenta.

### La solución

El **Portal del Proveedor** es un espacio propio dentro de ViaE donde cada proveedor:

- Gestiona su **perfil** y datos de contacto.
- Administra su **calendario** de cupos por fecha.
- Publica sus **tarifas** por temporada y composición de grupo.
- Define **restricciones**, blackouts y horarios de operación.
- Administra sus **recursos** (habitaciones, vehículos, guías, mesas).
- **Confirma o rechaza** reservas dentro del sistema.
- Ve sus **reservas** asignadas con estado y detalle.
- Consulta sus **liquidaciones** futuras por período.

> El proveedor deja de ser un pasivo que recibe mensajes y pasa a ser un actor activo
> que publica su oferta y confirma dentro del sistema.

### Estado actual

| Aspecto | Estado | Detalle |
| --- | --- | --- |
| Rol `provider` en el enum | ✅ | Existe en `app_role` |
| Acceso restringido por RLS | ✅ | El proveedor ve solo sus recursos y servicios |
| Portal propio | 🔵 | El proveedor entra a la app interna, no a un portal dedicado |
| Autogestión de catálogo | 🔵 | La agencia carga los recursos, no el proveedor |
| Calendario de cupos | 🔵 | `service_availability` existe sin autogestión |
| Publicación de tarifas | 🔵 | `tariff_plans` existe sin cálculo |
| Confirmaciones | 🔵 | El proveedor no confirma dentro del sistema |
| Liquidaciones | 🔵 | No existe cierre por período |
| Mensajería real | 🔵 | `communication_events` registra, no envía |

---

## 2. Tipos de proveedor

ViaE atiende seis tipos de proveedor turístico. Cada tipo tiene su propio catálogo de
recursos, su modelo de cupos y su lógica de tarifa. El Portal se adapta a cada tipo
mostrando solo los campos y vistas que corresponden.

### 2.1 Hotel

> Proveedor de alojamiento — vende noches de habitación.

| Aspecto | Detalle | Estado |
| --- | --- | --- |
| Recurso | Habitación (tipo: single, doble, triple, suite, familiar) | 🔵 |
| Unidad de cupo | Noches por tipo de habitación | 🔵 |
| Unidad de tarifa | Precio por noche + tipo de habitación | 🔵 |
| Temporada | Alta, media, baja, especial | 🟡 estructura |
| Suplementos | Single, media pensión, all inclusive, alta demanda | 🔵 |
| Check-in / check-out | Horario de entrada y salida | 🔵 |
| Estadía mínima | Noches mínimas por temporada | 🔵 |
| Blackouts | Fechas cerradas por mantenimiento o evento | 🔵 |
| Confirmación | Confirmar o rechazar reserva de habitación | 🔵 |

**Estructura de cupos del hotel:**

```text
  Hotel (organización)
    │
    ├── Habitación tipo Simple  →  cupo por noche (10 disponibles)
    ├── Habitación tipo Doble  →  cupo por noche (20 disponibles)
    ├── Habitación tipo Suite   →  cupo por noche (5 disponibles)
    └── Habitación tipo Familiar→  cupo por noche (8 disponibles)
         cada tipo tiene tarifa por temporada y categoría de pasajero
```

### 2.2 Excursiones

> Proveedor de actividades, tours y experiencias.

| Aspecto | Detalle | Estado |
| --- | --- | --- |
| Recurso | Excursión / tour / actividad | 🟡 |
| Unidad de cupo | Cupos por fecha y horario de salida | 🔵 |
| Unidad de tarifa | Precio por pasajero + categoría (adulto, niño, infante) | 🔵 |
| Temporada | Alta, media, baja | 🟡 estructura |
| Suplementos | Traslado al punto de partida, equipamiento, seguro | 🔵 |
| Horarios | Salidas a horarios fijos o variables | 🔵 |
| Edad mínima/máxima | Restricción por edad para ciertas excursiones | 🔵 |
| Blackouts | Fechas sin operación (clima, mantenimiento) | 🔵 |
| Confirmación | Confirmar cupo para la fecha y horario solicitados | 🔵 |

**Estructura de cupos de excursiones:**

```text
  Prestador de excursiones (organización)
    │
    ├── Excursión "City Tour"     →  cupos por fecha + horario de salida
    │     ├── 09:00 hs → 20 cupos
    │     └── 14:00 hs → 20 cupos
    ├── Excursión "Glaciar"      →  cupos por fecha (salida única 08:00)
    │     └── 50 cupos por fecha
    └── Excursión "Rafting"      →  cupos por fecha + horario + edad mínima
          ├── 10:00 hs → 12 cupos (mayores de 14 años)
          └── 14:00 hs → 12 cupos (mayores de 14 años)
```

### 2.3 Transporte

> Proveedor de transporte — transfers, circuitos, servicios privados.

| Aspecto | Detalle | Estado |
| --- | --- | --- |
| Recurso | Vehículo (auto, van, minibús, bus, lancha) | ✅ |
| Conductor | Vinculado al vehículo como recurso `person` | ✅ |
| Unidad de cupo | Vehículo disponible por fecha y horario | ✅ |
| Unidad de tarifa | Precio por servicio (tramo, hora, día) | ✅ |
| Temporada | Alta, media, baja | 🟡 estructura |
| Suplementos | Conductor adicional, chofer bilingüe, equipaje extra | 🔵 |
| Horarios | Salidas y llegadas por servicio | ✅ |
| Cobertura | Geográfica: provincias y localidades | ✅ |
| Blackouts | Vehículo en mantenimiento o no disponible | 🔵 |
| Confirmación | Confirmar asignación de vehículo y conductor | ✅ |

> **El transporte es el segmento más maduro.** Hoy el sistema ya tiene red de
> transporte, servicios por reserva, agenda, panel del conductor y economía de
> transporte. El portal del proveedor extiende esto con autogestión y confirmación.

**Estructura de cupos de transporte:**

```text
  Empresa de transporte (organización)
    │
    ├── Vehículo: Van Sprinter (12 pax)  →  disponible por fecha y horario
    │     └── Conductor: Juan Pérez (vinculado)
    ├── Vehículo: Minibús (20 pax)       →  disponible por fecha y horario
    │     └── Conductor: Carlos Gómez (vinculado)
    └── Vehículo: Auto sedan (4 pax)     →  disponible por fecha y horario
          └── Conductor: Ana López (vinculado)
```

### 2.4 Rent a Car

> Proveedor de alquiler de vehículos.

| Aspecto | Detalle | Estado |
| --- | --- | --- |
| Recurso | Vehículo de alquiler (subtipo `rental_car`) | ✅ |
| Unidad de cupo | Vehículo disponible por fecha (rango de alquiler) | 🔵 |
| Unidad de tarifa | Precio por día + tipo de vehículo | 🔵 |
| Temporada | Alta, media, baja | 🟡 estructura |
| Suplementos | Silla de bebé, GPS, conductor adicional, seguro premium | ✅ |
| Horarios | Horario de retiro y devolución | 🔵 |
| Cobertura | Geográfica de la rentadora | ✅ |
| Blackouts | Vehículo en taller o reservado | 🔵 |
| Datos técnicos | Marca, modelo, año, combustible, transmisión, pax | ✅ |
| Confirmación | Confirmar reserva de vehículo por rango de fechas | 🔵 |

> **El catálogo de recursos ya soporta rent a car** con subtipo `rental_car`, datos
> técnicos completos (marca, modelo, año, combustible, transmisión, pax), extras
> (silla, GPS, seguro) y cobertura geográfica. Falta el calendario de flota y la
> tarifa por día con temporada.

**Estructura de cupos de rent a car:**

```text
  Rentadora (organización)
    │
    ├── Auto económico (3 unidades)  →  cada unidad disponible por fecha
    │     ├── Unidad 1 → alquilada del 10 al 15  →  libre del 16 en adelante
    │     ├── Unidad 2 → disponible
    │     └── Unidad 3 → en taller (blackout)
    ├── SUV (2 unidades)              →  cada unidad disponible por fecha
    │     └── ...
    └── Camioneta (1 unidad)          →  disponible por fecha
```

### 2.5 Gastronomía

> Proveedor de restaurantes, catering y servicios de comida.

| Aspecto | Detalle | Estado |
| --- | --- | --- |
| Recurso | Restaurante / catering / servicio de comida | 🔵 |
| Unidad de cupo | Mesas o cubiertos por fecha y horario (turno) | 🔵 |
| Unidad de tarifa | Precio por cubierto / menú / evento | 🔵 |
| Temporada | Alta, media, baja | 🔵 |
| Suplementos | Menú especial, vino, catering a domicilio | 🔵 |
| Horarios | Turnos de almuerzo y cena (rangos horarios) | 🔵 |
| Blackouts | Días cerrados, feriados, eventos privados | 🔵 |
| Restricciones | Grupo mínimo/máximo, reserva con anticipación | 🔵 |
| Confirmación | Confirmar reserva de mesa o evento | 🔵 |

**Estructura de cupos de gastronomía:**

```text
  Restaurante (organización)
    │
    ├── Turno almuerzo (12:00–15:00)
    │     ├── Mesa 2 pax → 5 mesas disponibles
    │     ├── Mesa 4 pax → 8 mesas disponibles
    │     └── Mesa 8 pax → 3 mesas disponibles
    ├── Turno cena (20:00–23:30)
    │     ├── Mesa 2 pax → 6 mesas disponibles
    │     ├── Mesa 4 pax → 10 mesas disponibles
    │     └── Mesa 8 pax → 2 mesas disponibles
    └── Eventos privados → 1 sala (cupos por fecha)
```

### 2.6 Guías

> Proveedor de guías de turismo y coordinadores.

| Aspecto | Detalle | Estado |
| --- | --- | --- |
| Recurso | Guía (recurso `person` subtipo `guide`) | ✅ |
| Unidad de cupo | Guía disponible por fecha y horario | 🔵 |
| Unidad de tarifa | Precio por servicio / día / media jornada | 🔵 |
| Temporada | Alta, media, baja | 🟡 estructura |
| Suplementos | Idioma adicional, especialidad (avistaje, trekking) | ✅ |
| Idiomas | Lista de idiomas que domina | ✅ |
| Especialidades | Lista de especialidades del guía | ✅ |
| Horarios | Disponibilidad por día de la semana y franja horaria | 🔵 |
| Blackouts | Días no disponibles (descanso, licencia) | 🔵 |
| Confirmación | Confirmar asignación del guía a un servicio | ✅ |

> **El catálogo de recursos ya soporta guías** como `person` con subtipo `guide`,
> idiomas y especialidades. El portal extiende esto con calendario de disponibilidad
> y tarifa por servicio.

**Estructura de cupos de guías:**

```text
  Prestador de guías (organización o freelance)
    │
    ├── Guía: María González
    │     ├── Idiomas: español, inglés, portugués
    │     ├── Especialidades: city tour, historia, gastronomía
    │     └── Disponibilidad: por fecha y franja horaria
    │           ├── Lunes a viernes: 09:00–18:00
    │           └── Sábados: 09:00–13:00
    └── Guía: Roberto Silva
          ├── Idiomas: español, inglés
          ├── Especialidades: trekking, avistaje
          └── Disponibilidad: por fecha y franja horaria
```

### Matriz comparativa de tipos de proveedor

| Aspecto | Hotel | Excursiones | Transporte | Rent a Car | Gastronomía | Guías |
| --- | --- | --- | --- | --- | --- | --- |
| Recurso base | Habitación | Tour | Vehículo | Vehículo | Mesa | Persona |
| Unidad de cupo | Noche | Cupo por salida | Vehículo/día | Vehículo/día | Mesa/turno | Guía/día |
| Unidad de tarifa | Noche | Pasajero | Servicio | Día | Cubierto | Servicio |
| Temporada | ✅ | 🟡 | 🟡 | 🟡 | 🔵 | 🟡 |
| Suplementos | 🔵 | 🔵 | 🔵 | ✅ | 🔵 | ✅ |
| Horarios | Check-in/out | Salidas | Salidas/llegadas | Retiro/devolución | Turnos | Franja |
| Blackouts | 🔵 | 🔵 | 🔵 | 🔵 | 🔵 | 🔵 |
| Confirmación | 🔵 | 🔵 | ✅ | 🔵 | 🔵 | ✅ |
| Estado del recurso | 🔵 | 🟡 | ✅ | ✅ | 🔵 | ✅ |

> **Transporte y guías son los segmentos más cercanos al portal** porque sus recursos
> ya existen en el catálogo con datos completos. Los demás requieren nuevos modelos
> de recurso (habitación, mesa) y nuevos modelos de cupo.

---

## 3. Perfil del proveedor

### 3.1 Qué gestiona el proveedor en su perfil

El perfil del proveedor es la ficha de la organización que representa. Hoy la gestión
está en `/organizations/$id` (acceso del admin); el portal la lleva al proveedor en
modo edición de sus propios datos.

| Campo | Estado | Detalle |
| --- | --- | --- |
| Nombre comercial | ✅ | En `organizations.name` |
| Tipo de proveedor | ✅ | Hotel, excursión, transporte, etc. |
| Datos de contacto | ✅ | Email, teléfono, dirección |
| Geografía | ✅ | Provincia, localidad (cobertura) |
| Logo / imagen | 🔵 | Imagen de la organización |
| Descripción | 🔵 | Texto descriptivo del proveedor |
| Categorización | ✅ | Clasificación y subtipos |
| Datos técnicos | ✅ | Según tipo (estrellas, capacidad, flota) |
| Usuarios asociados | 🔵 | `provider_users` vinculado a la organización |
| Evaluación interna | 🟡 | `provider_evaluations` (la hace la agencia) |
| Estado de la cuenta | ✅ | `account_status` (pending → approved) |

### 3.2 Reglas del perfil

1. El proveedor **edita** sus datos de contacto y descripción.
2. El proveedor **no edita** su evaluación interna (la hace la agencia).
3. El proveedor **no ve** datos de otras organizaciones.
4. El cambio de datos críticos (nombre, tipo) puede requerir **aprobación** de la
   agencia para evitar abuso del marketplace.
5. El perfil es la **cara pública** del proveedor en el marketplace.

---

## 4. Calendario y cupos

### 4.1 Qué es el calendario del proveedor

El calendario es la vista principal del portal: una grilla de fechas donde el
proveedor ve y gestiona la disponibilidad de cada recurso por día.

### 4.2 Estado actual

| Aspecto | Estado | Detalle |
| --- | --- | --- |
| `service_availability` | ✅ | Tabla creada (cupos por fecha) |
| `availability_sources` | ✅ | Orígenes (manual, api, cache, external) |
| `availability_cache` | ✅ | Cache de búsquedas |
| `availability_requests` | ✅ | Log de consultas |
| `availability_policies` | ✅ | Políticas de fallback y cache |
| Calendario visual | 🔵 | No existe UI de calendario para el proveedor |
| Autogestión de cupos | 🔵 | El proveedor no carga cupos |
| Sincronización con APIs | 🔵 | No hay conectores externos |

### 4.3 Visión del calendario

| Capacidad | Estado | Detalle |
| --- | --- | --- |
| Vista mensual por recurso | 🔵 | Grilla de fechas con cupos por recurso |
| Edición de cupo por día | 🔵 | El proveedor fija cupos disponibles por fecha |
| Cupos por horario | 🔵 | Para excursiones y gastronomía con turnos |
| Cupos por rango de fechas | 🔵 | Para rent a car (alquiler de varios días) |
| Blackouts por rango | 🔵 | Marcar fechas como no disponibles |
| Bloqueos temporales | 🔵 | Reservar cupos sin confirmar (hold) |
| Sincronización API | 🔵 | Traer cupos de un sistema externo (channel manager) |
| Alertas de cupo agotado | 🔵 | Notificar cuando un cupo llega a cero |

### 4.4 Modelo de cupos por tipo de proveedor

```text
  HOTEL               EXCURSIONES          TRANSPORTE          RENT A CAR          GASTRONOMÍA         GUÍAS
  ─────────────────────────────────────────────────────────────────────────────────────────────────
  Cupo por noche      Cupo por salida      Vehículo por día    Vehículo por día    Mesa por turno      Guía por día
  (tipo hab.)         (fecha + horario)    (fecha + horario)   (rango de fechas)   (fecha + turno)     (fecha + franja)
       │                   │                    │                   │                   │                   │
       ▼                   ▼                    ▼                   ▼                   ▼                   ▼
  service_availability (tabla unificada — service_id apunta al recurso)
  + availability_policies (reglas de fallback y cache por organización)
```

> Todos los tipos de proveedor escriben en la misma tabla `service_availability`,
  pero la **unidad de cupo** cambia según el tipo. El portal lo resuelve con una
  vista distinta por tipo de proveedor.

---

## 5. Tarifas

### 5.1 Estado actual

| Aspecto | Estado | Detalle |
| --- | --- | --- |
| `tariff_plans` | ✅ | Estructura creada (plan por recurso/servicio) |
| `tariff_seasons` | ✅ | Temporadas con rango y prioridad |
| `tariff_rules` | ✅ | Precio por plan + temporada + categoría |
| `tariff_rule_conditions` | ✅ | Condiciones (noches, anticipación, grupo) |
| `passenger_categories` | ✅ | Adulto, niño, infante, senior |
| Cálculo de tarifa | 🔵 | No existe el motor de cálculo |
| Publicación de tarifa por proveedor | 🔵 | El proveedor no publica tarifas |
| Tarifa por tipo de proveedor | 🔵 | Cada tipo tiene su modelo de precio |

### 5.2 Visión de tarifas por proveedor

| Tipo | Modelo de tarifa | Estado |
| --- | --- | --- |
| Hotel | Precio por noche + tipo de habitación + temporada | 🔵 |
| Excursiones | Precio por pasajero + categoría + temporada | 🔵 |
| Transporte | Precio por servicio (tramo/día) + temporada | 🔵 |
| Rent a Car | Precio por día + tipo de vehículo + temporada | 🔵 |
| Gastronomía | Precio por cubierto/menú + turno | 🔵 |
| Guías | Precio por servicio/día + idioma/especialidad | 🔵 |

### 5.3 Suplementos por tipo

| Tipo | Suplementos típicos | Estado |
| --- | --- | --- |
| Hotel | Single, media pensión, all inclusive, alta demanda | 🔵 |
| Excursiones | Traslado al punto de partida, equipamiento, seguro | 🔵 |
| Transporte | Chofer bilingüe, equipaje extra, paradas adicionales | 🔵 |
| Rent a Car | Silla de bebé, GPS, conductor adicional, seguro premium | ✅ |
| Gastronomía | Menú especial, vino, catering a domicilio | 🔵 |
| Guías | Idioma adicional, especialidad (avistaje, trekking) | ✅ |

### 5.4 Reglas de tarifa

1. La tarifa se publica como **precio de venta** — el costo y margen del proveedor
   nunca se publican al marketplace.
2. La tarifa lleva **snapshot inmutable** al aplicarse a una reserva: no se recalcula
   retroactivamente.
3. La tarifa se publica por **temporada** (alta, media, baja, especial) con rango de
   fechas y prioridad.
4. Los suplementos son **aditivos**: se suman al precio base.
5. La tarifa puede tener **vigencia** (fecha de inicio y fin) y **estado** (borrador,
   activo, inactivo, archivado).

---

## 6. Restricciones y blackouts

### 6.1 Restricciones

Las restricciones son reglas que bloquean o condicionan la venta de un servicio sin
modificar su precio.

| Restricción | Aplica a | Estado | Detalle |
| --- | --- | --- | --- |
| Estadía mínima | Hotel, Rent a Car | 🔵 | Noches mínimas por temporada |
| Estadía máxima | Hotel, Rent a Car | 🔵 | Noches máximas por temporada |
| Grupo mínimo | Excursiones, Gastronomía | 🔵 | Pasajeros/mesas mínimas |
| Grupo máximo | Excursiones, Transporte, Guías | 🔵 | Capacidad máxima |
| Edad mínima/máxima | Excursiones | 🔵 | Restricción por edad |
| Anticipación mínima | Todos | 🔵 | Días de anticipación para reservar |
| Día de operación | Todos | 🟡 | Días de la semana habilitados |
| Check-in / check-out | Hotel | 🔵 | Horario de entrada y salida |
| Llegada / salida obligatoria | Transporte, Rent a Car | 🔵 | Punto fijo de retiro/devolución |

### 6.2 Blackouts

Los blackouts son fechas en las que un recurso o servicio **no está disponible**, sin
excepción.

| Blackout | Aplica a | Estado | Detalle |
| --- | --- | --- | --- |
| Mantenimiento | Hotel, Transporte, Rent a Car | 🔵 | Recurso en reparación |
| Cierre por feriado | Gastronomía, Excursiones | 🔵 | Días sin operación |
| Clima adverso | Excursiones, Transporte | 🔵 | Suspensión por condiciones |
| Evento privado | Gastronomía, Hotel | 🔵 | Sala o restaurante reservado |
| Licencia del guía | Guías | 🔵 | Guía de vacaciones o licencia |
| Vehículo en taller | Transporte, Rent a Car | 🔵 | Unidad en mantenimiento |
| Sin venta | Todos | 🔵 | El proveedor cierra ventas temporalmente |

### 6.3 Modelo de restricciones y blackouts

```text
  Recurso / Servicio
    │
    ├── Restricciones (reglas condicionales)
    │     ├── estadía mínima: 2 noches en alta temporada
    │     ├── grupo mínimo: 4 pax para excursión privada
    │     ├── anticipación: 7 días antes del viaje
    │     └── día de operación: lunes a viernes
    │
    └── Blackouts (fechas bloqueadas)
          ├── 2026-08-15: mantenimiento (sin disponibilidad)
          ├── 2026-12-24 al 2026-12-26: cerrado por feriado
          └── 2027-01-01: evento privado
```

> Las restricciones **condicionan** la venta (puedes reservar si cumples la regla);
> los blackouts **bloquean** la venta (no se puede reservar bajo ninguna condición).

---

## 7. Horarios

### 7.1 Horarios por tipo de proveedor

| Tipo | Modelo de horario | Estado | Detalle |
| --- | --- | --- | --- |
| Hotel | Check-in / check-out | 🔵 | Horario de entrada y salida por día |
| Excursiones | Salidas a horario fijo | 🔵 | Horarios de salida por excursión |
| Transporte | Salidas y llegadas por servicio | ✅ | Horario de partida y arribo |
| Rent a Car | Retiro y devolución | 🔵 | Horario de retiro y devolución del vehículo |
| Gastronomía | Turnos de almuerzo y cena | 🔵 | Rangos horarios por turno |
| Guías | Disponibilidad por franja | 🔵 | Días de la semana y franjas horarias |

### 7.2 Visión de horarios

| Capacidad | Estado | Detalle |
| --- | --- | --- |
| Horario de operación por recurso | 🔵 | Días y horas en que el recurso está activo |
| Horario por temporada | 🔵 | Horarios distintos en alta vs. baja temporada |
| Excepciones puntuales | 🔵 | Un día con horario distinto al habitual |
| Franjas horarias | 🔵 | Para guías y excursiones con salidas múltiples |
| Turnos | 🔵 | Para gastronomía (almuerzo, cena, evento) |

---

## 8. Recursos

### 8.1 Estado actual

| Aspecto | Estado | Detalle |
| --- | --- | --- |
| `resources` (catálogo) | ✅ | 77 columnas: clase, subtipo, vehículo, cobertura |
| `resource_extras` / `resource_extra_links` | ✅ | Extras y coberturas por recurso |
| Geografía | ✅ | Provincias y localidades de Argentina |
| Datos técnicos de vehículo | ✅ | Marca, modelo, año, combustible, pax |
| Autogestión del proveedor | 🔵 | La agencia carga los recursos |
| Nuevos tipos de recurso | 🔵 | Habitación, mesa (no existen en el catálogo) |

### 8.2 Recursos por tipo de proveedor

| Tipo | Recurso | Estado del catálogo | Detalle |
| --- | --- | --- | --- |
| Hotel | Habitación | 🔵 | Nuevo tipo: no existe como recurso |
| Excursiones | Excursión / tour | 🟡 | Existe como `company` subtipo `excursion_provider` |
| Transporte | Vehículo + conductor | ✅ | `vehicle` + `person` subtipo `driver` |
| Rent a Car | Vehículo de alquiler | ✅ | `vehicle` subtipo `rental_car` |
| Gastronomía | Mesa / salón | 🔵 | Nuevo tipo: no existe como recurso |
| Guías | Guía | ✅ | `person` subtipo `guide` con idiomas y especialidades |

### 8.3 Visión de recursos en el portal

| Capacidad | Estado | Detalle |
| --- | --- | --- |
| El proveedor crea sus recursos | 🔵 | Autogestión del catálogo |
| El proveedor edita sus recursos | 🔵 | Datos técnicos, fotos, descripción |
| El proveedor asocia extras | 🔵 | Suplementos y equipamiento por recurso |
| El proveedor asocia conductores/guías | ✅ | Vínculo `person` ↔ `vehicle` |
| Aprobación de la agencia | 🔵 | Recursos nuevos pueden requerir aprobación |
| Publicación al marketplace | 🔵 | Recurso visible para otras agencias |

> **El catálogo ya soporta transporte, rent a car y guías.** Los nuevos tipos de
> recurso (habitación de hotel, mesa de restaurante) requieren extensión del catálogo
> o un nuevo `resource_class`.

---

## 9. Confirmaciones

### 9.1 Estado actual

| Aspecto | Estado | Detalle |
| --- | --- | --- |
| Estados de servicio en reservas | ✅ | `booking_services` tiene estado de confirmación |
| Evento en timeline | ✅ | `provider_confirmed` existe en el enum de timeline |
| Confirmación por proveedor | 🔵 | El proveedor no confirma dentro del sistema |
| Rechazo con motivo | 🔵 | No existe rechazo formal |
| Sello temporal | 🔵 | No existe timestamp de confirmación del proveedor |

### 9.2 Visión de confirmaciones

| Capacidad | Estado | Detalle |
| --- | --- | --- |
| `service_confirmations` | 🔵 | Tabla con autor, motivo y sello temporal |
| Bandeja de solicitudes | 🔵 | El proveedor ve las reservas que le llegan |
| Confirmar | 🔵 | Aceptar la reserva del servicio |
| Rechazar con motivo | 🔵 | Rechazar con motivo obligatorio |
| Reasignar | 🔵 | Si rechaza, sugerir recurso alternativo |
| Plazo de respuesta | 🔵 | Tiempo límite para confirmar (ej. 24 hs) |
| Notificación automática | 🔵 | Avisar a la agencia al confirmar/rechazar |
| Evento en timeline | ✅ | El timeline ya soporta `provider_confirmed` |

### 9.3 Flujo de confirmación

```text
  Agencia crea reserva con servicio del proveedor
         │
         ▼
  Sistema notifica al proveedor (notificación + mensaje)
         │
         ▼
  Proveedor ve la solicitud en su bandeja
         │
         ├── CONFIRMAR ──► sistema registra confirmación + sello temporal
         │                   │
         │                   └── evento en timeline: provider_confirmed
         │                   └── notificación a la agencia: "proveedor confirmó"
         │
         ├── RECHAZAR   ──► sistema registra rechazo + motivo
         │                   │
         │                   └── evento en timeline: provider_rejected
         │                   └── notificación a la agencia: "proveedor rechazó"
         │                   └── agencia busca proveedor alternativo
         │
         └── NO RESPONDE ─► pasado el plazo, sistema marca como "sin respuesta"
                             │
                             └── alerta a la agencia: "proveedor no respondió"
```

---

## 10. Reservas

### 10.1 Estado actual

| Aspecto | Estado | Detalle |
| --- | --- | --- |
| `bookings` | ✅ | Reservas con estado comercial y operativo |
| `booking_services` | ✅ | Servicios incluidos en la reserva |
| `booking_service_economics` | ✅ | Economía por servicio (inmutable) |
| `booking_timeline` | ✅ | Expediente narrativo append-only |
| Vista del proveedor | 🔵 | El proveedor no ve las reservas filtradas |
| Filtrado por proveedor | 🔵 | El proveedor ve solo sus servicios |

### 10.2 Visión de reservas en el portal

| Capacidad | Estado | Detalle |
| --- | --- | --- |
| Bandeja de reservas | 🔵 | El proveedor ve las reservas que incluyen sus servicios |
| Filtro por estado | 🔵 | Pendientes, confirmadas, rechazadas, operando, finalizadas |
| Filtro por fecha | 🔵 | Por fecha de servicio o fecha de creación |
| Detalle del servicio | 🔵 | Fecha, horario, cantidad de pasajeros, recurso asignado |
| Sin datos sensibles | 🔵 | El proveedor no ve costos, márgenes ni datos del cliente final |
| Estado del servicio | 🔵 | Confirmar/rechazar desde la bandeja |
| Timeline del servicio | 🔵 | Historial de eventos del servicio (no del expediente completo) |

### 10.3 Qué ve y qué no ve el proveedor

| Dato | El proveedor ve | Estado | Motivo |
| --- | --- | --- | --- |
| Número de reserva | ✅ | 🔵 | Referencia operativa |
| Fecha del servicio | ✅ | 🔵 | Operación |
| Cantidad de pasajeros | ✅ | 🔵 | Operación |
| Recurso asignado | ✅ | 🔵 | Operación |
| Estado del servicio | ✅ | 🔵 | Confirmación |
| Nombre del cliente final | ❌ | 🔵 | Privacidad del cliente |
| Datos de contacto del cliente | ❌ | 🔵 | Privacidad |
| Costo del servicio | ❌ | 🔵 | Sensible (es el costo del proveedor) |
| Margen de la agencia | ❌ | 🔵 | Sensible |
| Comisión | ❌ | 🔵 | Sensible |
| Precio de venta al cliente | ❌ | 🔵 | Sensible para la agencia |

> El proveedor ve lo necesario para **operar**, no para **vender**. No ve al cliente
> final ni los precios de venta: esos son datos de la agencia.

---

## 11. Liquidaciones futuras

### 11.1 Estado actual

| Aspecto | Estado | Detalle |
| --- | --- | --- |
| `commissions` | ✅ | Tabla creada, vacía por diseño |
| `commission_history` | ✅ | Preparada para el devengo |
| Devengo real | 🔵 | No existe `accrue_commission()` |
| Liquidaciones | 🔵 | No existe `settlements` |
| Estados de cobro/liquidación | 🟡 | Solo en transporte |
| Vista del proveedor | 🔵 | No existe |

### 11.2 Visión de liquidaciones en el portal

| Capacidad | Estado | Detalle |
| --- | --- | --- |
| `settlements` por período y contraparte | 🔵 | Cierre mensual del proveedor |
| `settlement_items` | 🔵 | Comisiones y servicios incluidos |
| `settlement_payments` | 🔵 | Pagos realizados/recibidos |
| Vista por período | 🔵 | El proveedor ve sus liquidaciones por mes |
| Totales por moneda | 🔵 | ARS y USD separados |
| Estado de pago | 🔵 | Pendiente, pagado, parcial, conciliado |
| Detalle por servicio | 🔵 | Qué servicios entraron en la liquidación |
| Comprobante | 🔵 | Generación de comprobante de liquidación |

### 11.3 Flujo de liquidación

```text
  Servicio confirmado y operado
         │
         ▼
  Devengo de comisión (accrue_commission)
         │
         ▼
  Comisión registrada en commissions (idempotente)
         │
         ▼
  Cierre mensual (settlement)
         │
         ├── total ARS: $X
         ├── total USD: $Y
         └── estado: pendiente de pago
         │
         ▼
  Pago al proveedor (settlement_payment)
         │
         ├── monto pagado
         ├── moneda
         ├── fecha
         └── estado: pagado / parcial / conciliado
         │
         ▼
  Conciliación (payment_reconciliation)
         │
         └── vínculo entre el cobro registrado y el movimiento esperado
```

### 11.4 Reglas de liquidación

1. La liquidación es **por período** (mensual) y **por contraparte** (un proveedor).
2. Una liquidación **no suma monedas distintas**: ARS y USD van en columnas separadas.
3. Una liquidación **cerrada es un hecho contable**: si una reserva se cancela
   después, se genera un **contra-asiento**, no se modifica la liquidación.
4. El proveedor ve sus liquidaciones pero **no las de otros proveedores**.
5. El proveedor ve el monto que se le debe, **no el margen** de la agencia.

---

## 12. Interacción con motores

El portal del proveedor no es un módulo aislado: es la **interfaz** a través de la cual
el proveedor interactúa con los cinco motores del core de ViaE.

### 12.1 Motor de Disponibilidad

El proveedor **escribe** en el motor de disponibilidad; las agencias **leen**.

| Interacción | Quién actúa | Estado | Detalle |
| --- | --- | --- | --- |
| Cargar cupos por fecha | Proveedor (escribe) | 🔵 | `service_availability` por recurso y fecha |
| Cargar cupos por horario | Proveedor (escribe) | 🔵 | Para excursiones y gastronomía |
| Marcar blackouts | Proveedor (escribe) | 🔵 | Fechas bloqueadas |
| Consultar disponibilidad | Agencia (lee) | 🔵 | Buscar cupos por fecha y servicio |
| Reservar cupo | Agencia (escribe) | 🔵 | Descuenta el cupo al reservar |
| Confirmar reserva | Proveedor (escribe) | 🔵 | Acepta o rechaza el cupo reservado |
| Políticas de fallback | Admin (configura) | 🟡 | `availability_policies` por organización |
| Cache de búsquedas | Sistema (automático) | 🟡 | `availability_cache` por minutos |

**Flujo de disponibilidad:**

```text
  Proveedor carga cupo        Agencia busca cupo         Sistema reserva
  en su calendario    ───►    en el marketplace  ───►    y descuenta cupo
  (escribe)                  (lee)                      (escribe)
       │                        │                          │
       ▼                        ▼                          ▼
  service_availability     availability_cache        service_availability
  + availability_sources   (resultado cacheado)      (cupos reservados)
```

### 12.2 Motor Tarifario

El proveedor **publica** tarifas; el sistema las **aplica** al cotizar.

| Interacción | Quién actúa | Estado | Detalle |
| --- | --- | --- | --- |
| Crear plan tarifario | Proveedor (escribe) | 🟡 | `tariff_plans` por recurso/servicio |
| Definir temporadas | Proveedor (escribe) | 🟡 | `tariff_seasons` con rango y prioridad |
| Fijar precios por categoría | Proveedor (escribe) | 🟡 | `tariff_rules` por categoría de pasajero |
| Definir condiciones | Proveedor (escribe) | 🟡 | `tariff_rule_conditions` (noches, anticipación) |
| Publicar al marketplace | Proveedor (escribe) | 🔵 | Tarifa visible para agencias (precio venta) |
| Calcular tarifa | Sistema (automático) | 🔵 | Al cotizar, el motor resuelve plan → temporada → regla |
| Snapshot de tarifa | Sistema (automático) | 🔵 | La tarifa aplicada se congela en la reserva |

**Flujo tarifario:**

```text
  Proveedor publica          Sistema calcula           Reserva congela
  plan + temporada    ───►   tarifa al cotizar  ───►   tarifa como snapshot
  + reglas + categorías     (resolve)                 (inmutable en booking_service_economics)
       │                        │                          │
       ▼                        ▼                          ▼
  tariff_plans            compute_service_rate       booking_service_economics
  tariff_seasons          (función futura)           (venta, costo, margen congelados)
  tariff_rules
```

### 12.3 Motor Comercial (Acuerdos)

El proveedor **sujeta** sus servicios a acuerdos comerciales; el sistema los **resuelve**.

| Interacción | Quién actúa | Estado | Detalle |
| --- | --- | --- | --- |
| Firmar acuerdo comercial | Admin + Proveedor | ✅ | `commercial_agreements` con vigencia y versión |
| Definir reglas de acuerdo | Admin (escribe) | ✅ | `agreement_rules` por alcance (destino, servicio) |
| Resolver acuerdo | Sistema (automático) | ✅ | `resolve_agreement` por score de especificidad |
| Ver acuerdo aplicado | Proveedor (lee) | 🔵 | El proveedor ve qué acuerdo se aplicó a su servicio |
| Historial de acuerdo | Proveedor (lee) | 🔵 | `agreement_history` (versiones del acuerdo) |

> Los acuerdos los firma el admin de la agencia con el proveedor. El proveedor **ve**
> el acuerdo aplicado pero no lo edita: la negociación comercial es con el admin.

### 12.4 Motor de Itinerarios

El proveedor **aparece** en itinerarios como un servicio; el sistema los **ensambla**.

| Interacción | Quién actúa | Estado | Detalle |
| --- | --- | --- | --- |
| Crear plantilla de itinerario | Admin/Agent (escribe) | 🟡 | `itinerary_templates` con ítems por día |
| Publicar plantilla | Admin (escribe) | 🔵 | Plantilla visible para agencias con acuerdo |
| Ensamblar itinerario | Sistema (automático) | 🔵 | Orquestador ensambla con servicios de múltiples proveedores |
| Recibir solicitud de itinerario | Proveedor (lee) | 🔵 | El proveedor ve qué servicio se le pide en el itinerario |
| Confirmar servicio del itinerario | Proveedor (escribe) | 🔵 | Confirmar su parte del itinerario |

**Flujo de itinerario con múltiples proveedores:**

```text
  Agente define destino, fechas, composición
         │
         ▼
  Sistema ensambla itinerario (itinerary_templates + reglas)
         │
         ├── Hotel A       ──► proveedor A confirma alojamiento
         ├── Excursión B    ──► proveedor B confirma excursión
         ├── Transporte C   ──► proveedor C confirma transfer
         ├── Guía D         ──► proveedor D confirma guía
         └── Gastronomía E  ──► proveedor E confirma restaurante
         │
         ▼
  Cada proveedor confirma su parte en el portal
         │
         ▼
  Itinerario completo → se convierte en reserva con expediente 360°
```

### 12.5 Motor de Comisiones

El proveedor **recibe** comisiones (o las paga); el sistema las **devenga**.

| Interacción | Quién actúa | Estado | Detalle |
| --- | --- | --- | --- |
| Calcular comisión | Sistema (automático) | 🟡 | `compute_commission` (simulación hoy) |
| Devengar comisión | Sistema (automático) | 🔵 | `accrue_commission()` escribe en `commissions` |
| Ver comisión devengada | Proveedor (lee) | 🔵 | El proveedor ve sus comisiones por servicio |
| Cerrar liquidación | Admin (escribe) | 🔵 | `settlements` por período y contraparte |
| Pagar liquidación | Admin (escribe) | 🔵 | `settlement_payments` |
| Ver liquidación | Proveedor (lee) | 🔵 | El proveedor ve sus liquidaciones y estado de pago |
| Conciliar | Admin (escribe) | 🔵 | `payment_reconciliations` |

**Flujo de comisiones del proveedor:**

```text
  Servicio confirmado y operado
         │
         ▼
  Motor de Comisiones calcula (compute_commission)
         │
         ├── base: gross / net / cost / margin (según acuerdo)
         ├── tipo: percentage / fixed
         └── resultado: monto de comisión por moneda
         │
         ▼
  Devengo idempotente (accrue_commission)
         │
         └── escribe en commissions (una sola vez por servicio + regla + versión)
         │
         ▼
  Cierre de liquidación mensual
         │
         ├── settlement: total ARS + total USD
         ├── estado: pendiente
         └── items: comisiones incluidas
         │
         ▼
  Pago al proveedor
         │
         ├── settlement_payment: monto, moneda, fecha
         └── estado: pagado / parcial / conciliado
         │
         ▼
  El proveedor ve todo esto en su portal (lectura)
```

---

## 13. Flujo completo del proveedor

### 13.1 Flujo de alta del proveedor

```text
  1. La agencia invita al proveedor al sistema
         │
         ▼
  2. El proveedor recibe invitación y crea su cuenta (pending)
         │
         ▼
  3. El admin de la agencia aprueba la cuenta (approved)
         │
         ▼
  4. El proveedor entra al Portal del Proveedor
         │
         ▼
  5. El proveedor completa su perfil (datos de contacto, geografía, descripción)
         │
         ▼
  6. El proveedor carga sus recursos (habitaciones, vehículos, guías, mesas)
         │
         ▼
  7. El proveedor define su calendario de cupos por fecha y horario
         │
         ▼
  8. El proveedor publica sus tarifas por temporada y categoría
         │
         ▼
  9. El proveedor define restricciones, blackouts y horarios
         │
         ▼
 10. El proveedor está listo para recibir reservas
```

### 13.2 Flujo de operación diaria

```text
  ┌───────────────────────────────────────────────────────────────────────┐
  │  MAÑANA — el proveedor revisa su bandeja                               │
  │                                                                       │
  │  1. El proveedor entra al portal                                      │
  │  2. Ve notificaciones de nuevas solicitudes de reserva                 │
  │  3. Abre la bandeja de reservas → filtra por "pendientes"              │
  │  4. Revisa cada solicitud: fecha, pasajeros, recurso asignado           │
  │  5. CONFIRMA o RECHAZA cada solicitud                                  │
  │     ├── confirma → sistema notifica a la agencia + timeline            │
  │     └── rechaza  → sistema notifica + agencia busca alternativa        │
  │  6. Revisa su calendario: cupos actualizados por las reservas          │
  │  7. Revisa alertas: cupo agotado, blackout próximo, pago pendiente     │
  └───────────────────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────────────────┐
  │  DURANTE EL DÍA — el proveedor opera                                   │
  │                                                                       │
  │  8. El proveedor marca el servicio como "en operación"                 │
  │  9. El proveedor reporta novedades (retraso, cambio de recurso)        │
  │     └── se registra como communication_event                           │
  │ 10. Al finalizar, el proveedor marca el servicio como "completado"     │
  └───────────────────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────────────────┐
  │  FIN DE MES — el proveedor revisa su liquidación                       │
  │                                                                       │
  │ 11. El proveedor entra a la sección "Liquidaciones"                   │
  │ 12. Ve el cierre del mes: total ARS + total USD + estado               │
  │ 13. Revisa el detalle: qué servicios entraron en la liquidación        │
  │ 14. Ve el estado de pago: pendiente / pagado / conciliado              │
  │ 15. Descarga el comprobante de liquidación                             │
  └───────────────────────────────────────────────────────────────────────┘
```

### 13.3 Flujo de extremo a extremo (agencia ↔ proveedor)

```text
  Agencia                          Sistema                           Proveedor
  ────────                          ────────                           ─────────

  Crea cotización
  con servicio del     ──────►    Motor Tarifario
  proveedor                       calcula tarifa
                                  (plan + temporada + categoría)
                                       │
                                  Motor de Disponibilidad
                                  verifica cupo
                                       │
                                  Motor Comercial
                                  resuelve acuerdo
                                       │
                                  Cotización lista     ──────►    Recibe notificación
                                                                  de nueva solicitud
                                                                       │
                                                                  Revisa la solicitud
                                                                  en su bandeja
                                                                       │
                                                                  Confirma o rechaza
                                                  ◄──────    (sello temporal)
  Recibe confirmación
  (o rechazo + motivo)
       │
  Si confirma:
       reserva el cupo  ──────►    Descuenta cupo
                                  (service_availability)
                                  Evento en timeline
                                  (provider_confirmed)
       │
  Si rechaza:
       busca alternativa
       (marketplace)

  ── OPERACIÓN ──

  Día del servicio     ──────►    Notifica al proveedor    ──────►    Marca "en operación"
                                                                  Reporta novedades
                                                  ◄──────    (communication_event)
  Recibe novedades
       │
  Al finalizar                    Marca "completado"        ◄──────    Marca "completado"
                                  Evento en timeline

  ── LIQUIDACIÓN ──

  Fin de mes          ──────►    Devengo de comisión
                                  (accrue_commission)
                                  Cierre de liquidación
                                  (settlement)
                                       │
                                  Notifica al proveedor   ──────►    Ve su liquidación
                                                                       (total ARS + USD)
                                                                       (detalle por servicio)
                                                                       (estado de pago)
       │
  Paga al proveedor   ──────►    Registra pago
                                  (settlement_payment)
                                  Concilia
                                  (payment_reconciliation)
                                       │
                                  Notifica al proveedor   ──────►    Ve pago registrado
                                                                  (estado: pagado / conciliado)
```

---

## 14. Seguridad y aislamiento

### 14.1 Principios

1. El proveedor ve **solo sus recursos y servicios** — RLS filtra por organización.
2. El proveedor **no ve** datos del cliente final (nombre, contacto, documento).
3. El proveedor **no ve** costos de otros proveedores ni márgenes de la agencia.
4. El proveedor **no ve** comisiones de otros proveedores ni liquidaciones ajenas.
5. El proveedor **no edita** acuerdos comerciales (los negocia con el admin).
6. El proveedor **no edita** su evaluación interna (la hace la agencia).
7. Los datos del proveedor se aislan por **contraparte**, no solo por rol.

### 14.2 Matriz de visibilidad del proveedor

| Dato | Proveedor ve | Motivo |
| --- | --- | --- |
| Su perfil | ✅ | Es suyo |
| Sus recursos | ✅ | Es suyo |
| Su calendario de cupos | ✅ | Es suyo |
| Sus tarifas (incluido costo) | ✅ | Es suyo |
| Tarifas publicadas al marketplace | ✅ | Es su publicación |
| Sus reservas asignadas | ✅ | Operación |
| Estado de sus servicios | ✅ | Confirmación |
| Sus comisiones devengadas | ✅ | Es su liquidación |
| Sus liquidaciones | ✅ | Es su cobro |
| Acuerdos aplicados a sus servicios | ✅ | Transparencia comercial |
| Clientes de la agencia | ❌ | Privacidad del cliente |
| Datos de contacto del cliente | ❌ | Privacidad |
| Costos de otros proveedores | ❌ | Sensible de terceros |
| Márgenes de la agencia | ❌ | Sensible |
| Precio de venta al cliente | ❌ | Sensible de la agencia |
| Comisiones de otros proveedores | ❌ | Sensible de terceros |
| Liquidaciones de otros proveedores | ❌ | Sensible de terceros |
| Acuerdos de otros proveedores | ❌ | Sensible de terceros |

### 14.3 RLS por contraparte

El proveedor es el actor más delicado del sistema porque **cruza la frontera** entre
la agencia y el proveedor en el marketplace. La RLS debe filtrar por **contraparte**,
no solo por rol:

```sql
-- Concepto (no es código de producción)
-- El proveedor ve los servicios donde es la contraparte
USING (
  booking_services.provider_organization_id = current_provider_org_id()
  OR booking_services.resource_id IN (SELECT id FROM resources WHERE owner_id = auth.uid())
)
```

> Una política mal escrita expone datos de la agencia al proveedor o viceversa. Es el
> punto más delicado del portal y requiere tests automatizados de RLS.

---

## 15. Estado actual y dependencias

### 15.1 Estado actual

| Componente | Estado | Detalle |
| --- | --- | --- |
| Rol `provider` | ✅ | Existe en el enum |
| RLS básica del proveedor | ✅ | Filtra a recursos/servicios propios |
| Catálogo de recursos | ✅ | Transporte, rent a car, guías |
| Motor de disponibilidad (estructura) | 🟡 | Tablas creadas sin autogestión |
| Motor tarifario (estructura) | 🟡 | Tablas creadas sin cálculo |
| Motor de itinerarios (estructura) | 🟡 | Tablas creadas sin generación |
| Motor de comisiones (simulación) | 🟡 | Cálculo al vuelo sin devengo |
| Portal del proveedor | 🔵 | No existe |
| Autogestión de catálogo | 🔵 | No existe |
| Calendario de cupos | 🔵 | No existe UI |
| Publicación de tarifas | 🔵 | No existe |
| Confirmaciones | 🔵 | No existe |
| Liquidaciones | 🔵 | No existe |
| Mensajería real | 🔵 | `communication_events` registra, no envía |

### 15.2 Dependencias previas

El portal del proveedor **no se puede construir de la nada**. Depende de:

| Dependencia | Estado | Por qué es necesaria |
| --- | --- | --- |
| Consolidar `organizations` | 🟡 | Sin esto, "el proveedor" es ambiguo |
| Motor tarifario activo | 🔵 | Sin tarifa calculable, el proveedor publica para nada |
| Motor de disponibilidad activo | 🔵 | Sin cupos consultables, el calendario no sirve |
| Devengo de comisiones | 🔵 | Sin devengo, no hay liquidación que mostrar |
| Liquidaciones | 🔵 | Sin `settlements`, no hay cierre por período |
| Mensajería real | 🔵 | Sin envío real, las notificaciones no llegan |
| Tests de RLS | 🔵 | Sin tests, el aislamiento del proveedor no es seguro |

### 15.3 Orden de construcción propuesto

```text
  1. Consolidar organizations (retirar companies/providers)   🟡 →  ✅
       │
       ▼
  2. Activar motor tarifario (cálculo por composición)         🔵 →  ✅
       │
       ▼
  3. Activar motor de disponibilidad (búsquedas reales)         🔵 →  ✅
       │
       ▼
  4. Portal del proveedor — Fase 1: perfil + recursos + calendario
       │  (el proveedor carga su catálogo y cupos)
       ▼
  5. Portal del proveedor — Fase 2: tarifas + restricciones + blackouts
       │  (el proveedor publica precios y reglas)
       ▼
  6. Portal del proveedor — Fase 3: confirmaciones + reservas
       │  (el proveedor confirma y opera)
       ▼
  7. Activar devengo de comisiones + liquidaciones             🔵 →  ✅
       │
       ▼
  8. Portal del proveedor — Fase 4: liquidaciones
       │  (el proveedor ve lo que se le debe)
       ▼
  9. Activar mensajería real (WhatsApp/email)                  🔵 →  ✅
       │
       ▼
 10. Portal del proveedor — Fase 5: notificaciones reales
       (el proveedor recibe alertas en tiempo real)
```

### 15.4 Riesgos

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Fuga de datos al proveedor | Crítico | RLS por contraparte + tests automatizados |
| Proveedor ve costos de terceros | Crítico | RLS por organización en todos los datos sensibles |
| Mercado sin tarifa calculable | Alto | Activar motor tarifario antes del portal |
| Confirmación sin mensajería | Medio | Activar envío real de notificaciones |
| Liquidación sin devengo | Alto | Activar `accrue_commission` antes de mostrar liquidaciones |
| Abuso del proveedor en el catálogo | Medio | Aprobación de la agencia para recursos nuevos |
| Sobrecarga del proveedor | Bajo | UI simple, wizard de alta, plantillas por tipo |

---

## Cierre

El Portal del Proveedor convierte al proveedor de un pasivo que recibe WhatsApp en un
actor activo que publica su oferta y confirma dentro del sistema. Cada tipo de
proveedor —hotel, excursiones, transporte, rent a car, gastronomía, guías— gestiona
su perfil, su calendario, sus cupos, sus tarifas, sus restricciones, sus horarios,
sus recursos, sus confirmaciones, sus reservas y sus liquidaciones futuras desde un
espacio propio.

El portal no es un módulo aislado: es la **interfaz** a través de la cual el proveedor
interactúa con los cinco motores del core. Escribe en el motor de disponibilidad,
publica en el motor tarifario, se sujeta al motor comercial, aparece en el motor de
itinerarios y recibe del motor de comisiones. El aislamiento es la pieza más delicada:
el proveedor ve lo necesario para operar, nunca los datos sensibles de la agencia ni
de otros proveedores.

El orden de construcción es claro: consolidar organizaciones, activar los motores que
ya tienen estructura y, recién entonces, abrir el portal por fases —perfil, calendario,
tarifas, confirmaciones, liquidaciones— sobre una base segura y funcional.

> **El proveedor deja de operar por WhatsApp. Pasa a operar dentro del sistema.**
