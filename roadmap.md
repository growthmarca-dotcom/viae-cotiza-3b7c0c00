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
