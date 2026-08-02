# Arquitectura SaaS — ViaE

> Cómo una **única instalación** de ViaE Sales Hub puede servir a cientos de empresas
> turísticas con aislamiento total de datos, marca propia y un marketplace compartido.
> Fecha de referencia: 2 de agosto de 2026 · Versión actual: v1.9.5.4
> Leyenda: ✅ implementado · 🟡 en desarrollo · 🔵 planificado

## Índice

1. [Visión de la arquitectura](#1-visión-de-la-arquitectura)
2. [Core compartido vs. datos por empresa](#2-core-compartido-vs-datos-por-empresa)
3. [Tenant: la unidad de aislamiento](#3-tenant-la-unidad-de-aislamiento)
4. [White Label y branding independiente](#4-white-label-y-branding-independiente)
5. [Dominios propios](#5-dominios-propios)
6. [Usuarios](#6-usuarios)
7. [Roles](#7-roles)
8. [Organizaciones](#8-organizaciones)
9. [Proveedores](#9-proveedores)
10. [Inventario](#10-inventario)
11. [Tarifas](#11-tarifas)
12. [Disponibilidad](#12-disponibilidad)
13. [Itinerarios](#13-itinerarios)
14. [Comisiones](#14-comisiones)
15. [API futura](#15-api-futura)
16. [Diagrama de arquitectura](#16-diagrama-de-arquitectura)
17. [Matriz de propiedad](#17-matriz-de-propiedad)
18. [Riesgos y mitigaciones](#18-riesgos-y-mitigaciones)

---

## 1. Visión de la arquitectura

### El principio fundamental

ViaE es **una sola aplicación** desplegada **una sola vez**, que sirve a múltiples
empresas (tenants) simultáneamente. No hay una base de datos ni un servidor por
cliente: hay **una base de datos compartida** donde cada fila de negocio lleva la
marca de su empresa y Row Level Security garantiza que ninguna empresa vea los
datos de otra.

> **Una instalación, cientos de empresas.** El aislamiento no lo hace la infraestructura,
> lo hace la base de datos con `tenant_id` en cada tabla y RLS en cada política.

### Las tres capas del sistema

| Capa | Qué es | Compartido o por empresa | Estado |
| --- | --- | --- | --- |
| **Infraestructura** | Aplicación web, servidor, base de datos, storage, realtime | Compartido (una instancia) | ✅ |
| **Core de negocio** | Tablas, funciones, triggers, RLS, tipos, módulos de dominio | Compartido (mismo código) | ✅ |
| **Datos de negocio** | Cotizaciones, reservas, clientes, recursos, tarifas, etc. | Por empresa (aislado por `tenant_id`) | 🔵 |

Hoy la infraestructura y el core están completos, pero **no existe `tenant_id`**: el
sistema es single-tenant. La arquitectura SaaS describe cómo se transforma el core
compartido en multi-tenant sin reescribir la lógica de negocio.

### Estado actual vs. objetivo

| Dimensión | Hoy (single-tenant) | Objetivo (SaaS multi-tenant) | Estado |
| --- | --- | --- | --- |
| Instalaciones | 1 | 1 (sirve a todas) | ✅ |
| Bases de datos | 1 | 1 | ✅ |
| `tenant_id` en tablas | No existe | En cada tabla de negocio | 🔵 |
| RLS por empresa | No (solo por rol) | Por rol **y** por empresa | 🔵 |
| Branding | Global (una fila) | Por empresa | 🔵 |
| Dominio | Uno (custom global) | Uno por empresa | 🔵 |
| Numeración de reservas | Global (VIA-AA-000001) | Por empresa (VIA-XX-000001) | 🔵 |
| Usuarios y roles | Globales | Por empresa | 🔵 |
| Marketplace | No existe | Compartido entre empresas | 🔵 |

---

## 2. Core compartido vs. datos por empresa

La pregunta central de la arquitectura SaaS es: **¿qué es de la plataforma y qué es
de cada empresa?** La regla es simple — si afecta a la lógica o al código, es
compartido; si es un dato de negocio, pertenece a una empresa.

### 2.1 Lo que comparte toda la plataforma (core compartido)

Todo lo siguiente es **idéntico para todas las empresas** y vive en la única
instalación:

| Componente | Por qué es compartido | Estado |
| --- | --- | --- |
| Aplicación web (frontend) | Mismo código de React/TS, mismo bundle | ✅ |
| Servidor (worker/edge) | Mismo runtime, mismas server functions | ✅ |
| Base de datos Postgres | Un solo esquema `public` | ✅ |
| Funciones `SECURITY DEFINER` / `STABLE` | La lógica de negocio es la misma para todos | ✅ |
| Triggers | Los timelines, la inmutabilidad y la auditoría funcionan igual | ✅ |
| Enums (`app_role`, `commission_status`, ...) | Los tipos y estados son del core | ✅ |
| Catálogo geográfico (provincias, localidades) | Geografía de Argentina, compartida | ✅ |
| Categorías de pasajero por defecto | `DEFAULT_PASSENGER_CATEGORIES` | ✅ |
| Tipos de recurso y subtipos | Catálogo inteligente de recursos | ✅ |
| Bucket de Storage | Un bucket para todas las imágenes | ✅ |
| Pasarela de autenticación | Lovable Cloud Auth (un proyecto Supabase) | ✅ |

### 2.2 Lo que pertenece a cada empresa (datos por tenant)

Todo lo siguiente lleva `tenant_id` y solo es visible para la empresa propietaria:

| Dato | Pertenece a | Estado |
| --- | --- | --- |
| Clientes (CRM) | La empresa que los creó | 🔵 |
| Leads y oportunidades | La empresa que los recibió | 🔵 |
| Cotizaciones | La empresa que las emitió | 🔵 |
| Reservas y expediente 360° | La empresa que las confirmó | 🔵 |
| Servicios de reserva | La empresa de la reserva | 🔵 |
| Economía de servicios | La empresa de la reserva | 🔵 |
| Pasajeros | La empresa de la reserva | 🔵 |
| Timeline de reserva | La empresa de la reserva | 🔵 |
| Pagos y documentos | La empresa de la reserva | 🔵 |
| Agentes | La empresa que los empleó | 🔵 |
| Recursos operativos | La empresa que los registró | 🔵 |
| Transporte y servicios de transporte | La empresa que los creó | 🔵 |
| Acuerdos comerciales | La empresa que los firmó | 🔵 |
| Comisiones | La empresa que las devengó | 🔵 |
| Notificaciones | La empresa del usuario destinatario | 🔵 |
| Configuración (settings) | La empresa | 🔵 |
| Branding (logo, colores, textos) | La empresa | 🔵 |
| Usuarios y roles | La empresa que los invitó | 🔵 |
| Tipos de cambio | La empresa (o compartido por plan) | 🔵 |
| Numeración de reservas | La empresa (secuencia propia) | 🔵 |

### 2.3 La zona gris: el marketplace

El marketplace es la única zona donde los datos **cruzan la frontera del tenant**.
Cuando un proveedor publica una tarifa, esa tarifa debe ser visible para las agencias
que la quieren consumir — pero solo la versión "publicada", no los costos ni los
márgenes del proveedor.

| Dato del marketplace | Visible para | Estado |
| --- | --- | --- |
| Catálogo publicado (servicio, destino, categoría) | Todas las agencias | 🔵 |
| Tarifa publicada | Todas las agencias (precio venta, no costo) | 🔵 |
| Disponibilidad publicada | Todas las agencias | 🔵 |
| Costo y margen del proveedor | Solo el proveedor y el admin del proveedor | 🔵 |
| Confirmación de reserva | El proveedor y la agencia que reservó | 🔵 |
| Liquidación al proveedor | Solo el proveedor y el admin de cada parte | 🔵 |

> El marketplace es un **puente controlado**: publica una vista pública del catálogo
> pero el dato sensible nunca cruza. Es la pieza más delicada del SaaS.

---

## 3. Tenant: la unidad de aislamiento

### 3.1 Qué es un tenant

Un **tenant** es una empresa turística que usa ViaE: una agencia minorista, una
mayorista, un operador receptivo, un hotel, una excursión, un transportista, un rent
a car o un destino. Cada tenant tiene sus usuarios, sus datos, su marca y su dominio,
y no puede ver los datos de ningún otro tenant.

### 3.2 Modelo de aislamiento

El aislamiento se implementa en **tres capas** que se refuerzan entre sí:

```text
  Capa 1 — Columna:     cada tabla de negocio lleva tenant_id (NOT NULL)
  Capa 2 — Índice:      índice compuesto (tenant_id, ...) para rendimiento
  Capa 3 — RLS:         cada política incluye AND tenant_id = current_tenant()
```

Ninguna capa por sí sola basta. La columna asegura que el dato existe; el índice
asegura que la consulta es rápida; la RLS asegura que la base rechaza cualquier
lectura o escritura fuera del tenant del usuario, **incluso si el cliente la pide**.

### 3.3 Función `current_tenant()`

El núcleo del aislamiento es una función `current_tenant()` que devuelve el `tenant_id`
del usuario autenticado, consultando `tenant_members` por `auth.uid()`. Todas las
políticas RLS la usan en lugar de hardcodear el tenant.

```sql
-- Concepto (no es código de producción)
current_tenant() → uuid
  SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid()
```

> Esta función debe ser `STABLE` y `SECURITY DEFINER` para evitar recursión, igual que
> `has_role()` hoy. No se inventa aquí: se replica el patrón ya probado del sistema
> single-tenant actual.

### 3.4 Reglas del tenant_id

1. **NOT NULL** en cada tabla de negocio: no puede existir un dato sin empresa.
2. **Inmutable**: una vez asignado, no se cambia (migrar entre tenants es una operación
   administrativa controlada, no un UPDATE común).
3. **Índice compuesto**: `(tenant_id, id)` como índice primario de búsqueda.
4. **En cada política RLS**: `USING (tenant_id = current_tenant())` o equivalente.
5. **En cada función `SECURITY DEFINER`**: la función recibe o deriva el tenant_id,
   nunca lo asume del contexto del caller sin validar.

### 3.5 Estado actual

| Aspecto | Estado | Detalle |
| --- | --- | --- |
| Tabla `tenants` | 🔵 | No existe |
| Columna `tenant_id` | 🔵 | No existe en ninguna tabla de negocio |
| Función `current_tenant()` | 🔵 | No existe |
| `tenant_members` | 🔵 | No existe; hoy `user_roles` es global |
| RLS por tenant | 🔵 | Las políticas filtran por rol, no por empresa |
| Numeración por tenant | 🔵 | `booking_number` es global |

---

## 4. White Label y branding independiente

### 4.1 Qué es el White Label

El White Label es la capacidad de que cada empresa use ViaE con **su propia marca**:
su logo, sus colores, sus textos, su dominio y su identidad visual, sin que el
usuario final sepa que la plataforma es ViaE.

### 4.2 Estado actual

| Capacidad | Estado | Detalle |
| --- | --- | --- |
| Logo institucional | ✅ | Se sube y persiste en `company_settings` |
| Colores institucionales | ✅ | Verde/beige/dorado configurables |
| Datos de contacto | ✅ | Se muestran en cotización pública y PDF |
| Branding en PDF | ✅ | `print-color-adjust: exact` para fidelidad |
| Branding en enlace público | ✅ | `/cotizacion/$token` respeta el branding |
| Footer "Desarrollado por MarCa Growth" | ✅ | Solo en pantallas internas, nunca en cotizaciones ni PDF |
| Branding por empresa | 🔵 | `company_settings` es una fila global, no por tenant |

### 4.3 Visión White Label multi-tenant

| Capacidad | Estado | Detalle |
| --- | --- | --- |
| `tenant_branding` por empresa | 🔵 | Logo, colores, tipografía, textos propios |
| Tema de la app por empresa | 🔵 | La app lee el branding del tenant al cargar |
| Branding en el PDF | 🔵 | Cada PDF lleva la marca de la empresa emisora |
| Branding en el enlace público | 🔵 | Cada cotización pública lleva la marca del tenant |
| Branding en el email | 🔵 | Plantillas transaccionales con marca del tenant |
| Branding en el portal del cliente | 🔵 | El cliente final ve la marca de la agencia |

### 4.4 Cómo se sirve el branding correcto

El branding se resuelve en **tiempo de carga**, no en tiempo de build:

```text
  1. El usuario entra por un dominio (ej. ventas.agencia-a.com)
  2. La app resuelve el dominio → tenant_id (tabla tenant_domains)
  3. La app carga tenant_branding del tenant resuelto
  4. La app aplica el tema (colores, logo, textos) antes del primer render
  5. El usuario ve la marca de su agencia, no la de ViaE
```

> El branding se carga **antes** del primer render para evitar parpadeo de marca. Si
> no se resuelve el tenant, se muestra un branding genérico de ViaE como fallback.

### 4.5 Reglas de branding

1. El branding del tenant **no afecta** a otros tenants: es un dato aislado.
2. El branding **nunca** expone costos ni márgenes (es solo visual).
3. El footer "Desarrollado por MarCa Growth" es de la plataforma, no del tenant:
   aparece solo en pantallas internas y **nunca** en cotizaciones públicas ni PDFs.
4. El plan del tenant puede limitar el nivel de branding (ej. Starter = logo
   predeterminado, Enterprise = branding total).

---

## 5. Dominios propios

### 5.1 Estado actual

| Capacidad | Estado | Detalle |
| --- | --- | --- |
| Dominio custom global | ✅ | `sales.viaetravel.com` configurado |
| Dominio por empresa | 🔵 | No existe; un dominio sirve a todo el sistema |
| SSL automático | ✅ | Lovable aprovisiona el certificado |
| Subdominios | 🔵 | No se gestionan por tenant |

### 5.2 Visión de dominios por tenant

| Capacidad | Estado | Detalle |
| --- | --- | --- |
| `tenant_domains` | 🔵 | Tabla que vincula dominio ↔ tenant |
| Dominio principal por empresa | 🔵 | `ventas.agencia-a.com` → tenant A |
| Subdominio por empresa | 🔵 | `a.viae.app` como dominio gratuito de cortesía |
| SSL automático por dominio | 🔵 | Un certificado por dominio de tenant |
| Redirección al dominio primario | 🔵 | Si hay varios, el secundario redirige al primario |
| Verificación de propiedad | 🔵 | Registro TXT o verificación DNS |

### 5.3 Resolución de dominio → tenant

```text
  Petición HTTP (Host: ventas.agencia-a.com)
         │
         ▼
  Lookup en tenant_domains WHERE domain = 'ventas.agencia-a.com'
         │
         ├── encontrado → tenant_id = A → carga branding A
         │
         └── no encontrado → fallback a dominio de la plataforma (viae.app)
                             o página de "tenant no encontrado"
```

### 5.4 Reglas de dominios

1. Un dominio pertenece a **un solo tenant** a la vez.
2. Un tenant puede tener **varios dominios** (uno primario, el resto redirigen).
3. El dominio se **verifica** antes de activarse (TXT record o DNS check).
4. El SSL se **aprovisiona automáticamente** al verificar el dominio.
5. Si el tenant cancela, el dominio se **libera** y puede reasignarse tras un período
   de gracia.

---

## 6. Usuarios

### 6.1 Estado actual

| Aspecto | Estado | Detalle |
| --- | --- | --- |
| Autenticación | ✅ | Email/contraseña via Lovable Cloud Auth |
| Cuentas pendientes | ✅ | `account_status = pending` hasta aprobación del admin |
| Aprobación manual | ✅ | El admin aprueba/rechaza/activa/desactiva |
| Último admin protegido | ✅ | Trigger impide quitar el rol al último administrador |
| Recuperación de admin | ✅ | `AdminRecovery` de emergencia |
| Sin registro libre | ✅ | No hay signup público |
| Usuarios por tenant | 🔵 | Hoy los usuarios son globales, no por empresa |

### 6.2 Visión multi-tenant

| Aspecto | Estado | Detalle |
| --- | --- | --- |
| `tenant_members` | 🔵 | Usuario ↔ tenant ↔ rol (reemplaza `user_roles` global) |
| Un usuario en varios tenants | 🔵 | Un agente puede trabajar para dos agencias |
| Onboarding autoservicio | 🔵 | El admin del tenant invita a su equipo |
| Invitaciones por email | 🔵 | `tenant_invitations` con token de un solo uso |
| Aprobación por tenant | 🔵 | Cada tenant aprueba a sus propios usuarios |
| Límite de usuarios por plan | 🔵 | Starter = 3, Pro = 10, Business = ilimitados |

### 6.3 Modelo de usuario multi-tenant

```text
  auth.users (compartido — un solo pool de identidades)
       │
       │  1:N
       ▼
  tenant_members (puente — un usuario puede estar en varios tenants)
       │  user_id, tenant_id, role
       │
       ├── tenant A → rol: admin
       ├── tenant B → rol: agent
       └── tenant C → rol: provider
```

> Un usuario es una **identidad** compartida, pero su **rol** es por tenant. El mismo
> agente puede ser admin en una agencia y agente en otra, sin crear dos cuentas.

---

## 7. Roles

### 7.1 Estado actual

| Rol | Origen | Estado |
| --- | --- | --- |
| `admin` | `user_roles` + `has_role(uid,'admin')` | ✅ |
| `agent` | `user_roles` + `agents.user_id` | ✅ |
| `operations` | `user_roles` + `is_operations(uid)` | ✅ |
| `provider` | `user_roles` + organización/proveedor asociado | ✅ |
| Conductor | Derivado de `resources` (`is_driver`) | ✅ |

Los roles hoy son **globales**: un usuario tiene un rol para todo el sistema, no por
empresa.

### 7.2 Visión multi-tenant

| Rol | Ámbito | Estado | Detalle |
| --- | --- | --- | --- |
| `admin` | Por tenant | 🔵 | Admin de **una** empresa, no de la plataforma |
| `agent` | Por tenant | 🔵 | Agente de una empresa, ve solo sus clientes |
| `operations` | Por tenant | 🔵 | Operador de una empresa |
| `provider` | Por tenant | 🔵 | Proveedor asociado a una organización |
| Conductor | Por tenant | 🔵 | Conductor de los recursos de una empresa |
| `platform_admin` | Global | 🔵 | Staff de ViaE (soporte, facturación) — nuevo |

### 7.3 Jerarquía de roles

```text
  platform_admin (ViaE)     ← acceso a gestión de tenants, planes, facturación
       │
       ▼
  tenant admin (empresa)    ← admin de su empresa, no de las demás
       │
       ├── operations       ← operación del viaje, sin costos
       ├── agent            ← CRM y cotizaciones propias
       └── provider         ← catálogo y disponibilidad propios
              │
              └── conductor  ← servicios de transporte asignados
```

### 7.4 Reglas de roles multi-tenant

1. El rol se asigna en `tenant_members`, **no** en `user_roles` global.
2. `has_role(uid, role)` evoluciona a `has_tenant_role(uid, tenant_id, role)`.
3. El `platform_admin` es el único rol global (staff de ViaE).
4. El último admin de un tenant está **protegido** (igual que hoy, pero por tenant).
5. Los costos y márgenes siguen siendo **solo admin** del tenant, nunca `operations`.

---

## 8. Organizaciones

### 8.1 Estado actual

| Aspecto | Estado | Detalle |
| --- | --- | --- |
| Tabla `organizations` | ✅ | Existe con `organization_roles` |
| Convive con `companies`/`providers` | 🟡 | Migración incompleta |
| `organization_roles` | ✅ | Vínculo usuario ↔ organización con rol |
| Por tenant | 🔵 | Hoy las organizaciones son globales |

### 8.2 Visión multi-tenant

| Aspecto | Estado | Detalle |
| --- | --- | --- |
| Organizaciones por tenant | 🔵 | Cada empresa gestiona sus propias organizaciones |
| Organización = contraparte | 🔵 | El proveedor o mayorista con quien se comercia |
| `tenant_id` en `organizations` | 🔵 | Aislamiento por empresa |
| Marketplace de organizaciones | 🔵 | Algunas organizaciones publican al marketplace |

### 8.3 Organización vs. tenant

| Concepto | Qué es | Aislamiento |
| --- | --- | --- |
| **Tenant** | La empresa que usa ViaE (la agencia) | Aislado por `tenant_id` |
| **Organización** | La contraparte del tenant (un proveedor, un mayorista) | Aislada por `tenant_id` del tenant |
| **Organización publicada** | La organización que publica al marketplace | Visible para otros tenants (solo catálogo) |

> Una organización siempre pertenece a un tenant. En el marketplace, la
> organización se publica como "oferta pública", pero su costo, margen y datos
> internos siguen siendo del tenant propietario.

### 8.4 Consolidación pendiente

La deuda técnica más importante: `companies` y `providers` (legado) conviven con
`organizations` (modelo objetivo). Antes del multi-tenant **hay que consolidar**:
retirar `companies`/`providers` y dejar `organizations` como única entidad
comercial. Sin esto, el `tenant_id` sobre `organizations` no es inequívoco.

---

## 9. Proveedores

### 9.1 Estado actual

| Aspecto | Estado | Detalle |
| --- | --- | --- |
| Rol `provider` | ✅ | Existe en el enum |
| Acceso restringido | ✅ | RLS filtra a servicios/recursos propios |
| Portal del proveedor | 🔵 | El proveedor entra a la app interna, no a un portal propio |
| Autogestión de catálogo | 🔵 | La agencia carga los recursos, no el proveedor |
| Confirmación de servicios | 🔵 | El proveedor no confirma dentro del sistema |

### 9.2 Visión multi-tenant

| Aspecto | Estado | Detalle |
| --- | --- | --- |
| Portal del proveedor | 🔵 | Espacio propio con catálogo, disponibilidad y tarifas |
| `provider_users` | 🔵 | Vínculo `profiles ↔ organizations` |
| `provider_service_offers` | 🔵 | Servicios ofrecidos, pendientes de aprobación |
| `provider_availability` | 🔵 | Calendario declarado por el proveedor |
| `service_confirmations` | 🔵 | Confirmación/rechazo con sello temporal |
| `message_threads` + `messages` | 🔵 | Conversación operativa por reserva/servicio |

### 9.3 Aislamiento del proveedor

El proveedor es el actor más delicado del SaaS porque **cruza la frontera del tenant**
en el marketplace:

| Dato | El proveedor ve | Otras agencias ven | Estado |
| --- | --- | --- | --- |
| Catálogo publicado | ✅ (es suyo) | ✅ (marketplace) | 🔵 |
| Tarifa publicada | ✅ (precio venta) | ✅ (precio venta) | 🔵 |
| Costo del proveedor | ✅ (es suyo) | ❌ (nunca) | 🔵 |
| Clientes de la agencia | ❌ (nunca) | — | 🔵 |
| Costos de otros proveedores | ❌ (nunca) | — | 🔵 |
| Márgenes de la agencia | ❌ (nunca) | — | 🔵 |
| Confirmación de reserva | ✅ (solo las suyas) | ✅ (solo las suyas) | 🔵 |

> El RLS del proveedor debe filtrar por **contraparte**, no solo por rol. Es el punto
> más delicado del SaaS: una política mal escrita expone datos de la agencia al
> proveedor o viceversa.

---

## 10. Inventario

### 10.1 Estado actual

| Aspecto | Estado | Detalle |
| --- | --- | --- |
| `resources` (catálogo) | ✅ | Recursos operativos con clasificación y subtipos |
| `resource_extras` | ✅ | Extras y coberturas por recurso |
| `resource_availability_log` | ✅ | Log interno de disponibilidad |
| Inventario / cupos por fecha | 🔵 | No existe gestión de cupos |
| Overbooking controlado | 🔵 | No existe |
| Bloqueos de recurso | 🔵 | No existe |

### 10.2 Visión multi-tenant

| Aspecto | Estado | Detalle |
| --- | --- | --- |
| `tenant_id` en `resources` | 🔵 | Cada empresa gestiona sus recursos |
| Inventario por recurso y fecha | 🔵 | Cupos, bloqueos y overbooking |
| `service_availability` por tenant | 🔵 | Calendario de cupos aislado por empresa |
| Inventario publicado al marketplace | 🔵 | El proveedor publica cupos visibles para todas |
| Reserva de cupos desde el marketplace | 🔵 | La agencia reserva y el cupo se descuenta | 🔵 |

### 10.3 Modelo de inventario

```text
  Recurso (tenant A)          ──── posee ────  Disponibilidad por fecha
    │                                            (service_availability)
    │
    ├── cupo interno (solo agencia A ve el detalle)
    │
    └── cupo publicado al marketplace (todas las agencias ven el cupo disponible)
```

> El inventario tiene **dos vistas**: la interna (el tenant dueño ve todo el detalle)
> y la publicada (el marketplace ve solo el cupo disponible, no el reservado ni el
> bloqueado). Esta distinción es clave para el overbooking controlado.

---

## 11. Tarifas

### 11.1 Estado actual

| Aspecto | Estado | Detalle |
| --- | --- | --- |
| `tariff_plans` | ✅ | Estructura creada |
| `tariff_seasons` | ✅ | Temporadas con rango y prioridad |
| `tariff_rules` | ✅ | Precio por plan + temporada + categoría |
| `tariff_rule_conditions` | ✅ | Condiciones de noches, anticipación |
| `passenger_categories` | ✅ | Categorías con edades y atributos |
| Cálculo de tarifa | 🔵 | No existe el motor de cálculo |
| Tarifa publicada al marketplace | 🔵 | No existe publicación |

### 11.2 Visión multi-tenant

| Aspecto | Estado | Detalle |
| --- | --- | --- |
| `tenant_id` en `tariff_plans` | 🔵 | Cada empresa gestiona sus planes |
| Tarifa por composición de grupo | 🔵 | Cálculo según adultos/niños/infantes |
| Tarifa por temporada | 🔵 | Temporada alta/media/baja/especial |
| Suplementos y reducciones | 🔵 | Single, media pensión, alta demanda |
| Snapshot inmutable | 🔵 | La tarifa aplicada se congela al calcular |
| Tarifa publicada al marketplace | 🔵 | Precio venta visible, costo no |
| Tarifas mayoristas | 🔵 | Tarifa para minoristas con comisión |

### 11.3 Tarifa interna vs. publicada

| Tipo de tarifa | Quién la ve | Estado |
| --- | --- | --- |
| Tarifa de costo | Solo el tenant dueño (admin) | 🔵 |
| Tarifa de venta interna | El tenant dueño (admin, agent) | 🔵 |
| Tarifa publicada al marketplace | Todas las agencias (precio venta) | 🔵 |
| Tarifa mayorista | Agencias con acuerdo comercial | 🔵 |
| Comisión de la tarifa | El proveedor y el admin de cada parte | 🔵 |

> La tarifa se **publica** al marketplace como precio de venta. El costo y el margen
> del proveedor **nunca** se publican: son datos sensibles del tenant propietario.

---

## 12. Disponibilidad

### 12.1 Estado actual

| Aspecto | Estado | Detalle |
| --- | --- | --- |
| `availability_sources` | ✅ | Estructura creada (manual, api, cache, external) |
| `service_availability` | ✅ | Estructura creada (cupos por fecha) |
| `availability_cache` | ✅ | Estructura creada (cache de búsquedas) |
| `availability_requests` | ✅ | Estructura creada (log de consultas) |
| `availability_policies` | ✅ | Estructura creada (fallback, cache minutes) |
| Búsquedas reales | 🔵 | No existe motor de búsqueda |
| Conexión a APIs externas | 🔵 | No existe |
| Autogestión del proveedor | 🔵 | El proveedor no gestiona su calendario |

### 12.2 Visión multi-tenant

| Aspecto | Estado | Detalle |
| --- | --- | --- |
| `tenant_id` en tablas de disponibilidad | 🔵 | Aislamiento por empresa |
| Disponibilidad autogestionada por proveedor | 🔵 | El proveedor carga su calendario |
| Búsqueda de disponibilidad | 🔵 | El sistema consulta cupos por fecha y servicio |
| Disponibilidad publicada al marketplace | 🔵 | Cupos visibles para todas las agencias |
| Cache de disponibilidad | 🔵 | Resultados cacheados por minutos configurables |
| Fallback manual | 🔵 | Si la API falla, degradar a cupo manual |
| Sincronización con APIs externas | 🔵 | Hotelbeds,Tourico, etc. (futuro) |

### 12.3 Flujo de disponibilidad multi-tenant

```text
  Agencia (tenant B) busca cupo para una excursión
         │
         ▼
  Sistema consulta service_availability del proveedor (tenant A)
         │
         ├── cupo publicado al marketplace → visible para B
         │
         ├── cache disponible → devuelve cache
         │
         └── cache expirado → consulta origen (manual/API)
              │
              └── devuelve cupo + actualiza cache
```

> La disponibilidad publicada al marketplace es **de lectura para otras agencias**.
> Solo el tenant propietario (el proveedor) puede **escribir** en su calendario.

---

## 13. Itinerarios

### 13.1 Estado actual

| Aspecto | Estado | Detalle |
| --- | --- | --- |
| `itinerary_templates` | ✅ | Estructura creada |
| `itinerary_template_items` | ✅ | Ítems por día con servicio_kind |
| `itinerary_rules` | ✅ | Reglas de compatibilidad |
| `itinerary_versions` | ✅ | Versionado con snapshot |
| `itinerary_requests` | ✅ | Solicitudes de itinerario |
| Generación automática | 🔵 | No existe motor de generación |
| Ensamblado de paquete | 🔵 | No existe empaquetado dinámico |

### 13.2 Visión multi-tenant

| Aspecto | Estado | Detalle |
| --- | --- | --- |
| `tenant_id` en tablas de itinerarios | 🔵 | Aislamiento por empresa |
| Plantillas por empresa | 🔵 | Cada agencia diseña sus plantillas |
| Generación automática de itinerario | 🔵 | El sistema arma según reglas |
| Ensamblado multi-proveedor | 🔵 | Servicios de varios proveedores en un itinerario |
| Itinerarios del marketplace | 🔵 | Plantillas publicadas para otras agencias |
| Personalización por agencia | 🔵 | Cada agencia adapta la plantilla base |

### 13.3 Itinerario en el marketplace

| Tipo | Quién lo usa | Estado |
| --- | --- | --- |
| Plantilla privada | Solo el tenant dueño | 🔵 |
| Plantilla publicada | Agencias con acuerdo comercial | 🔵 |
| Itinerario generado | La agencia que lo solicita | 🔵 |
| Itinerario reservado | Se convierte en expediente 360° | 🔵 |

---

## 14. Comisiones

### 14.1 Estado actual

| Aspecto | Estado | Detalle |
| --- | --- | --- |
| `commissions` | ✅ | Tabla creada, **vacía por diseño** |
| `resolve_agreement` | ✅ | Resuelve el acuerdo por score de especificidad |
| `compute_commission` | ✅ | Calcula gross/net/cost/margin |
| `simulate_commission` | ✅ | Simulación STABLE (no persiste) |
| Panel de simulación | 🟡 | UI de solo lectura en el expediente |
| Devengo real | 🔵 | No existe `accrue_commission()` |
| Liquidaciones | 🔵 | No existe cierre por período |
| Conciliación | 🔵 | No existe |

### 14.2 Visión multi-tenant

| Aspecto | Estado | Detalle |
| --- | --- | --- |
| `tenant_id` en `commissions` | 🔵 | Cada empresa devenga sus comisiones |
| Devengo idempotente | 🔵 | `accrue_commission()` escribe una sola vez |
| Snapshot de regla aplicada | 🔵 | La regla se congela al devengar |
| `settlements` por período y contraparte | 🔵 | Cierre mensual con totales por moneda |
| `settlement_items` | 🔵 | Comisiones incluidas en cada liquidación |
| `settlement_payments` | 🔵 | Pagos realizados/recibidos |
| `payment_reconciliations` | 🔵 | Vínculo cobro ↔ movimiento esperado |
| Comisión de transacción ViaE | 🔵 | Comisión del marketplace sobre la reserva |

### 14.3 Comisiones en el marketplace

El marketplace introduce un **nuevo tipo de comisión**: la transacción que ViaE cobra
sobre las reservas confirmadas a través del marketplace.

| Tipo de comisión | Quién la paga | Quién la cobra | Estado |
| --- | --- | --- | --- |
| Comisión a agente | La agencia | El agente | 🔵 |
| Comisión a proveedor | El proveedor | La agencia | 🔵 |
| Comisión de marketplace | La agencia o el proveedor | ViaE (plataforma) | 🔵 |
| Comisión mayorista | La minorista | La mayorista | 🔵 |

> La comisión de marketplace es la **fuente de ingresos** del SaaS. Es un tipo nuevo
> de comisión que no existe en el single-tenant actual y requiere su propio devengo
> y liquidación.

---

## 15. API futura

### 15.1 Estado actual

| Aspecto | Estado | Detalle |
| --- | --- | --- |
| Server functions (RPC interno) | ✅ | `createServerFn` para la app interna |
| Rutas públicas (`/api/public/*`) | ✅ | Webhooks y endpoints externos |
| API pública para terceros | 🔵 | No existe |
| Autenticación de API | 🔵 | No existe API key por tenant |
| Rate limiting | 🔵 | No existe |
| Documentación de API | 🔵 | No existe |

### 15.2 Visión de API pública

| Aspecto | Estado | Detalle |
| --- | --- | --- |
| API REST por tenant | 🔵 | Cada empresa accede a sus datos por API |
| API key por tenant | 🔵 | Clave única por empresa con scopes |
| Scopes por endpoint | 🔵 | `read:tariffs`, `write:bookings`, `read:availability` |
| Rate limiting por plan | 🔵 | Starter = 100 req/h, Pro = 1.000, Enterprise = ilimitado |
| Webhooks salientes | 🔵 | Notificar a terceros sobre eventos (reserva, confirmación) |
| API del marketplace | 🔵 | Buscar y reservar servicios del marketplace por API |
| SDK | 🔵 | Librería para integrar ViaE en sistemas externos |
| Documentación OpenAPI | 🔵 | Spec generada y publicada |

### 15.3 Endpoints tentativos

| Endpoint | Método | Scope | Estado |
| --- | --- | --- | --- |
| `/api/v1/tariffs` | GET | `read:tariffs` | 🔵 |
| `/api/v1/availability` | GET | `read:availability` | 🔵 |
| `/api/v1/quotations` | GET, POST | `read:quotations`, `write:quotations` | 🔵 |
| `/api/v1/bookings` | GET, POST | `read:bookings`, `write:bookings` | 🔵 |
| `/api/v1/marketplace/search` | GET | `read:marketplace` | 🔵 |
| `/api/v1/marketplace/book` | POST | `write:marketplace` | 🔵 |
| `/api/v1/webhooks` | POST | `write:webhooks` | 🔵 |

### 15.4 Reglas de la API

1. La API **siempre** filtra por `tenant_id` de la API key, igual que RLS.
2. La API **nunca** expone costos ni márgenes (salvo scope `admin` explícito).
3. El rate limiting es **por tenant y por plan**, no por IP.
4. Los webhooks salientes se **firman** (HMAC) y reintentan con backoff.
5. La versión de la API (`/v1/`) garantiza compatibilidad hacia atrás.

---

## 16. Diagrama de arquitectura

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              UNA INSTALACIÓN DE VIAE                              │
│                                                                                  │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐          ┌─────────┐       │
│  │ Tenant A │   │ Tenant B │   │ Tenant C │   │ Tenant D │   ...  │ Tenant N│       │
│  │ Agencia  │   │ Mayorista│   │ Operador │   │  Hotel  │        │  ...   │       │
│  │ minorista│   │          │   │ receptivo│   │         │        │        │       │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬────┘        └───┬────┘       │
│       │              │              │              │                  │             │
│       │   branding A  │  branding B │  branding C  │  branding D     │             │
│       │   dominio A   │  dominio B  │  dominio C   │  dominio D      │             │
│       │   users A     │  users B    │  users C     │  users D        │             │
│       │   roles A     │  roles B    │  roles C     │  roles D        │             │
│       │   datos A     │  datos B    │  datos C     │  datos D        │             │
│       │               │             │              │                 │             │
│       ▼               ▼             ▼              ▼                 ▼             │
│  ═════════════════════════════════════════════════════════════════════════════    │
│  ║                     CORE COMPARTIDO (mismo código)                          ║   │
│  ║                                                                             ║   │
│  ║  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   ║   │
│  ║  │   Aplicación │  │   Servidor   │  │  Base de     │  │   Storage    │   ║   │
│  ║  │   web (React)│  │   (worker)   │  │  datos       │  │   (bucket)   │   ║   │
│  ║  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   ║   │
│  ║                                                                             ║   │
│  ║  Funciones SECURITY DEFINER · Triggers · Enums · RLS · Geografía · Categorías║  │
│  ═══════════════════════════════════════════════════════════════════════════    │
│       │               │             │              │                 │             │
│       └───────────────┴─────────────┴──────────────┴─────────────────┘             │
│                                  │                                                │
│                                  ▼                                                │
│                    ┌──────────────────────────────┐                               │
│                    │      MARKETPLACE (puente)     │                               │
│                    │                              │                               │
│                    │  Catálogo publicado   ──► visible para todas las agencias    │
│                    │  Tarifa publicada     ──► precio venta (no costo)            │
│                    │  Disponibilidad       ──► cupos disponibles                  │
│                    │  Confirmaciones       ──► proveedor ↔ agencia               │
│                    │  Comisión ViaE       ──► transacción del marketplace          │
│                    └──────────────────────────────┘                               │
│                                  │                                                │
│                                  ▼                                                │
│                    ┌──────────────────────────────┐                               │
│                    │      API PÚBLICA (futura)      │                              │
│                    │  API key por tenant · scopes   │                              │
│                    │  rate limit por plan · webhooks │                              │
│                    └──────────────────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Diagrama de aislamiento de datos

```text
                    Tabla de negocio (ej. bookings)
  ┌───────────────────────────────────────────────────────┐
  │  id  │  tenant_id  │  booking_number  │  status  │ ...  │
  │  001 │  A          │  VIA-AA-000001   │  quoted  │ ...  │  ← solo tenant A ve
  │  002 │  A          │  VIA-AA-000002   │  confir. │ ...  │  ← solo tenant A ve
  │  003 │  B          │  VIA-BB-000001   │  quoted  │ ...  │  ← solo tenant B ve
  │  004 │  C          │  VIA-CC-000001   │  draft   │ ...  │  ← solo tenant C ve
  └───────────────────────────────────────────────────────┘
                          │
                          ▼
  Política RLS:
  USING (tenant_id = current_tenant())
                          │
                          ├── usuario del tenant A → ve filas 001, 002
                          ├── usuario del tenant B → ve fila 003
                          └── usuario del tenant C → ve fila 004
```

---

## 17. Matriz de propiedad

La matriz definitiva: **qué es compartido** por toda la plataforma y **qué pertenece
a cada empresa**.

### 17.1 Compartido por toda la plataforma (core)

| Componente | Compartido | Por qué |
| --- | --- | --- |
| Aplicación web | ✅ | Mismo código para todos |
| Servidor (worker) | ✅ | Mismo runtime |
| Base de datos | ✅ | Un solo esquema `public` |
| Funciones y triggers | ✅ | La lógica es del core |
| Enums y tipos | ✅ | Los estados son del core |
| Geografía de Argentina | ✅ | Catálogo de referencia |
| Categorías de pasajero | ✅ | Definición del core |
| Tipos de recurso | ✅ | Catálogo del core |
| Bucket de Storage | ✅ | Una sola infraestructura |
| Auth | ✅ | Un solo pool de identidades |
| Marketplace (puente) | ✅ | El espacio compartido |

### 17.2 Por empresa (tenant)

| Componente | Por tenant | Aislamiento |
| --- | --- | --- |
| Branding | ✅ | `tenant_branding` por empresa |
| Dominio | ✅ | `tenant_domains` por empresa |
| Configuración | ✅ | `tenant_settings` por empresa |
| Usuarios (pertenencia) | ✅ | `tenant_members` por empresa |
| Roles | ✅ | Rol por empresa, no global |
| Organizaciones | ✅ | `tenant_id` en `organizations` |
| Clientes (CRM) | ✅ | `tenant_id` en `clients` |
| Leads y oportunidades | ✅ | `tenant_id` en `leads`, `opportunities` |
| Cotizaciones | ✅ | `tenant_id` en `quotations` |
| Reservas y expediente | ✅ | `tenant_id` en `bookings` |
| Servicios de reserva | ✅ | `tenant_id` en `booking_services` |
| Economía de servicios | ✅ | `tenant_id` en `booking_service_economics` |
| Pasajeros | ✅ | `tenant_id` en `booking_passengers` |
| Timeline | ✅ | `tenant_id` en `booking_timeline` |
| Pagos y documentos | ✅ | `tenant_id` en `booking_payments`, `booking_documents` |
| Agentes | ✅ | `tenant_id` en `agents` |
| Recursos operativos | ✅ | `tenant_id` en `resources` |
| Transporte | ✅ | `tenant_id` en `transport_services` |
| Acuerdos comerciales | ✅ | `tenant_id` en `commercial_agreements` |
| Comisiones | ✅ | `tenant_id` en `commissions` |
| Liquidaciones | ✅ | `tenant_id` en `settlements` |
| Tarifas | ✅ | `tenant_id` en `tariff_plans` |
| Disponibilidad | ✅ | `tenant_id` en `service_availability` |
| Itinerarios | ✅ | `tenant_id` en `itinerary_templates` |
| Notificaciones | ✅ | `tenant_id` en `notifications` |
| Comunicaciones | ✅ | `tenant_id` en `communication_events` |
| Numeración de reservas | ✅ | Secuencia por empresa |
| Tipos de cambio | ✅ (o compartido por plan) | `tenant_id` en `exchange_rates` |

### 17.3 Cruzado (marketplace)

| Componente | Visible para | Escribible por |
| --- | --- | --- |
| Catálogo publicado | Todas las agencias | El proveedor propietario |
| Tarifa publicada (venta) | Todas las agencias | El proveedor propietario |
| Disponibilidad publicada | Todas las agencias | El proveedor propietario |
| Confirmación de reserva | El proveedor + la agencia que reservó | El proveedor |
| Costo y margen del proveedor | Solo el proveedor + admin del proveedor | El proveedor |
| Comisión de marketplace | ViaE (plataforma) + las partes | ViaE (automático) |

---

## 18. Riesgos y mitigaciones

### 18.1 Riesgos técnicos

| Riesgo | Impacto | Mitigación | Estado |
| --- | --- | --- | --- |
| Fuga de datos entre tenants | Crítico — expone datos de una agencia a otra | RLS con `tenant_id` en cada política + tests automatizados de RLS por tenant | 🔵 |
| Recursión en RLS | La política se llama a sí misma | Funciones `SECURITY DEFINER` + `STABLE`, igual que `has_role()` hoy | 🔵 |
| Numeración global | `booking_number` colisiona entre empresas | Secuencia por tenant con backfill de los existentes | 🔵 |
| Performance con muchos tenants | Consultas lentas al filtrar por `tenant_id` | Índice compuesto `(tenant_id, ...)` en cada tabla | 🔵 |
| Branding al cargar | Parpadeo de marca si se carga tarde | Resolver dominio → tenant antes del primer render | 🔵 |
| Migración de datos existentes | Pérdida de historial append-only | Migración reversible con `tenant_id = A` para los datos actuales | 🔵 |

### 18.2 Riesgos de negocio

| Riesgo | Impacto | Mitigación | Estado |
| --- | --- | --- | --- |
| Deuda técnica sin resolver | El SaaS se construye sobre arena | Consolidar `organizations` antes del multi-tenant | 🟡 |
| Marketplace inseguro | El proveedor ve datos de la agencia | RLS por contraparte, no solo por rol | 🔵 |
| Plan sin límites | Abuso de recursos | Rate limiting, cuotas por plan, medición de uso | 🔵 |
| Soporte multi-tenant | Cada tenant tiene su configuración | Panel de `platform_admin` para gestión de tenants | 🔵 |
| Cancelación de tenant | Dominio liberado y datos archivados | Período de gracia + archivado (nunca borrado) | 🔵 |

### 18.3 Precondiciones no negociables

Antes de activar el multi-tenant, se deben cumplir estas precondiciones en orden:

1. **Consolidar `organizations`** — retirar `companies`/`providers`. Sin esto, el
   `tenant_id` sobre `organizations` no es inequívoco. 🟡
2. **Unificar la economía del servicio** — `booking_service_economics` +
   `transport_services` en un solo modelo. Sin esto, el devengo se calcula dos veces. 🟡
3. **Tests automatizados de RLS** — probar que ninguna agencia ve datos de otra. Sin
   esto, el multi-tenant no es seguro. 🔵
4. **Materializar `trip_state`** — persistir el estado derivado para que las bandejas
   y alertas no dependan de la función en tiempo real con miles de reservas. 🔵
5. **Activar devengo de comisiones** — sin comisión devengada, la liquidación del
   marketplace no funciona. 🔵

> La deuda transversal se paga **antes** del multi-tenant, no después. Cada versión
> que pasa sin resolverla encarece el SaaS.

---

## Cierre

La arquitectura SaaS de ViaE se resume en una frase: **una instalación, cientos de
empresas, aislamiento en la base**. El código es compartido, la infraestructura es
compartida, pero cada dato de negocio lleva la marca de su empresa y la base de datos
garantiza que ninguna empresa vea lo que no le pertenece.

El marketplace es el puente: el único lugar donde los datos cruzan la frontera del
tenant, y lo hacen con reglas estrictas — el catálogo y la tarifa de venta se
publican, el costo y el margen nunca. La API pública extiende este modelo a terceros,
siempre filtrando por el tenant de la API key.

El camino es claro: resolver la deuda transversal, activar los motores que ya tienen
estructura, devengar comisiones, abrir el portal del proveedor, encender el
marketplace y, finalmente, convertir el sistema en SaaS de marca blanca. Cada paso
se apoya en el anterior y el aislamiento se construye desde el primer día, no se
parcha al final.

> **Una instalación. Cientos de empresas. Aislamiento en la base.**
