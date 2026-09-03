# Roadmap de trabajo

## Hecho
- [x] Intervención 1 — Ciclo de estados de `quotations` (draft → sent → accepted/rejected/expired), guarda de transiciones, expiración perezosa, filtros y dashboard con estados reales, Smart Quotes fuera del menú.

## En curso
- [x] Vista pública de cotización (`/cotizacion/$token`), solo estos 3 puntos:
  - [x] Mostrar la URL de la cotización (dinámica, copiable, enlazable).
  - [x] Botón "Contactar agente" con ícono de WhatsApp y mensaje inicial de la cotización.
  - [x] Enlace inferior a la web oficial de VIAE, clickeable y en pestaña nueva (mismo estilo/ubicación).

- [x] Intervención 2 — Aceptación/rechazo público por token: respuesta del cliente desde `/cotizacion/$token` (aceptar/rechazar + comentario opcional), una sola vez, respetando vencimiento y guarda de transiciones; visible en la ficha interna.

- [x] Intervención 3 — Conversión Cotización → Reserva completa: idempotencia (una cotización = una reserva, índice único + reuso de la reserva existente) y alta de acompañantes según `pax_count` además del titular. El traslado `quotation_items → booking_services` y titular → `booking_passengers` ya estaba operativo.

- [x] Intervención 4 — Membresías: panel "Miembros y accesos" en la ficha de organización (listado con identidad, cambio de rol interno, revocación de acceso), invitaciones por correo con enlace copiable y revocación, y ruta de aceptación `/invitacion/$token` con sesión requerida. Función segura `list_organization_members`. Sin tocar Intervenciones 1-3.

## Pendiente
- [x] Intervención 5 — Economía / Tipo de cambio: carga de tipos de cambio del Financial Core en Ajustes (`CurrencyRatesCard` + RPC `register_currency_exchange_rate`, histórico inmutable) y sello de la tasa aplicada en la conversión a reserva (`applied_exchange_rate` / `applied_rate_date` / `applied_rate_source` en `bookings` y `booking_services`; prioridad manual → snapshot → sin tasa). Las reservas no cambian de importe si luego se carga otra tasa.
- [ ] Notificación al agente cuando el cliente responde la cotización.
- [ ] Conversión automática a reserva al aceptar.
