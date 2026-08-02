# 05 — Módulos

> ✅ Implementado · 🟡 Parcial · 🔵 Planificado

## Índice
1. [Mapa general](#mapa-general)
2. [Detalle por módulo](#detalle-por-módulo)

## Mapa general

| Módulo | Ruta | Estado |
| --- | --- | --- |
| Landing pública | `/` | ✅ |
| Autenticación y aprobación | `/auth` | ✅ |
| Dashboard | `/dashboard` | ✅ |
| Cotizaciones | `/quotations` | ✅ |
| Cotización pública | `/cotizacion/$token` | ✅ |
| Clientes (CRM) | `/clients` | ✅ |
| Leads | `/leads` | ✅ |
| Agentes | `/agents` | ✅ |
| Reservas — Expediente 360° | `/bookings` | ✅ |
| Central operativa | `/operations` | ✅ |
| Recursos operativos | `/resources` | ✅ |
| Transporte | `/transport` | ✅ |
| Agenda operativa | `/agenda` | ✅ |
| Panel del conductor | `/driver` | ✅ |
| Seguimiento del cliente | `/seguimiento/$token` | ✅ |
| Organizaciones | `/organizations` | 🟡 |
| Proveedores | `/providers` | 🟡 |
| Acuerdos comerciales | `/agreements` | ✅ |
| Comisiones | pestaña en la reserva | 🟡 simulación |
| Administración | `/admin` | ✅ |
| Configuración | `/settings` | ✅ |

## Detalle por módulo

### Autenticación y cuentas ✅
Email y contraseña. Sin registro libre efectivo: la cuenta queda `pending` hasta que
un administrador la aprueba (`AccountGate`). `AdminRecovery` permite reclamar el rol
admin solo si no existe ninguno (`claim_admin_if_none`).

### Dashboard ✅
Estadísticas de cotizaciones, embudo de oportunidades y métricas operativas,
expresadas en la **moneda de análisis** configurada (`use-analysis-currency`).

### Cotizaciones ✅
Alta detallada (cliente, viaje, alojamiento, precios con impuestos y "otros cargos",
observaciones, hasta 10 fotos), edición, duplicado, archivado e historial.
Compartir por enlace público único y descarga PDF con el branding configurado
(`quotation-print.tsx`). Al crear se sincroniza el cliente en el CRM y se genera la
oportunidad correspondiente.

### CRM: clientes, leads y oportunidades ✅
- `clients`: ficha con historial de cotizaciones, estado comercial y buscador.
- `leads`: bandeja de consultas, ciclo de vida, asignación manual o automática
  (`lead-assignment-settings`), conversión a cliente y métricas por agente.
- `opportunities`: etapas del pipeline, agente asignado y validaciones por trigger.

### Agentes ✅
Ficha con datos personales, idiomas, especialidades y perfil comercial; estadísticas
automáticas; invitación y vinculación con un usuario del sistema. Un agente puede
existir sin acceso. Campos preparados para WhatsApp (`agent_wa_status`) 🔵 sin envío real.

### Reservas — Expediente de Viaje 360° ✅
`/bookings/$id` es el centro operativo del viaje. Cabecera con estado comercial y
estado operativo derivado, avance y pendientes. Siete pestañas:

| Pestaña | Contenido |
| --- | --- |
| Resumen | Datos del viaje, pasajeros, titular y composición del grupo |
| Servicios y operación | `booking_services`, recursos, transporte, checklist, incidencias, proveedor |
| Economía | Venta, impuestos, extras y cobros; costo y margen solo para Administrador |
| Documentos | Documentos con fecha, usuario y estado |
| Comunicaciones | `communication_events` de la reserva y sus servicios (solo lectura) |
| Comisiones | Simulación con acuerdo y regla aplicados, etiquetada como no contable |
| Timeline | Cronología append-only con filtros y vista "visible al cliente" |

### Central operativa ✅
Bandeja `/operations` con estado operativo de reservas, servicios incluidos,
checklist y advertencias críticas para el rol `operations`.

### Recursos operativos ✅
Catálogo con clasificación y subtipos, propietario, datos técnicos de vehículo,
cobertura geográfica (geografía completa de Argentina), extras y rent a car.
Formulario en acordeón con selectores dependientes.

### Transporte, agenda y conductor ✅
`transport_services` por reserva, sugerencias geográficas (sin asignación automática),
agenda `/agenda` con filtros por zona, panel `/driver` para aceptar/rechazar y avanzar
estados de viaje, y economía del servicio (venta, costo, margen, cobro y liquidación).

### Organizaciones y proveedores 🟡
`organizations` + `organization_roles` es el modelo objetivo; `companies` y
`providers` siguen existiendo y en uso. Incluye ficha, recursos asociados, reservas,
evaluación interna y métricas.

### Acuerdos comerciales ✅ / Comisiones 🟡
`commercial_agreements` con tipos, estados, versiones y `agreement_rules` por alcance.
El motor de comisiones resuelve acuerdo + regla y calcula el importe **en simulación**:
no escribe en `commissions`, no liquida y separa totales por moneda.

### Comunicaciones 🟡
Se registran eventos (tipo, destinatario, fecha, leído/no leído) y se notifica
internamente en tiempo real. **No hay envío real de WhatsApp ni email.**

### Administración y configuración ✅
`/admin`: aprobar, rechazar, activar/desactivar cuentas, gestionar roles con
confirmación y log de permisos. `/settings`: logo, colores institucionales, datos de
contacto, moneda de análisis y tipo de cambio operativo.
