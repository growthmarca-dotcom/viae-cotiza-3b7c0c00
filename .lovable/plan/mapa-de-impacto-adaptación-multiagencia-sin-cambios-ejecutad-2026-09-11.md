# Mapa de impacto — Adaptación multiagencia (sin cambios ejecutados)

## A. YA EXISTE Y CUMPLE

- `organizations` como entidad única de agencia/empresa (identidad, fiscal, contacto, logo, estado). No hay tablas por agencia.
- Memberships: `organization_members` con roles exactamente `organization_owner, organization_admin, operations, agent, provider, driver, viewer` y estados `active, pending, inactive, suspended`. Un usuario puede pertenecer a varias organizaciones.
- Helpers de pertenencia y rol: `is_member_of`, `has_org_role`, `can_manage_organization_members`, `org_identity_can_read/write/admin/delete`.
- Invitaciones y provisión: `organization_invitations` + RPCs de invitar/aceptar/cambiar rol/revocar.
- Separación `auth.users` ≠ `persons`; `persons`/`person_roles` con RLS por organización; `agents.person_id`, `clients.person_id`.
- `organization_id` ya presente y resuelto por trigger en `opportunities`, `quotations`, `smart_quotes`, `bookings`, `booking_services`, `booking_service_economics`, `providers`, comisiones y liquidaciones, con funciones `resolve_*_organization` y validaciones de coherencia entre entidades.
- Conversión cotización → reserva conserva organización, oportunidad, cliente, fechas, importes, servicios y pasajeros (`src/lib/bookings.ts`, `src/lib/bookingConversion.ts`); la reserva guarda su propio `organization_id`.
- Propuesta pública por token sin login, con aceptar/rechazar y notificación en campanita.
- Propuesta pública ya prioriza datos de `organizations` y cae a `company_settings` (`src/lib/public-smart-quote.functions.ts`).
- Agentes: `agents.email`, `agents.user_id`, responsables `leads.assigned_agent_id`, `opportunities.assigned_agent_id`, `smart_quotes.agent_id`, `quotations.user_id`. Nada por crear.

## B. YA EXISTE PERO REQUIERE ADAPTACIÓN

1. **Aislamiento real por organización en RLS de datos comerciales**
   - Tablas: `opportunities` (4 políticas), `quotations` (3), `bookings` (6), `smart_quotes` (5), `booking_services`, `booking_passengers`, `quotation_items`, `commissions`.
   - Hoy ninguna política de estas tablas menciona `organization_id`: el acceso se decide por `user_id` propio, `has_role(admin)`, `is_operations()` o agente asignado.
   - Cambio mínimo: **añadir** políticas de lectura/escritura basadas en `is_member_of(auth.uid(), organization_id)` y `has_org_role(...)`, y **acotar** las políticas amplias por rol global (`operations`, `agent`) para que exijan pertenencia a la organización del registro. Conservar la vía admin de plataforma (ViaE) como acceso global.
   - Riesgo: medio-alto. Acotar `is_operations()`/agente puede quitar visibilidad a usuarios actuales que no tengan membership (hoy sólo 1 membership activa). Mitigación: primero completar memberships de los perfiles activos, luego endurecer política por política y verificar cada pantalla.

2. **`leads` sin organización**
   - Tabla `leads` (y `lead_history`) no tiene `organization_id`; políticas por `user_id`/admin/agente.
   - Cambio: agregar `organization_id` nullable + resolución en creación (patrón `resolve_*_organization`) + políticas por pertenencia. Históricos quedan como están.
   - Riesgo: bajo si la columna es nullable y las políticas permiten los registros sin organización a admin/creador.

3. **`clients` sin organización**
   - `clients` sólo tiene `user_id`/`person_id`; una persona puede ser cliente de varias agencias.
   - Cambio: agregar `organization_id` nullable a `clients` (la identidad compartida sigue en `persons`) y políticas por pertenencia.
   - Riesgo: bajo-medio; el panel de cliente y la creación de oportunidad/reserva desde ficha leen `clients`.

4. **Branding: colores y redes siguen siendo globales por usuario**
   - `company_settings` es por `user_id` y aporta `primary_color`, `accent_color`, `footer_text`, `instagram`, `facebook`. `organizations` no tiene colores ni redes ni pie.
   - Archivos: `src/lib/public-smart-quote.functions.ts`, `src/lib/public-quotation.functions.ts` (esta última **no** consulta `organizations`), `src/components/quotation-print.tsx` (PDF).
   - Cambio: agregar a `organizations` campos de marca (colores, pie, redes) y usarlos con fallback a `company_settings`; extender la propuesta legacy `/cotizacion/$token` y el PDF a resolver marca por organización.
   - Riesgo: bajo (aditivo). Visualmente cambia sólo si la organización carga marca propia.

5. **Resolución de organización del usuario**
   - `src/lib/tenant.ts` falla cuando el usuario pertenece a 0 o >1 organizaciones y `resolveMyOrganizationId` no ofrece selección.
   - Cambio: selector de organización activa (contexto de sesión) reutilizado por creación de lead/oportunidad/cotización/reserva.
   - Riesgo: bajo; hoy hay un único usuario operativo.

6. **`company_settings` como configuración de plataforma vs agencia**
   - Cambio mínimo: mantenerla como configuración de ViaE/fallback, sin migrar datos; documentar que la marca por agencia vive en `organizations`.
   - Riesgo: bajo.

## C. REQUIERE CREACIÓN

- Columnas `organization_id` en `leads` y `clients` (+ resolución en la creación).
- Campos de marca por organización en `organizations` (colores, pie, redes) y su formulario de edición.
- Políticas RLS nuevas por pertenencia en las tablas del punto B.1 (añadidas, no reescritas).
- Selector/contexto de organización activa en la aplicación.
- Backfill mínimo de `organization_members` para los perfiles activos, antes de endurecer RLS.

## D. NO TOCAR

Pipeline y etapas; flujo Lead → Oportunidad → Cotización → Propuesta → Aceptación → Reserva; tokens públicos y su expiración; lógica de conversión y sus helpers y tests; notificaciones y campanita; `persons`/`person_roles`; `auth.users`; roles y enums existentes; comisiones, liquidaciones, ajustes y pagos históricos; `companies` (legacy congelado); `providers` y su catálogo; inventario, tarifario, disponibilidad, paquetes, orquestador; envío de emails (no se implementa en esta fase); White Label, dominios y DNS por agencia.

## E. RIESGOS / DEPENDENCIAS

1. **Memberships insuficientes** (1 membership activa, 3 organizaciones): endurecer RLS antes de completar memberships dejaría a usuarios sin acceso. Es la dependencia bloqueante del orden de trabajo.
2. **Registros históricos sin organización** en `leads`/`clients`: las políticas deben tolerar `NULL` para no ocultar datos actuales.
3. **Políticas amplias por rol global** (`operations`, agente asignado): acotarlas es lo que más puede afectar pantallas en uso; requiere verificación pantalla por pantalla.
4. **Propuesta pública** usa cliente privilegiado del servidor: los cambios de marca no deben ampliar los datos expuestos ni tocar la validación de token.
5. **Orden recomendado**: memberships → marca por organización → `organization_id` en leads/clients → contexto de organización activa → endurecimiento de RLS.
6. Sin cambios en costos, ni en emails, ni en integraciones externas.
