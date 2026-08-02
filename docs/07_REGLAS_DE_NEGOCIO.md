# 07 — Reglas de negocio

> Reglas efectivamente implementadas en base de datos o en la capa de dominio.

## Índice
1. [Cuentas y permisos](#cuentas-y-permisos)
2. [Cotizaciones](#cotizaciones)
3. [CRM y leads](#crm-y-leads)
4. [Reservas y expediente](#reservas-y-expediente)
5. [Pasajeros](#pasajeros)
6. [Operación y transporte](#operación-y-transporte)
7. [Economía y monedas](#economía-y-monedas)
8. [Acuerdos y comisiones](#acuerdos-y-comisiones)
9. [Reglas transversales](#reglas-transversales)

## Cuentas y permisos

1. Toda cuenta nueva nace `pending` y no accede a datos hasta ser aprobada.
2. Estados posibles: `pending`, `approved`, `rejected`, `suspended`.
3. No se puede quitar el rol al **último administrador** (trigger).
4. Si no existe ningún administrador, un usuario puede reclamar el rol
   (`claim_admin_if_none`); si ya existe uno, la operación falla.
5. Todo cambio de rol o de estado de cuenta queda registrado.

## Cotizaciones

1. Cada cotización pertenece a su creador y es visible por admin.
2. Precio final = servicios + impuestos + **otros cargos** − descuentos; "otros cargos"
   es independiente de los impuestos.
3. Hasta 10 imágenes por cotización, con vista previa.
4. Se comparte por **token único**; la vista pública muestra el branding comercial
   configurado y nunca el nombre interno del sistema.
5. El PDF replica el branding (logo y colores) y no incluye el footer del desarrollador.
6. Editar genera versión en `quotation_history`; nunca se borra, se archiva.
7. Al crear una cotización se sincroniza el cliente en el CRM y se crea/actualiza su
   oportunidad comercial.

## CRM y leads

1. Un lead recorre su ciclo de vida (`lead_status`) y todo cambio queda en `lead_history`.
2. Asignación de leads: manual o automática según `lead_assignment_mode` configurado.
3. Convertir un lead crea el cliente sin duplicar registros existentes.
4. Un agente ve solo sus clientes, leads y oportunidades; el administrador ve todo.
5. Un agente puede existir sin usuario del sistema; al invitarlo se vincula el perfil.

## Reservas y expediente

1. Cada reserva recibe un número humano único `VIA-AA-000001` al crearse.
2. Coexisten dos estados:
   - **Comercial** (`bookings.status`): manual, decidido por el equipo.
   - **Operativo** (`booking_trip_state`): derivado, no editable.
3. Prioridad del estado operativo: `cancelled` → `finished` (fechas pasadas) →
   `operational` (en curso) → `confirmed` (todos los servicios confirmados) →
   `partially_confirmed` → `quoted` (existe cotización u oportunidad) → `draft`.
4. El avance (%) se calcula sobre servicios confirmados y checklist crítico;
   las incidencias bloqueantes impiden considerar la reserva confirmada.
5. Al crear la reserva se siembra el checklist base (`default_checklist_items`).
6. `booking_timeline` es la narración del expediente: append-only, alimentada solo por
   triggers internos, sin escritura desde la interfaz.
7. Los eventos tienen visibilidad (`timeline_visibility`); el filtro "visible al cliente"
   es solo visual y no expone datos a terceros.

## Pasajeros

1. Como máximo **un pasajero titular activo** por reserva.
2. `passenger_type`: `adult`, `child`, `infant`, `senior`, `other`.
3. Fecha de nacimiento opcional para adulto/mayor/otro y **recomendada** para niño e infante.
4. La edad nunca se persiste: se calcula a la fecha de viaje
   (`calculate_passenger_age` / `calculatePassengerAge`).
5. La composición del grupo (adultos, niños, infantes, edades) es un contrato de
   lectura preparado para tarifas futuras; **hoy no calcula precios**.
6. Los pasajeros se archivan, no se eliminan.

## Operación y transporte

1. Un servicio de transporte se asigna manualmente; el sistema **sugiere** por geografía
   y advierte solapamientos, pero no asigna automáticamente.
2. El conductor puede aceptar o rechazar el servicio y avanzar los estados del viaje.
3. La disponibilidad del recurso se sincroniza con los servicios asignados y todo cambio
   queda registrado.
4. Las incidencias con prioridad crítica se muestran como advertencia operativa.
5. Los eventos operativos generan notificaciones internas en tiempo real.

## Economía y monedas

1. Cada importe se guarda con su moneda; **nunca se suman monedas distintas**.
2. La **moneda de análisis** (configuración de empresa) define en qué moneda se expresan
   las estadísticas; por defecto USD.
3. Los tipos de cambio son manuales (`exchange_rates`) y se consultan por fecha con
   `rate_at`, dejando snapshot en la economía del servicio.
4. Margen = venta − costo, calculado por servicio en `booking_service_economics`.
5. Costos y márgenes solo son visibles para el Administrador.
6. Los servicios de transporte manejan además estado de **cobro** y de **liquidación**.

## Acuerdos y comisiones

1. Un acuerdo tiene contraparte, tipo, estado, versión y vigencia; cada cambio genera
   historial inmutable.
2. `resolve_agreement` elige la regla aplicable por **score de especificidad**
   (destino, tipo de servicio, contraparte, fecha).
3. `compute_commission` calcula sobre base `gross`, `net`, `cost` o `margin`, con tipo
   `percentage` o `fixed`, aplicando exclusiones de impuestos/extras y topes mín./máx.
4. **Fase actual = simulación**: no se inserta nada en `commissions`, no hay devengo ni
   liquidaciones, y la UI lo advierte explícitamente.
5. Los totales de simulación se agrupan por moneda.

## Reglas transversales

1. Nunca se borra: `record_status = 'archived'`.
2. Todo registro lleva `created_at` y `updated_at` (trigger).
3. El footer "Desarrollado por MarCa Growth" solo aparece en pantallas internas.
4. La interfaz está íntegramente en español (es-AR), con formato de fecha y número local.
