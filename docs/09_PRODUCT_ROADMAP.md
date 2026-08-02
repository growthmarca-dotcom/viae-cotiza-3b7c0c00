# PRODUCT ROADMAP — ViaE Sales Hub

> Hoja de ruta de producto desde la versión actual (**v1.9.5.x**) hasta una plataforma
> SaaS turística multiproveedor de marca blanca (**v2.0**).
> Documento **de planificación**: el estado actual se basa en el código, las migraciones y
> el catálogo real de la base; las versiones futuras describen alcance propuesto.
> Leyenda: ✅ implementado · 🟡 parcial · 🔵 planificado (no existe código).

## Índice
1. [Estado actual (v1.9.5.x)](#1-estado-actual-v195x)
2. [v1.9.6 — Motor Tarifario Turístico](#2-v196--motor-tarifario-turístico)
3. [v1.9.7 — Economía y Liquidaciones](#3-v197--economía-y-liquidaciones)
4. [v1.9.8 — Ecosistema Proveedores](#4-v198--ecosistema-proveedores)
5. [v2.0 — SaaS Multiproveedor / Marca Blanca](#5-v20--saas-multiproveedor--marca-blanca)
6. [Secuencia y dependencias](#6-secuencia-y-dependencias)

---

## 1. Estado actual (v1.9.5.x)

**Versión actual: v1.9.5.4** — Expediente de Viaje 360°, primera capa visual.
Aplicación única, responsive, es-AR, **single-tenant** (una agencia). 43 tablas en `public`,
todas con RLS. La lógica de negocio vive en la base (funciones `SECURITY DEFINER`/`STABLE`
y triggers); el frontend consume módulos de dominio en `src/lib/`.

### Módulos implementados

| Dominio | Módulo | Ruta | Estado |
| --- | --- | --- | --- |
| Identidad | Auth + aprobación de cuentas | `/auth` | ✅ |
| Identidad | Usuarios y roles (`admin`, `agent`, `provider`, `operations`) | `/admin` | ✅ |
| Identidad | Configuración y branding | `/settings` | ✅ |
| Comercial | Dashboard con métricas y embudo | `/dashboard` | ✅ |
| Comercial | Leads y distribución | `/leads` | ✅ |
| Comercial | Clientes (CRM) y oportunidades | `/clients` | ✅ |
| Comercial | Cotizaciones + enlace público + PDF | `/quotations/*`, `/cotizacion/$token` | ✅ |
| Comercial | Agentes | `/agents` | ✅ |
| Entidades | Organizaciones (modelo objetivo) | `/organizations` | 🟡 |
| Entidades | Proveedores (legado) | `/providers` | 🟡 |
| Acuerdos | Acuerdos comerciales + reglas versionadas | `/agreements` | ✅ |
| Acuerdos | Comisiones (solo simulación) | pestaña en la reserva | 🟡 |
| Operación | Expediente de Viaje 360° (7 pestañas) | `/bookings/$id` | ✅ |
| Operación | Central operativa, checklist e incidencias | `/operations` | ✅ |
| Operación | Recursos operativos (catálogo inteligente) | `/resources/*` | ✅ |
| Operación | Transporte, agenda y panel del conductor | `/transport`, `/agenda`, `/driver` | ✅ |
| Cliente | Seguimiento público por token | `/seguimiento/$token` | ✅ |
| Transversal | Comunicaciones (registro, sin envío real) | paneles embebidos | 🟡 |

### Capacidades actuales

| Capacidad | Estado | Detalle |
| --- | --- | --- |
| Ciclo Lead → Cliente → Cotización → Reserva | ✅ | Conversión sin duplicar registros |
| Cotización profesional con branding y PDF | ✅ | Enlace público por token, sin datos sensibles |
| Doble estado de la reserva | ✅ | Comercial manual + `booking_trip_state()` derivado |
| Expediente narrativo inmutable | ✅ | `booking_timeline` append-only alimentado solo por triggers |
| Pasajeros y composición del grupo | ✅ estructural | `passenger_type`, edad dinámica, `groupComposition` sin precios |
| Operación diaria | ✅ | Checklist base, incidencias, documentos, agenda, conductor |
| Economía por servicio | 🟡 | `booking_service_economics` + economía embebida en `transport_services` |
| Multimoneda | ✅ | `exchange_rates` con `rate_at()`, totales separados por moneda |
| Comisiones | 🟡 | `resolve_agreement` + `compute_commission` al vuelo; `commissions` vacía por diseño |
| Tarifas por edad / temporada | 🔵 | No existe motor tarifario |
| Liquidaciones | 🔵 | No existe cierre por período ni pago a contrapartes |
| Portal del proveedor | 🔵 | El rol `provider` entra a la app interna |
| Multi-tenant | 🔵 | No hay `tenant_id` en ninguna tabla |

---

## 2. v1.9.6 — Motor Tarifario Turístico

**Objetivo de negocio:** cotizar de forma automática y reproducible según la composición
real del grupo, la temporada y las condiciones del mayorista, eliminando el cálculo manual
de precios y los errores de tarifa.

| Punto de alcance | Estado |
| --- | --- |
| Pasajeros adultos / niños / infantes | ✅ `passenger_type` + `groupComposition` |
| Reglas por edad | 🟡 existe `calculate_passenger_age`; falta la regla que la use |
| Composición de grupos | 🟡 contrato de lectura listo, sin consumo tarifario |
| Tarifas mayoristas | 🔵 |
| Temporadas | 🔵 |
| Suplementos | 🔵 |
| Descuentos y códigos promocionales | 🟡 hay descuento por servicio; sin códigos |
| Cálculo de tarifa por servicio | 🔵 |

**Módulos afectados:** Cotizaciones, Reservas (servicios y economía), Acuerdos, Recursos,
Expediente 360° (Resumen y Economía).

**Tablas existentes involucradas:** `quotations`, `bookings`, `booking_services`,
`booking_service_economics`, `booking_passengers`, `commercial_agreements`,
`agreement_rules`, `resources`, `resource_extras`, `exchange_rates`.

**Nuevas entidades necesarias (🔵):**

| Entidad | Propósito |
| --- | --- |
| `rate_plans` | Plan tarifario por recurso/servicio/contraparte, con vigencia |
| `rate_seasons` | Temporadas con rango de fechas y prioridad |
| `rate_prices` | Precio por plan + temporada + moneda + unidad (pax, noche, servicio) |
| `rate_age_rules` | Franjas de edad → categoría tarifaria y porcentaje/importe aplicado |
| `rate_supplements` | Suplementos y reducciones (single, media pensión, alta demanda) |
| `promo_codes` + `promo_code_uses` | Código, condiciones, límite de uso, trazabilidad |
| `quote_rate_calc` (o función `compute_service_rate`) | Cálculo y snapshot de la tarifa aplicada |

**Riesgos:**
- Solapamiento de temporadas y planes: sin puntaje de especificidad explícito el precio deja de ser reproducible. Reutilizar el modelo de score ya probado en `resolve_agreement`.
- La edad **no se persiste** por diseño; toda regla por edad depende de `birth_date` + fecha de viaje. Sin `birth_date` el motor debe degradar a la categoría declarada, nunca fallar.
- Recalcular tarifas de reservas ya confirmadas rompería la economía histórica: el precio aplicado debe guardarse como snapshot inmutable.
- Doble modelo de economía (`booking_service_economics` vs `transport_services`) obliga a calcular dos veces si no se unifica primero.
- Multimoneda: la tarifa debe fijar moneda y tipo de cambio en el momento del cálculo.

**Dependencia con versiones anteriores:** requiere v1.9.5.1 (tipos de pasajero y edad
dinámica) ✅ y v1.9.3 Fase A (`booking_service_economics` + `rate_at`) ✅. Recomendable
unificar la economía del servicio antes de empezar.

---

## 3. v1.9.7 — Economía y Liquidaciones

**Objetivo de negocio:** pasar de la comisión calculada al vuelo a la comisión **devengada**
y liquidada, para saber cuánto se le debe a cada agente y proveedor y cuánto está cobrado.

| Punto de alcance | Estado |
| --- | --- |
| Comisiones reales (persistidas) | 🟡 tabla `commissions` creada y vacía por diseño |
| Devengo automático | 🔵 |
| Liquidaciones por proveedor / agente | 🔵 |
| Estados de pago | 🟡 estados de cobro/liquidación solo en transporte |
| Conciliación | 🔵 |

**Módulos afectados:** Comisiones, Economía del expediente, Transporte (economía),
Agentes, Organizaciones/Proveedores, Dashboard.

**Tablas existentes involucradas:** `commissions`, `commission_history`,
`commercial_agreements`, `agreement_rules`, `booking_service_economics`,
`transport_services`, `booking_payments`, `bookings`, `agents`, `organizations`,
`exchange_rates`, `audit_log`.

**Nuevas entidades necesarias (🔵):**

| Entidad | Propósito |
| --- | --- |
| `settlements` | Cierre por período y contraparte, con estado y totales por moneda |
| `settlement_items` | Comisiones y servicios incluidos en cada liquidación |
| `settlement_payments` | Pagos realizados/recibidos contra una liquidación |
| `payment_reconciliations` | Vínculo entre cobro registrado y movimiento esperado |
| Función `accrue_commission()` | Devengo idempotente que escribe en `commissions` |

**Riesgos:**
- `commissions` tiene trigger de inmutabilidad: hay que definir el orden de escritura y cómo se corrige un devengo erróneo (contra-asiento, nunca `UPDATE`).
- Doble devengo: el devengo debe ser idempotente por servicio + regla + versión de acuerdo.
- Cambiar una regla de acuerdo no puede alterar comisiones ya devengadas: se requiere snapshot de la regla aplicada.
- Multimoneda: una liquidación no puede sumar monedas distintas; el tipo de cambio de cierre debe quedar fijado.
- Una liquidación cerrada es un hecho contable: cancelar una reserva posterior necesita un flujo explícito de ajuste.

**Dependencia con versiones anteriores:** requiere v1.9.2/1.9.3 (acuerdos y economía) ✅ y
v1.9.4 Fase A (motor de comisiones en simulación) ✅. Se beneficia de v1.9.6: sin tarifa
consistente, la base de comisión es inestable.

---

## 4. v1.9.8 — Ecosistema Proveedores

**Objetivo de negocio:** que el proveedor trabaje dentro del sistema —confirmando servicios,
publicando disponibilidad y tarifas— y deje de operar por WhatsApp y planillas.

| Punto de alcance | Estado |
| --- | --- |
| Portal proveedor (espacio propio) | 🔵 el rol `provider` usa la app interna |
| Carga de servicios | 🟡 los carga la agencia en `resources`/`booking_services` |
| Disponibilidad | 🟡 `resource_availability_log` interno, sin autogestión |
| Confirmaciones | 🟡 estados existen; el proveedor no los cambia |
| Comunicación operativa | 🟡 `communication_events` registra, no envía |

**Módulos afectados:** Proveedores/Organizaciones, Recursos, Reservas (servicios),
Transporte, Comunicaciones, Notificaciones, Identidad (rol `provider`).

**Tablas existentes involucradas:** `organizations`, `organization_roles`, `providers`,
`provider_evaluations`, `resources`, `resource_extras`, `resource_availability_log`,
`booking_services`, `transport_services`, `communication_events`, `notifications`,
`user_roles`, `profiles`.

**Nuevas entidades necesarias (🔵):**

| Entidad | Propósito |
| --- | --- |
| `provider_users` (o vínculo `profiles ↔ organizations`) | Qué usuario representa a qué proveedor |
| `provider_service_offers` | Servicios ofrecidos por el proveedor, pendientes de aprobación |
| `provider_availability` | Calendario declarado por el proveedor (cupos, bloqueos) |
| `service_confirmations` | Confirmación/rechazo con autor, motivo y sello temporal |
| `message_threads` + `messages` | Conversación operativa por reserva/servicio |
| Rutas `api/public/*` | Webhooks y estados de entrega de mensajería |

**Riesgos:**
- Fuga de datos: el proveedor no debe ver clientes, costos de terceros ni márgenes. Requiere RLS por contraparte, no solo por rol — es el punto más delicado de esta versión.
- Depende de consolidar `organizations`: mientras convivan `companies` y `providers`, "su" proveedor es ambiguo.
- La disponibilidad declarada puede contradecir la asignación interna: se necesita una única fuente de verdad y política de conflicto.
- Envío real de WhatsApp/email implica proveedor externo, secretos, reintentos y estados de entrega: alcance mayor que el registro actual.
- Superficie de usuarios externos: onboarding, recuperación de acceso y abuso pasan a ser problemas propios.

**Dependencia con versiones anteriores:** requiere la consolidación de `organizations`
(🟡 pendiente) y se apoya en v1.9.7 para que el proveedor vea lo que se le debe. Sin v1.9.6
el proveedor puede publicar tarifas que el sistema no sabe aplicar.

---

## 5. v2.0 — SaaS Multiproveedor / Marca Blanca

**Objetivo de negocio:** vender el sistema a múltiples agencias, cada una con sus usuarios,
su marca, su dominio y sus reglas comerciales, con aislamiento total de datos.

| Punto de alcance | Estado |
| --- | --- |
| Múltiples organizaciones (tenants) | 🔵 no hay `tenant_id`; `company_settings` es fila global |
| Dominios personalizados | 🔵 |
| Branding independiente | 🟡 branding existe, pero global |
| Usuarios por organización | 🟡 roles ✅, sin dimensión de organización |
| Reglas comerciales propias | 🟡 acuerdos ✅, sin aislamiento por tenant |
| Configuración por empresa | 🟡 `company_settings` sin multiplicidad |

**Módulos afectados:** **todos**. Es un cambio transversal de modelo de datos y seguridad.

**Tablas existentes involucradas:** las 43 tablas de `public`, con foco en `company_settings`,
`profiles`, `user_roles`, `organizations`, `bookings` (numeración), `agreement_rules`,
`exchange_rates` y todas las funciones `SECURITY DEFINER` que hoy resuelven permisos con
`has_role` / `current_agent_id`.

**Nuevas entidades necesarias (🔵):**

| Entidad | Propósito |
| --- | --- |
| `tenants` | La agencia como unidad de aislamiento y facturación |
| `tenant_id` en cada tabla de negocio | Columna + índice compuesto + condición en cada política RLS |
| `tenant_members` | Usuario ↔ tenant ↔ rol (reemplaza el `user_roles` global) |
| `tenant_domains` | Dominio propio, verificación y certificado |
| `tenant_branding` | Logo, colores, textos y datos de contacto por tenant |
| `tenant_settings` | Numeración, monedas, idioma, reglas por defecto |
| `plans` + `subscriptions` + `usage_counters` | Plan, límites y medición del SaaS |
| `tenant_invitations` | Onboarding autoservicio e invitación de equipo |

**Riesgos:**
- Aislamiento de datos es **bloqueante**: un error en una sola política RLS expone datos entre agencias. Requiere tests automatizados de RLS por tenant, hoy inexistentes.
- Migración de los datos actuales a un tenant inicial debe ser reversible y sin pérdida de historial append-only.
- `booking_number` es global: pasa a ser único **por** tenant, con secuencia y backfill.
- Toda la lógica está en la base: cada función `SECURITY DEFINER` debe revisarse una por una para incorporar el tenant.
- Rendimiento: tablas append-only (`booking_timeline`, `communication_events`, `audit_log`) crecen sin política de retención ni índices de rendimiento.
- Marca blanca implica dominios, correos transaccionales, cuotas y observabilidad por tenant: superficie operativa nueva.

**Dependencia con versiones anteriores:** depende de la consolidación de `organizations`
(candidato natural a contraparte/tenant) y de v1.9.7 (economía multi-parte) y v1.9.8
(portal externo) para que el modelo multi-tenant tenga sentido comercial. Es la última
versión de la secuencia por diseño: hacerla antes multiplicaría el costo de cada módulo.

---

## 6. Secuencia y dependencias

```text
  v1.9.5.x ✅            v1.9.6 🔵            v1.9.7 🔵            v1.9.8 🔵         v2.0 🔵
  Expediente 360°   →   Motor tarifario  →   Comisiones reales →  Portal          →  SaaS
  pasajeros, edad       temporadas,          devengo,             proveedor,         multi-tenant
  timeline, trip        suplementos,         liquidaciones,       disponibilidad,    branding,
  state, acuerdos,      promos, cálculo      conciliación         confirmaciones,    dominios,
  simulación de         por servicio                              mensajería real    planes
  comisiones
                             │                    │                    │                │
        deuda transversal ───┴────────────────────┴────────────────────┴────────────────┘
        · unificar economía del servicio (booking_service_economics + transport_services)
        · consolidar organizations y retirar companies / providers
        · materializar trip_state para alertas e índices
        · tests automatizados, especialmente de RLS
```

Recomendación de orden: resolver la deuda transversal en paralelo a v1.9.6 y v1.9.7 —
cada versión posterior la paga más caro. La consolidación de `organizations` es
precondición práctica de v1.9.8 y de v2.0.
