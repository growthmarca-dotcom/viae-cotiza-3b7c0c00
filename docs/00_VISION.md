# 00 — Visión

> Documentación del estado **real** del proyecto al 2 de agosto de 2026.
> Leyenda usada en todos los documentos:
> ✅ Implementado · 🟡 Parcial · 🔵 Planificado (no existe código)

## Índice
1. [Producto](#producto)
2. [Problema que resuelve](#problema-que-resuelve)
3. [Usuarios y roles](#usuarios-y-roles)
4. [Alcance actual](#alcance-actual)
5. [Fuera de alcance hoy](#fuera-de-alcance-hoy)
6. [Principios de diseño](#principios-de-diseño)

## Producto

**ViaE Sales Hub** — *Sistema profesional de cotizaciones y gestión comercial para turismo*.

Aplicación web responsive (una sola app, sin app móvil nativa) que cubre el ciclo
comercial y operativo de una agencia de viajes: captación de consultas, cotización,
reserva, operación del viaje y control económico.

Idioma de la interfaz: **español (es-AR)**. Identidad visual: blanco/beige, verde
oscuro y detalles dorados.

## Problema que resuelve

| Necesidad | Estado |
| --- | --- |
| Cotizar de forma profesional y compartir por enlace público / PDF | ✅ |
| Centralizar clientes, consultas y pipeline comercial | ✅ |
| Operar reservas: servicios, checklist, incidencias, documentos | ✅ |
| Coordinar transporte propio y de terceros con conductores | ✅ |
| Centralizar condiciones comerciales (acuerdos, comisiones) | 🟡 (simulación) |
| Liquidar comisiones y pagos a proveedores | 🔵 |
| Portal del cliente final | 🔵 (solo seguimiento por token ✅) |

## Usuarios y roles

Roles reales del enum `app_role`: `admin`, `agent`, `provider`, `operations`.

| Rol | Uso real hoy |
| --- | --- |
| **admin** | Acceso total, incluida información sensible (costos y márgenes) |
| **operations** | Central operativa de reservas y transporte, sin costos ni márgenes |
| **agent** | Solo sus clientes, leads, cotizaciones y reservas asignadas |
| **provider** | Acceso restringido a los servicios/recursos propios |
| Conductor | No es un rol del enum: se deriva de `resources` vinculados al usuario (`is_driver()`) |

Las cuentas nuevas nacen en estado `pending` y requieren aprobación de un
administrador (`account_status`). No hay registro libre ni acceso anónimo.

## Alcance actual

Módulos con UI en producción: Dashboard, Cotizaciones, Clientes/CRM,
Oportunidades, Leads, Agentes, Reservas (Expediente 360°), Operaciones,
Recursos, Transporte, Agenda, Panel del conductor, Organizaciones, Proveedores,
Acuerdos comerciales, Administración y Configuración.

## Fuera de alcance hoy

- Devengo y liquidación de comisiones (la tabla `commissions` existe **vacía**).
- Motor tarifario / precios por composición de pasajeros.
- Envío real de WhatsApp o email (solo se registran eventos).
- Asignación automática de recursos o conductores.
- Portal de cliente con login.
- Pagos online / pasarelas.

## Principios de diseño

1. **Nunca borrar**: los registros se archivan (`record_status`).
2. **Costos y márgenes son sensibles**: visibles solo para Administrador.
3. **Seguridad en la base**: el recorte de datos lo hace RLS, no el cliente.
4. **Historial inmutable**: `booking_timeline`, `audit_log`, `*_history` son append-only.
5. **No romper lo existente**: cada versión suma sin cambiar el diseño general.
6. **Multimoneda explícita**: nunca se suman monedas distintas en un total.
