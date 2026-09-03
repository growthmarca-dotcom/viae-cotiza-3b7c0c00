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
- [x] Notificación al agente cuando el cliente responde la cotización: trigger `tg_quotation_client_response_notify` en `quotations` (transición sin responder → respondida) que crea avisos en el centro de notificaciones existente para el agente asignado a la oportunidad y/o el dueño de la cotización, con número, cliente, fecha/hora, comentario y enlace directo; índice único por (usuario, cotización, tipo) para idempotencia; si no hay agente responsable queda registrado en `audit_log` sin afectar la respuesta del cliente. La campana distingue "Cliente aceptó" / "Cliente rechazó" y ofrece "Abrir cotización". No crea reservas.
- [x] Intervención 7 — Conversión **asistida** de cotización aceptada → reserva: la acción "Convertir a reserva" aparece en la ficha interna solo cuando `quotations.status = 'accepted'` y no existe reserva; si ya existe muestra "Reserva creada · Abrir VIA-…". Diálogo de confirmación de solo lectura (`QuotationConvertDialog`) con cliente, número de cotización, destino, fechas, pasajeros, cantidad de servicios, importe y moneda, y acción final "Confirmar conversión". Reutiliza `createBooking()` (idempotente por `bookings.quotation_id`, traslado de `quotation_items → booking_services` y titular/acompañantes → `booking_passengers`, herencia de contexto comercial y sello de tipo de cambio). `createBooking()` ahora rechaza el origen cotización si el estado no es `accepted`. Trazabilidad con trigger `tg_quotation_converted_to_booking`, que agrega el evento `converted_to_booking` en `quotation_history` con reserva, número y fecha.
- [x] Intervención 8 — Cierre del ciclo comercial en el Pipeline: al convertir una cotización aceptada en reserva, la oportunidad asociada se cierra como ganada reutilizando `moveOpportunityStage()` y la etapa del grupo `won` de `opportunity_stage_config` (hoy `booked`). Idempotente: si ya está ganada no vuelve a mover la etapa ni a escribir `opportunity_history`; la reserva sigue siendo única por `bookings.quotation_id`. Si la reserva se crea pero el cierre falla, se registra en `audit_log` (`pipeline_close_failed`, RPC `log_pipeline_close_issue`), se avisa al agente y se puede reintentar con "Cerrar oportunidad como ganada" desde la ficha de cotización, sin crear otra reserva. Rechazo del cliente: no cierra nada automáticamente; acción asistida "Marcar oportunidad como perdida" con motivo obligatorio (`opportunities.lost_reason`) y confirmación, disponible en la ficha de cotización y de oportunidad.
- [ ] Conversión automática a reserva al aceptar — DESCARTADA POR DECISIÓN DE PRODUCTO (no es un pendiente técnico).
