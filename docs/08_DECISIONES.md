# 08 — Decisiones de arquitectura

> Registro de decisiones tomadas y aplicadas. Formato: contexto → decisión → consecuencia.

## Índice
1. [Plataforma](#plataforma)
2. [Seguridad](#seguridad)
3. [Modelo de datos](#modelo-de-datos)
4. [Economía](#economía)
5. [Producto y UX](#producto-y-ux)
6. [Decisiones descartadas](#decisiones-descartadas)

## Plataforma

**D-01 · TanStack Start en lugar de SPA con React Router.**
Se necesitaba SSR y rutas públicas indexables (cotización, seguimiento).
→ Rutas de archivo en `src/routes`; no se usa React Router en ningún punto.

**D-02 · Lógica de negocio en la base de datos, no en edge functions.**
Las reglas debían aplicarse igual desde cualquier cliente.
→ Funciones y triggers en Postgres; el frontend consume RPC tipado. El único server
function existente es el que valida el token de la cotización pública.

**D-03 · TanStack Query como única capa de estado remoto.**
→ Sin Redux ni contextos de datos; caché e invalidación por `queryKey`.

## Seguridad

**D-04 · Roles en tabla separada (`user_roles`) con `has_role()` SECURITY DEFINER.**
Guardar el rol en el perfil habilita escalada de privilegios y recursión en RLS.
→ Ninguna política consulta `profiles` para decidir permisos.

**D-05 · Sin registro libre: aprobación por administrador.**
→ `account_status` + `AccountGate`; `is_approved()` en las políticas.

**D-06 · Nada público directo: los enlaces públicos pasan por token validado en servidor.**
Se eliminó la política de lectura pública de `quotations` que exponía datos sensibles.
→ Server function con cliente admin que devuelve solo campos publicables; el seguimiento
usa `booking_public_tracking` con salida acotada.

**D-07 · Costos y márgenes solo para Administrador.**
→ El recorte se hace en RLS y en las funciones, no ocultando campos en la UI.

**D-08 · Protección del último administrador y recuperación de emergencia.**
→ `prevent_last_admin_removal` + `claim_admin_if_none` (solo si no hay admins).

## Modelo de datos

**D-09 · Archivar en lugar de borrar.**
Historial comercial y trazabilidad.
→ `record_status` en las entidades principales; los listados filtran `active`.

**D-10 · Historiales append-only.**
→ `audit_log`, `*_history` y `booking_timeline` con triggers que bloquean UPDATE/DELETE.

**D-11 · Timeline alimentado solo por triggers internos.**
Evitar eventos falsos o inconsistentes creados desde la interfaz.
→ `create_booking_timeline_event` con `EXECUTE` únicamente para `service_role`.

**D-12 · Estado operativo derivado, no un segundo estado manual.**
Dos estados editables se contradicen.
→ `booking_trip_state()` calcula al vuelo; `bookings.status` sigue siendo el comercial.
Se dejó preparado para materializarse sin cambiar el contrato.

**D-13 · Número de reserva humano `VIA-AA-000001`.**
El UUID no sirve para hablar con clientes y proveedores.
→ Generado por trigger, único.

**D-14 · `organizations` + `organization_roles` como entidad comercial unificada.**
Una misma empresa puede ser agencia, proveedor y cliente corporativo.
→ Migración iniciada; `companies` y `providers` se mantienen mientras se consolidan
(deuda técnica registrada).

**D-15 · Pasajeros separados del cliente comercial.**
→ `booking_passengers` no duplica `clients`; el titular se marca con índice único parcial.

**D-16 · La edad no se persiste.**
Cambia con el tiempo y con la fecha de viaje.
→ Se calcula siempre (`calculate_passenger_age`).

## Economía

**D-17 · Nunca sumar monedas distintas.**
→ Totales agrupados por moneda; la "moneda de análisis" es una decisión explícita de
configuración para los tableros.

**D-18 · Tipo de cambio manual con snapshot.**
No depender de una API externa ni recalcular el pasado.
→ `exchange_rates` + `rate_at()`; la economía del servicio guarda el TC aplicado.

**D-19 · Motor de comisiones en simulación antes del devengo.**
Activar devengo sin validar reglas produce datos contables erróneos.
→ `commissions` existe vacía e inmutable; `resolve_agreement`/`compute_commission` son
funciones de lectura; la UI advierte que no hay movimiento contable.

**D-20 · Resolución de acuerdos por score de especificidad.**
→ Gana la regla más específica (contraparte + tipo de servicio + geografía + fecha).

## Producto y UX

**D-21 · El expediente de la reserva es el centro operativo.**
→ `/bookings/$id` con 7 pestañas reutilizando los paneles existentes, sin duplicar lógica.

**D-22 · Tokens de diseño semánticos, sin colores literales.**
→ Paleta blanco/beige, verde oscuro y dorado definida en `src/styles.css`.

**D-23 · Branding del cliente separado del branding del desarrollador.**
→ Configuración de empresa gobierna cotizaciones y PDF; "Desarrollado por MarCa Growth"
solo en pantallas internas.

**D-24 · Español como único idioma.**
→ Etiquetas y formatos `es-AR` en la capa de dominio, no dispersos en componentes.

## Decisiones descartadas

| Idea | Motivo |
| --- | --- |
| Lectura pública directa de `quotations` vía RLS | Exponía datos sensibles; reemplazada por validación de token en servidor |
| Rol o flag de admin en `profiles` | Riesgo de escalada de privilegios |
| Borrado físico de registros | Pérdida de trazabilidad comercial |
| Asignación automática de conductores/recursos | Requiere reglas de negocio aún no definidas; hoy solo sugerencias |
| Guardar la edad del pasajero | Dato mutable; se calcula |
| Estado operativo editable a mano | Genera conflicto con el estado comercial |
