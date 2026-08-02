# Visión de Producto — ViaE

> Documento estratégico de visión de producto de **ViaE Sales Hub**.
> Fecha de referencia: 2 de agosto de 2026 · Versión actual: v1.9.5.4
> Leyenda: ✅ implementado · 🟡 en desarrollo · 🔵 visión futura

## Índice

1. [¿Qué es ViaE?](#1-qué-es-viae)
2. [Problema que resuelve](#2-problema-que-resuelve)
3. [Clientes objetivo](#3-clientes-objetivo)
4. [Objetivos del producto](#4-objetivos-del-producto)
5. [Modelo de negocio](#5-modelo-de-negocio)
6. [White Label](#6-white-label)
7. [Marketplace](#7-marketplace)
8. [ERP](#8-erp)
9. [Orquestador Multiproveedor](#9-orquestador-multiproveedor)
10. [Roadmap estratégico](#10-roadmap-estratégico)

---

## 1. ¿Qué es ViaE?

**ViaE** es una plataforma turística integral que une la gestión comercial, la operación
del viaje y el ecosistema de proveedores en un solo sistema. Nace como sistema de
cotizaciones y CRM para agencias minoristas y evoluciona hacia un **orquestador
multiproveedor de marca blanca** capaz de operar todo el ciclo de vida del turismo:
desde la captación de una consulta hasta la liquidación de comisiones.

### Definición en tres capas

| Capa | Qué es | Estado |
| --- | --- | --- |
| **Núcleo** | Sistema de cotizaciones, CRM, reservas, operación, transporte y economía para una agencia (single-tenant) | ✅ |
| **ERP Turístico** | Motor tarifario, disponibilidad, itinerarios, comisiones devengadas y liquidaciones por contraparte | 🟡 |
| **Plataforma** | SaaS multiproveedor de marca blanca con marketplace integrado y orquestación de servicios entre agencias | 🔵 |

### Características esenciales

- **Aplicación web responsive** — una sola app, sin app móvil nativa.
- **Idioma español (es-AR)** — pensada para el mercado turístico argentino y regional.
- **Multimoneda explícita** — ARS/USD con tipo de cambio operativo manual y snapshots.
- **Seguridad en la base** — todo el recorte de datos lo hace Row Level Security, no el cliente.
- **Historial inmutable** — `booking_timeline`, `audit_log` y `*_history` son append-only.
- **Nunca se borra** — los registros se archivan con `record_status`.
- **Identidad visual** — blanco/beige, verde oscuro y detalles dorados.

### Posicionamiento

ViaE no es un gestor de reservas más. Es el **sistema operativo del viaje**: el lugar
donde la agencia cotiza, confirma, opera, mide y cobra, y donde los proveedores
publican disponibilidad y tarifas en un catálogo compartido. La meta es que la cadena
comercial completa del turismo deje de vivir en WhatsApp y planillas de Excel.

---

## 2. Problema que resuelve

El turismo receptivo y emisivo opera hoy con herramientas fragmentadas: la cotización
se arma a mano, la operación se coordina por WhatsApp, los costos se calculan en
planillas y las comisiones se liquidan por memoria. ViaE resuelve cada uno de estos
puntos débiles.

### Pain points por actor

| Actor | Pain point | Solución ViaE | Estado |
| --- | --- | --- | --- |
| **Agente de ventas** | Cotiza a mano, sin historial, sin branding profesional | Cotización profesional con PDF, enlace público y branding institucional | ✅ |
| **Agente de ventas** | No sabe en qué estado está cada consulta | CRM con pipeline de oportunidades, leads y embudo de conversión | ✅ |
| **Operador / Coordinador** | Coordina el viaje por WhatsApp, sin visibilidad | Expediente 360°, checklist, incidencias, agenda y panel del conductor | ✅ |
| **Administrador** | No ve costos ni márgenes por reserva | Economía por servicio, multimoneda y simulación de comisiones | ✅ / 🟡 |
| **Conductor** | Recibe asignaciones por mensaje suelto | Panel propio con estados de viaje, agenda y seguimiento | ✅ |
| **Proveedor** | Confirma disponibilidad por WhatsApp, sin registro | Portal de proveedor con calendario, tarifas y confirmaciones | 🔵 |
| **Cliente final** | Recibe un PDF y no sabe qué pasa con su viaje | Seguimiento público por token (hoy) y portal con login (futuro) | 🟡 |
| **Administrador financiero** | No sabe cuánto debe a cada agente y proveedor | Devengo y liquidación de comisiones por período | 🔵 |
| **Dueño de la agencia** | No puede escalar a múltiples marcas sin reconfigurar todo | White label y multi-tenant con dominio y branding propios | 🔵 |

### Problemas estructurales del sector que ViaE ataca

1. **Fragmentación de la cadena**: la agencia, el operador y el proveedor usan
   sistemas distintos (o ninguno). ViaE los unifica en una sola base de datos con RLS.
2. **Costos opacos**: nadie sabe el margen real por servicio porque la economía vive
   en planillas. ViaE la normaliza en `booking_service_economics`.
3. **Comisiones a ojo**: el devengo no existe; se calcula a fin de mes a mano.
   ViaE lo automatiza con el motor de comisiones (hoy en simulación 🟡).
4. **Disponibilidad no compartida**: cada proveedor maneja su cuadro en Excel.
   ViaE construye un motor de disponibilidad multiproveedor (🟡 estructura).
5. **Sin marca propia**: las agencias que usan SaaS genérico no diferencian su
   propuesta. ViaE ofrece white label con branding y dominio propio (🔵).

---

## 3. Clientes objetivo

ViaE está diseñada para todo el ecosistema turístico. Cada segmento entra al sistema
con un rol y una vista propios, y todos comparten la misma base de datos con
aislamiento por RLS.

### 3.1 Agencias minoristas

> La agencia que vende el viaje al cliente final.

| Aspecto | Detalle | Estado |
| --- | --- | --- |
| Rol principal | `admin`, `agent` | ✅ |
| Funciones core | CRM de clientes, pipeline de oportunidades, cotizaciones con PDF, enlace público, reservas y expediente 360° | ✅ |
| Necesidad clave | Cotizar rápido, darle branding al cliente y medir la conversión | ✅ |
| En el futuro | Portal del cliente con login, motor tarifario y empaquetado dinámico | 🔵 |

**Estado:** es el cliente central de ViaE hoy. El 100% de la funcionalidad
implementada sirve a la agencia minorista.

### 3.2 Agencias mayoristas

> La agencia que diseña y comercializa paquetes a las minoristas.

| Aspecto | Detalle | Estado |
| --- | --- | --- |
| Rol principal | `admin`, `agent`, `operations` | ✅ |
| Funciones core | Organizaciones, acuerdos comerciales, itinerarios plantilla, tarifas mayoristas | 🟡 |
| Necesidad clave | Publicar tarifas por temporada y composición de grupo, gestionar comisiones a minoristas | 🟡 |
| En el futuro | Marketplace con tarifa publicada, confirmaciones automáticas y liquidación a minoristas | 🔵 |

**Estado:** la estructura de `tariff_plans`, `tariff_seasons`, `itinerary_templates`
y `commercial_agreements` ya existe, pero el cálculo de tarifa por composición y la
publicación al marketplace aún no se activaron (🟡).

### 3.3 Operadores receptivos

> El operador local que recibe al turista en destino y arma el circuito.

| Aspecto | Detalle | Estado |
| --- | --- | --- |
| Rol principal | `operations`, `admin` | ✅ |
| Funciones core | Central operativa, checklist, incidencias, transporte, agenda, conductor, expediente 360° | ✅ |
| Necesidad clave | Coordinar servicios en el día, con visibilidad de estado y economía por servicio | ✅ |
| En el futuro | Confirmación de servicios por proveedor y motor de disponibilidad en destino | 🔵 |

**Estado:** la operación del viaje está cubierta. El siguiente paso es que el
proveedor confirme servicios dentro del sistema en lugar de por WhatsApp.

### 3.4 Hoteles

> El proveedor de alojamiento.

| Aspecto | Detalle | Estado |
| --- | --- | --- |
| Rol principal | `provider` | ✅ (rol existe) |
| Funciones core | Recurso de tipo alojamiento, disponibilidad y tarifas por temporada | 🟡 |
| Necesidad clave | Publicar cupos, tarifas por temporada y categorías de pasajero, y confirmar reservas | 🔵 |
| En el futuro | Calendario de disponibilidad autogestionado, confirmación de reserva y mensajería operativa | 🔵 |

**Estado:** el recurso de alojamiento existe en el catálogo y la estructura de
`service_availability` y `tariff_seasons` está lista, pero el portal del hotelero
y la confirmación automática no se desarrollaron aún (🔵).

### 3.5 Excursiones

> El proveedor de actividades y tours.

| Aspecto | Detalle | Estado |
| --- | --- | --- |
| Rol principal | `provider` | ✅ (rol existe) |
| Funciones core | Recurso de tipo excursión/actividad, itinerarios plantilla, tarifas por categoría | 🟡 |
| Necesidad clave | Publicar cupos por fecha, precio por pasajero y condición de edad (niño, infante) | 🔵 |
| En el futuro | Disponibilidad por fecha, confirmación y motor de itinerarios que ensamble excursiones | 🔵 |

**Estado:** la estructura tarifaria y de itinerarios existe, pero el cálculo de
precio por composición de grupo y la autogestión del proveedor no se activaron (🔵).

### 3.6 Transportistas

> El proveedor de transporte (transfers, circuitos, rent a car).

| Aspecto | Detalle | Estado |
| --- | --- | --- |
| Rol principal | `provider`, conductor derivado de `resources` | ✅ |
| Funciones core | Red de transporte, servicios por reserva, agenda, panel del conductor, economía de transporte | ✅ |
| Necesidad clave | Coordinar asignaciones, ver agenda y reportar estado del viaje | ✅ |
| En el futuro | Disponibilidad de flota publicada, confirmación automática y liquidación de servicios | 🔵 |

**Estado:** es el segmento más maduro después de la agencia minorista. Transporte,
agenda y conductor están completos; falta la autogestión del proveedor y la
liquidación automática (🔵).

### 3.7 Rent a car

> El proveedor de alquiler de vehículos.

| Aspecto | Detalle | Estado |
| --- | --- | --- |
| Rol principal | `provider` | ✅ (rol existe) |
| Funciones core | Recurso de tipo vehículo con subtipo rent a car, datos técnicos, extras, cobertura | ✅ |
| Necesidad clave | Disponibilidad por fecha, tarifa por día y suplementos (silla, GPS, conductor adicional) | 🟡 |
| En el futuro | Calendario de flota, tarifa dinámica por temporada y confirmación de reserva | 🔵 |

**Estado:** el catálogo de recursos ya soporta rent a car con datos técnicos
completos y extras. La estructura de `tariff_supplements` está planificada (🔵).

### 3.8 Destinos turísticos

> La entidad que gestiona un destino (ente, DMO, consorcio de proveedores).

| Aspecto | Detalle | Estado |
| --- | --- | --- |
| Rol principal | `admin` multi-tenant (🔵) | 🔵 |
| Funciones core | Catálogo de productos del destino, marketplace de proveedores locales, promoción | 🔵 |
| Necesidad clave | Centralizar la oferta de un destino y distribuirla a agencias | 🔵 |
| En el futuro | Perfil de destino, catálogo público y distribución al marketplace | 🔵 |

**Estado:** hoy ViaE maneja geografía de Argentina (provincias y localidades) en
los recursos, pero no existe la entidad "destino" como unidad de gestión ni el
marketplace de distribución. Es visión futura (🔵).

### Matriz resumen de clientes

| Segmento | Rol | Núcleo ✅ | ERP 🟡 | Plataforma 🔵 |
| --- | --- | --- | --- | --- |
| Agencias minoristas | admin, agent | ✅ | 🟡 | 🔵 |
| Agencias mayoristas | admin, agent, operations | ✅ | 🟡 | 🔵 |
| Operadores receptivos | operations, admin | ✅ | 🟡 | 🔵 |
| Hoteles | provider | 🟡 | 🔵 | 🔵 |
| Excursiones | provider | 🟡 | 🔵 | 🔵 |
| Transportistas | provider, conductor | ✅ | 🟡 | 🔵 |
| Rent a car | provider | ✅ | 🟡 | 🔵 |
| Destinos turísticos | admin multi-tenant | 🔵 | 🔵 | 🔵 |

---

## 4. Objetivos del producto

### Objetivos de corto plazo (v1.9.6 – v1.9.7)

| Objetivo | Métrica de éxito | Estado |
| --- | --- | --- |
| Activar el motor tarifario con cálculo por composición de grupo | Cotización que calcule precio según adultos/niños/infantes y temporada | 🟡 |
| Activar el devengo real de comisiones | Tabla `commissions` poblada con comisiones devengadas e idempotentes | 🔵 |
| Implementar liquidaciones por período y contraparte | Cierre mensual con totales por moneda y estado de pago | 🔵 |
| Unificar la economía del servicio | `booking_service_economics` y `transport_services` en un solo modelo | 🟡 |

### Objetivos de mediano plazo (v1.9.8 – v1.9.9)

| Objetivo | Métrica de éxito | Estado |
| --- | --- | --- |
| Portal del proveedor operativo | El proveedor confirma servicios y publica disponibilidad dentro del sistema | 🔵 |
| Envío real de comunicaciones | WhatsApp y email con estados de entrega, no solo registro | 🔵 |
| Marketplace de servicios | Tarifas y disponibilidad publicadas que cualquier agencia del sistema puede consumir | 🔵 |
| Portal del cliente final con login | El cliente ve su reserva, documentos y estado sin pedirlos | 🔵 |

### Objetivos de largo plazo (v2.0+)

| Objetivo | Métrica de éxito | Estado |
| --- | --- | --- |
| SaaS multiproveedor de marca blanca | Múltiples agencias con dominio y branding propios en un solo sistema | 🔵 |
| Aislamiento total de datos por tenant | Tests automatizados de RLS que prueben que ninguna agencia ve datos de otra | 🔵 |
| API pública para integraciones | Terceros consumen tarifas, disponibilidad y reservas por API | 🔵 |
| Orquestación automática de servicios | El sistema arma un itinerario, busca disponibilidad y cotiza sin intervención manual | 🔵 |
| Analítica y BI | Dashboard de rentabilidad por destino, proveedor y temporada | 🔵 |

### Principios rectores de los objetivos

1. **Nunca romper lo existente** — cada versión suma sin cambiar el diseño general.
2. **La lógica vive en la base** — las funciones `SECURITY DEFINER` y los triggers son
   la fuente de verdad, no el frontend.
3. **Costos y márgenes son sensibles** — visibles solo para Administrador, siempre.
4. **Multimoneda explícita** — nunca se suman monedas distintas en un total.
5. **El snapshot es inmutable** — la tarifa, el acuerdo y la comisión aplicada se
   congelan en el momento del cálculo y no se recalculan retroactivamente.

---

## 5. Modelo de negocio

### 5.1 Modelo actual (single-tenant)

Hoy ViaE opera como un sistema interno de **una sola agencia**. No hay modelo de
facturación SaaS activo: es un producto a medida para una agencia.

| Dimensión | Estado | Detalle |
| --- | --- | --- |
| Producto | ✅ | Cotizaciones + CRM + operación + transporte |
| Facturación | 🔵 | No existe billing por tenant |
| Planes | 🔵 | No hay planes ni límites de uso |
| Monetización | 🔵 | No definida todavía |

### 5.2 Modelo objetivo (SaaS multiproveedor)

La visión de negocio es vender ViaE como **SaaS turístico de marca blanca** a
múltiples agencias, con planes por nivel de uso y un marketplace que genera
transacción entre proveedores y agencias.

#### Fuentes de ingresos planificadas

| Fuente | Modelo | Estado |
| --- | --- | --- |
| **Suscripción SaaS** | Plan mensual/anual por agencia (tenant), con límites de usuarios y reservas | 🔵 |
| **Marketplace / transacción** | Comisión por reservas confirmadas a través del marketplace de proveedores | 🔵 |
| **White Label premium** | Recargo por dominio propio, branding avanzado y soporte prioritario | 🔵 |
| **Integraciones / API** | Acceso a la API pública con límite por plan | 🔵 |
| **Servicios profesionales** | Implementación, migración de datos y personalización | 🔵 |

#### Planes tentativos

| Plan | Orientado a | Límites (propuesta) | Estado |
| --- | --- | --- | --- |
| **Starter** | Agencia minorista pequeña | Hasta 3 usuarios, cotizaciones ilimitadas, 1 marca | 🔵 |
| **Pro** | Agencia minorista mediana | Hasta 10 usuarios, CRM completo, transporte, 1 marca | 🔵 |
| **Business** | Mayorista / operador receptivo | Usuarios ilimitados, marketplace, comisiones, multi-marca | 🔵 |
| **Enterprise** | DMO / consorcio / cadena | Multi-tenant, API, SLA, onboarding dedicado | 🔵 |

> Todos los valores son propuestas. La facturación real depende de la activación
> del multi-tenant y de la integración con una pasarela de pagos.

### 5.3 Economía del marketplace

El marketplace es la pieza de monetización más ambiciosa. Cuando un proveedor
(hotel, excursión, rent a car) publica disponibilidad y una agencia la consume, ViaE
cobra una transacción sobre la reserva confirmada.

| Concepto | Estado | Detalle |
| --- | --- | --- |
| Publicación de tarifa por proveedor | 🟡 | Estructura lista, sin publicación al marketplace |
| Búsqueda de disponibilidad | 🔵 | Motor de disponibilidad en estructura, sin búsquedas reales |
| Reserva desde el marketplace | 🔵 | No existe checkout de marketplace |
| Comisión de transacción ViaE | 🔵 | No definida |
| Liquidación al proveedor | 🔵 | Depende de v1.9.7 (liquidaciones) |

---

## 6. White Label

El **White Label** es la capacidad de que cada agencia (tenant) use ViaE con su
propia marca, su propio dominio y su propia configuración, sin ver a las demás.

### 6.1 Estado actual

| Capacidad | Estado | Detalle |
| --- | --- | --- |
| Branding institucional | ✅ | Logo, colores y datos de contacto persisten en `company_settings` |
| Dominio personalizado | 🟡 | Dominio custom configurado, pero global (un solo tenant) |
| Aislamiento de datos | 🔵 | No hay `tenant_id`; RLS no separa agencias |
| Multi-marca | 🔵 | `company_settings` es una fila global |
| Numeración por tenant | 🔵 | `booking_number` es global |

### 6.2 Visión White Label

| Capacidad | Estado |
| --- | --- |
| Cada tenant tiene dominio propio (ej. `ventas.agencia.com`) | 🔵 |
| Branding independiente: logo, colores, tipografía, textos | 🔵 |
| Numeración de reservas por tenant (VIA-XX-000001) | 🔵 |
| Configuración de monedas, idioma y reglas comerciales propias | 🔵 |
| Usuarios y roles aislados por tenant | 🔵 |
| Plan y límites de uso por tenant | 🔵 |

### 6.3 Dependencias técnicas

- **`tenants` table** — la agencia como unidad de aislamiento y facturación. 🔵
- **`tenant_id` en cada tabla de negocio** — columna + índice compuesto + condición en
  cada política RLS. 🔵
- **`tenant_members`** — reemplaza el `user_roles` global. 🔵
- **`tenant_domains`** — dominio propio, verificación y certificado. 🔵
- **`tenant_branding`** — logo, colores y textos por tenant. 🔵
- **`tenant_settings`** — numeración, monedas, idioma y reglas. 🔵

### 6.4 Riesgo crítico

> Un error en una sola política RLS expone datos entre agencias. El White Label
> **requiere** tests automatizados de RLS por tenant, hoy inexistentes. Es la
> precondición técnica no negociable de v2.0.

---

## 7. Marketplace

El **Marketplace** es el espacio donde los proveedores publican servicios, tarifas y
disponibilidad, y las agencias los consumen para armar sus cotizaciones y reservas.

### 7.1 Estado actual

| Capacidad | Estado | Detalle |
| --- | --- | --- |
| Catálogo de recursos | ✅ | Recursos operativos con clasificación y subtipos |
| Catálogo de proveedores | 🟡 | `organizations` conviven con `providers` legado |
| Tarifas publicadas | 🟡 | `tariff_plans` y `tariff_seasons` existen sin cálculo |
| Disponibilidad publicada | 🟡 | `service_availability` existe sin autogestión del proveedor |
| Búsqueda de servicios | 🔵 | No existe buscador de marketplace |
| Reserva desde el marketplace | 🔵 | No existe checkout de marketplace |
| Confirmación por proveedor | 🔵 | El proveedor no confirma dentro del sistema |

### 7.2 Visión Marketplace

| Capacidad | Estado |
| --- | --- |
| El proveedor publica su catálogo de servicios con tarifa y disponibilidad | 🔵 |
| La agencia busca servicios por destino, fecha y composición de grupo | 🔵 |
| El sistema ensambla un itinerario con servicios de múltiples proveedores | 🔵 |
| El proveedor confirma o rechaza la reserva dentro del sistema | 🔵 |
| ViaE cobra una transacción sobre la reserva confirmada | 🔵 |
| El proveedor ve lo que se le debe y cobra vía liquidación | 🔵 |

### 7.3 Flujo objetivo del marketplace

```text
  Proveedor publica            Agencia busca              Sistema ensambla
  tarifa + cupo     ──────►    por destino/fecha  ──────►  itinerario con
  en el catálogo               y composición              múltiples proveedores
        │                                                      │
        │                                                      ▼
        │                                          Agencia cotiza/reserva
        │                                                      │
        ▼                                                      ▼
  Proveedor confirma      ◄────── Sistema notifica      ◄── Reserva creada
  o rechaza en el sistema         al proveedor              con snapshot de tarifa
```

### 7.4 Dependencias

- Requiere la consolidación de `organizations` (🟡 pendiente) para que "el proveedor"
  sea inequívoco.
- Requiere el motor tarifario activo (v1.9.6) para que la tarifa publicada sea aplicable.
- Requiere el motor de disponibilidad activo (v1.9.7) para que el cupo sea consultable.
- Requiere liquidaciones (v1.9.7) para que el proveedor cobre lo que se le debe.

---

## 8. ERP

El **ERP Turístico** es la capa de gestión económica y operativa que convierte a ViaE
de un sistema de cotizaciones en un sistema de gestión empresarial del turismo.

### 8.1 Estado actual

| Módulo ERP | Estado | Detalle |
| --- | --- | --- |
| CRM comercial | ✅ | Clientes, leads, oportunidades, agentes |
| Gestión de reservas | ✅ | Expediente 360°, servicios, pasajeros, timeline |
| Operación del viaje | ✅ | Checklist, incidencias, agenda, conductor |
| Transporte | ✅ | Red, servicios por reserva, economía de transporte |
| Multimoneda | ✅ | ARS/USD con `rate_at()` y snapshots |
| Acuerdos comerciales | ✅ | `commercial_agreements` con reglas versionadas |
| Economía por servicio | ✅ | `booking_service_economics` inmutable |
| Comisiones (simulación) | 🟡 | `resolve_agreement` + `compute_commission` al vuelo |
| Motor tarifario (estructura) | 🟡 | `tariff_plans`/`seasons`/`rules` sin cálculo |
| Motor de disponibilidad (estructura) | 🟡 | `service_availability` sin búsquedas |
| Motor de itinerarios (estructura) | 🟡 | `itinerary_templates` sin generación |
| Devengo de comisiones | 🔵 | `commissions` vacía por diseño |
| Liquidaciones | 🔵 | No existe cierre por período |
| Conciliación de pagos | 🔵 | No existe |
| Inventario / cupos | 🔵 | Solo `resource_availability_log` interno |
| Compras a proveedores | 🔵 | No existe orden de compra |

### 8.2 Visión ERP

| Módulo ERP | Estado | Visión |
| --- | --- | --- |
| Motor tarifario | 🔵 | Cálculo automático de tarifa por composición, temporada y suplemento |
| Devengo de comisiones | 🔵 | `accrue_commission()` idempotente que escribe en `commissions` |
| Liquidaciones | 🔵 | Cierre por período y contraparte, con totales por moneda y estado de pago |
| Conciliación | 🔵 | Vínculo entre cobro registrado y movimiento esperado |
| Inventario | 🔵 | Gestión de cupos por recurso y fecha, con bloqueos y overbooking controlado |
| Compras | 🔵 | Orden de compra a proveedor con recepción y factura |
| Analítica | 🔵 | Rentabilidad por destino, proveedor, agente y temporada |

### 8.3 Principio del ERP turístico

> El ERP no reemplaza al CRM ni a la operación: los **unifica**. La cotización, la
> reserva, la operación y la economía dejan de ser módulos sueltos y pasan a ser
> capas de un mismo registro: el **Expediente de Viaje 360°**.

---

## 9. Orquestador Multiproveedor

El **Orquestador Multiproveedor** es la pieza que distingue a ViaE de un ERP
turístico genérico: la capacidad de coordinar servicios de múltiples proveedores
(hotel, transfer, excursión, rent a car, guía) en un solo itinerario, con
disponibilidad y tarifa verificadas en tiempo real.

### 9.1 Estado actual

| Capacidad | Estado | Detalle |
| --- | --- | --- |
| Reserva con múltiples servicios | ✅ | `booking_services` por reserva |
| Transporte con economía propia | ✅ | `transport_services` por reserva |
| Asignación manual de recursos | ✅ | El operador asigna recursos a mano |
| Expediente 360° con timeline | ✅ | El viaje completo en una vista |
| Motor de itinerarios (estructura) | 🟡 | `itinerary_templates`/`items`/`rules` sin generación |
| Motor de disponibilidad (estructura) | 🟡 | `service_availability` sin búsquedas |
| Orquestación automática | 🔵 | El sistema no arma itinerarios ni busca disponibilidad |
| Empaquetado dinámico | 🔵 | No se ensamblan paquetes automáticamente |
| Recomendaciones | 🔵 | No hay motor de recomendación |

### 9.2 Visión del Orquestador

| Capacidad | Estado |
| --- | --- |
| El agente define destino, fechas y composición de grupo | 🔵 |
| El sistema busca disponibilidad en todos los proveedores del catálogo | 🔵 |
| El sistema ensambla un itinerario con servicios compatibles | 🔵 |
| El sistema calcula tarifa por servicio con snapshot inmutable | 🔵 |
| El sistema cotiza el paquete completo con un solo clic | 🔵 |
| El sistema reserva y notifica a cada proveedor automáticamente | 🔵 |
| El sistema confirma o rechaza por proveedor y reemplaza si rechaza | 🔵 |

### 9.3 Arquitectura del Orquestador

```text
                          ┌─────────────────────┐
                          │   Búsqueda / Orquest│
                          │  (entrada del agente)│
                          └──────────┬──────────┘
                                     │
          ┌──────────────┬───────────┼───────────┬──────────────┐
          ▼              ▼             ▼           ▼              ▼
   ┌─────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ Motor        │ │ Motor de │ │ Motor de │ │ Motor de │ │ Motor de │
   │ Tarifario    │ │ Disponib.│ │ Itinerar.│ │ Acuerdos │ │ Comision.│
   │ (precio)     │ │ (cupos)  │ │ (armado) │ │ (reglas) │ │ (devengo)│
   └──────┬───────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
          │              │            │            │            │
          └──────────────┴──────┬─────┴────────────┴────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │  Expediente de Viaje 360° │
                    │  (reserva + economía +    │
                    │   timeline + operación)  │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │  Liquidación por         │
                    │  contraparte (proveedor, │
                    │  agente, operador)       │
                    └─────────────────────────┘
```

### 9.4 Motores que componen el Orquestador

| Motor | Función | Estado |
| --- | --- | --- |
| Motor Tarifario | Calcula precio por composición, temporada y suplemento | 🟡 estructura |
| Motor de Disponibilidad | Consulta cupos por servicio y fecha | 🟡 estructura |
| Motor de Itinerarios | Ensambla servicios compatibles en un itinerario | 🟡 estructura |
| Motor de Acuerdos | Resuelve el acuerdo comercial aplicable por score | ✅ |
| Motor de Comisiones | Calcula comisión por servicio y regla | 🟡 simulación |
| Motor de Búsqueda | Busca servicios en el catálogo por criterios | 🔵 |
| Motor de Recomendaciones | Sugiere servicios por destino y perfil | 🔵 |
| Motor de Empaquetado Dinámico | Ensambia paquetes con precio dinámico | 🔵 |
| Motor de Inventario | Gestiona cupos y bloqueos por recurso | 🔵 |

> Los motores con estructura (Tarifario, Disponibilidad, Itinerarios) ya tienen
> tablas, enums, RLS y tipos en `src/lib/`, pero **sin lógica de cálculo ni
> búsqueda**. Son la base sobre la que se construirá el Orquestador.

---

## 10. Roadmap estratégico

### 10.1 Línea de tiempo por versión

```text
  v1.9.5.x ✅          v1.9.6 🟡          v1.9.7 🔵          v1.9.8 🔵         v2.0 🔵
  ──────────────────────────────────────────────────────────────────────────────────►
  Expediente 360°  →  Motor tarifario →  Economía y     →  Ecosistema    →  SaaS
  pasajeros, edad     activo (precio      liquidaciones     proveedores:      multiproveedor
  timeline, trip      por composición)    devengo real,      portal,            marca blanca
  state, acuerdos,    suplementos,        liquidaciones,    disponibilidad,    dominios,
  simulación de        promos              conciliación      confirmaciones,    planes,
  comisiones                                                  mensajería real    API
```

### 10.2 Estado por versión

| Versión | Alcance | Estado |
| --- | --- | --- |
| 0.1–0.8 | Auth, dashboard, cotizaciones, CRM, pipeline, agentes, consolidación | ✅ |
| 1.0–1.5 | Recursos, transporte, conductor, agenda, notificaciones, comunicación | ✅ |
| 1.6–1.8.2 | Economía de transporte, leads, operación, checklist, catálogo de recursos | ✅ |
| 1.9–1.9.2 | Proveedores, organizaciones, acuerdos comerciales | ✅ |
| 1.9.3 A | Normalización económica (`booking_service_economics`, `rate_at`) | ✅ |
| 1.9.4 A | Motor de comisiones en simulación | 🟡 |
| 1.9.5 F1–4 | Expediente 360°, pasajeros, timeline, trip state, capa visual | ✅ |
| 1.9.6 F0 | Motor tarifario — estructura base (tablas, enums, RLS) | 🟡 |
| 1.9.6 | Motor tarifario — cálculo por composición y temporada | 🔵 |
| 1.9.7 F0 | Motor de disponibilidad — estructura base | 🟡 |
| 1.9.7 | Motor de disponibilidad — búsquedas reales | 🔵 |
| 1.9.7 | Economía y liquidaciones — devengo y cierre por período | 🔵 |
| 1.9.8 | Ecosistema de proveedores — portal, disponibilidad, confirmaciones | 🔵 |
| 1.9.9 | Marketplace — publicación, búsqueda, reserva y transacción | 🔵 |
| 2.0 | SaaS multiproveedor — multi-tenant, white label, API pública | 🔵 |
| 2.1+ | Orquestador — empaquetado dinámico, recomendaciones, analítica | 🔵 |

### 10.3 Deuda transversal a resolver en paralelo

La deuda técnica no se resuelve al final: se paga en paralelo a cada versión, porque
cada versión posterior la encarece.

| Deuda | Impacto | Cuándo resolverla |
| --- | --- | --- |
| Unificar economía del servicio (`booking_service_economics` + `transport_services`) | El Orquestador calcula dos veces si no se unifica | Antes de v1.9.6 cálculo |
| Consolidar `organizations` y retirar `companies`/`providers` | El marketplace necesita un proveedor inequívoco | Antes de v1.9.8 |
| Materializar `trip_state` en `bookings` | Las bandejas y alertas consumen la función derivada | En paralelo a v1.9.6 |
| Tests automatizados de RLS | El multi-tenant no es seguro sin ellos | Antes de v2.0 |
| Envío real de comunicaciones | El portal del proveedor no funciona sin mensajería | En v1.9.8 |

### 10.4 Secuencia de dependencias

```text
  v1.9.5.x ✅              v1.9.6 🟡                v1.9.7 🔵              v1.9.8 🔵           v2.0 🔵
  ──────────────────────────────────────────────────────────────────────────────────────────►
  Expediente 360°      →   Motor tarifario     →   Economía y        →  Ecosistema     →  SaaS
  (pasajeros, edad,        activo                  liquidaciones       proveedores        multi-tenant
   timeline, trip          [requiere unificar      [requiere tarifas   [requiere orgs     [requiere
   state, comisiones        economía del servicio]  consistentes]       consolidadas]      portal +
   en simulación)                                                                              marketplace]
          │
          └──► Deuda transversal (unificar economía, consolidar organizations,
               materializar trip_state, tests de RLS) se resuelve en paralelo
```

### 10.5 Hitos de negocio

| Hito | Qué habilita | Versión | Estado |
| --- | --- | --- | --- |
| Cotización automática por composición de grupo | El agente no calcula precio a mano | v1.9.6 | 🔵 |
| Comisión devengada real | El dueño sabe cuánto debe a cada contraparte | v1.9.7 | 🔵 |
| Portal del proveedor | El proveedor trabaja dentro del sistema | v1.9.8 | 🔵 |
| Marketplace activo | Transacción entre agencia y proveedor dentro de ViaE | v1.9.9 | 🔵 |
| White Label | Cada agencia tiene su marca y dominio | v2.0 | 🔵 |
| Orquestador | El sistema arma el itinerario solo | v2.1+ | 🔵 |

---

## Cierre

ViaE nació como un sistema de cotizaciones y creció hasta convertirse en el sistema
operativo del viaje. La visión no es agregar más pantallas: es que la cadena
comercial completa del turismo —desde la consulta del cliente hasta la liquidación
del proveedor— viva en un solo registro, con seguridad en la base, historial
inmutable y multimoneda explícita.

El camino es claro: activar los motores que ya tienen estructura (tarifario,
disponibilidad, itinerarios), devengar comisiones reales, abrir el portal del
proveedor, encender el marketplace y, finalmente, convertir el sistema en SaaS de
marca blanca. Cada paso se apoya en el anterior y la deuda transversal se paga en
paralelo, no al final.

> **ViaE — El sistema operativo del viaje.**
