# FASE 1A — Informe de auditoría de seguridad (ViaE Sales Hub)

> Fecha: agosto 2026 · **Solo diagnóstico**: no se modificó código, esquema ni permisos.
> Evidencia: consultas en vivo a `pg_proc`, `pg_policies`, `information_schema.role_table_grants`
> y revisión de `src/routes/**`, `src/lib/public-*.functions.ts`, `public/robots.txt`.

## 1. Resumen ejecutivo

| Dimensión | Estado |
| --- | --- |
| RLS | ✅ **Todas** las tablas de `public` tienen RLS habilitado y al menos una política |
| Grants a `anon` sobre tablas | ✅ **Ninguno** (consulta devolvió 0 filas) |
| Políticas que incluyan `anon`/`public` | ✅ **Ninguna** |
| Funciones `SECURITY DEFINER` | 🟡 110 en total; **77 ejecutables por `anon`** |
| Función escribible sin sesión | 🔴 `ensure_provider_organization` (1 caso real) |
| Rutas públicas por token | 🟡 Correctas en el filtrado; sin rate limiting |
| `robots.txt` | 🟠 Permite indexar `/cotizacion/*`, `/propuesta/*`, `/seguimiento/*` |

Veredicto: la base de datos está bien cerrada a nivel de tablas. El riesgo real y accionable
está en **una** función `SECURITY DEFINER` sin verificación de sesión, en la superficie
innecesaria de `EXECUTE` para `anon`, y en la indexación de enlaces privados.

---

## 2. Funciones SECURITY DEFINER

Recuento verificado:

| Tipo | Total | Con `EXECUTE` para `anon`/PUBLIC |
| --- | --- | --- |
| `SECURITY DEFINER` | 110 | **77** |
| `SECURITY INVOKER` | 16 | 14 |

Todas son propiedad de `postgres` y **todas** tienen `SET search_path = public`
(no hay riesgo de secuestro de `search_path`).

De las 77 con `anon`, la mayoría son **funciones de trigger** (`tg_*`, `log_*`,
`notify_*`, `sync_*`, `prevent_last_admin_removal`): invocarlas directamente sin
un contexto de trigger falla (`NEW`/`TG_OP` no definidos), por lo que no son
explotables aunque el permiso sea innecesario.

### Clasificación

**A) Seguras (mantener)**
- `booking_public_tracking(text)` — pública **por diseño**; devuelve solo número de reserva,
  destino, fechas y estado, filtrando por `tracking_token` + `tracking_enabled` + `record_status`.
- Helpers puros de autorización: `has_role`, `is_approved`, `is_operations`, `is_member_of`,
  `has_org_role`, `current_agent_id`, `can_*` (leen contexto de `auth.uid()`; con `anon`
  simplemente devuelven `false`/`NULL`).
- Funciones con guardia explícita de sesión/rol:
  `claim_admin_if_none` (exige `auth.uid()` y que no exista ningún admin),
  `mark_notifications_read` (exige sesión y filtra `user_id = auth.uid()`),
  `smart_quote_share_token` / `smart_quote_share_revoke` (exigen `can_manage_smart_quote`),
  `simulate_commission` (recorta el payload por rol: admin ve costos, operaciones sin
  base de costo/margen, resto `summary_only`).
- `create_booking_timeline_event` — único caso con `EXECUTE` restringido solo a `service_role`. ✅ Modelo a replicar.

**B) Requieren validación (permiso innecesario, sin explotación conocida)**
- Las ~70 funciones de trigger y de resolución interna (`resolve_*_organization`,
  `provider_in_package_template`, `currency_rate_at`, `driver_service_context`…)
  que conservan el `EXECUTE` por defecto para `anon`/`PUBLIC`.
  Riesgo: superficie de ataque futura — cualquier función nueva mal escrita en este
  conjunto se convierte automáticamente en el caso crítico de §3.

**C) Riesgo alto/crítico**
- `ensure_provider_organization(uuid)` — ver §3.

---

## 3. Auditoría de `ensure_provider_organization`

Definición actual (verbatim de la base):

```sql
CREATE OR REPLACE FUNCTION public.ensure_provider_organization(_provider_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p RECORD; v_org uuid;
BEGIN
  SELECT * INTO p FROM public.providers WHERE id = _provider_id;
  IF p.id IS NULL THEN RETURN NULL; END IF;
  IF p.organization_id IS NOT NULL THEN RETURN p.organization_id; END IF;

  SELECT o.id INTO v_org FROM public.organizations o
  WHERE (p.tax_id IS NOT NULL AND p.tax_id <> '' AND lower(o.tax_id) = lower(p.tax_id))
     OR lower(o.trade_name) = lower(p.trade_name)
  LIMIT 1;

  IF v_org IS NULL THEN
    INSERT INTO public.organizations (...) VALUES (...) RETURNING id INTO v_org;
  END IF;

  INSERT INTO public.organization_roles (organization_id, role) VALUES (v_org, 'provider')
  ON CONFLICT DO NOTHING;
  UPDATE public.providers SET organization_id = v_org WHERE id = p.id;
  RETURN v_org;
END; $function$
```

| Pregunta | Respuesta |
| --- | --- |
| Permisos actuales | `postgres`, **`anon`**, `authenticated`, `service_role` con `EXECUTE` |
| Quién puede ejecutarla | Cualquiera, incluida una petición sin sesión vía RPC |
| Requiere autenticación | ❌ No |
| Valida el usuario actual | ❌ No lee `auth.uid()` en ningún punto |
| Valida organización / pertenencia | ❌ No |
| Puede crear organizaciones | ✅ Sí (`INSERT INTO organizations`) |
| Puede reasignar proveedores | ✅ Sí (`UPDATE providers SET organization_id`) |
| Escribe además | `organization_roles` (rol `provider`) |

**Severidad: Crítico.** Al ser `SECURITY DEFINER` corre como `postgres`, saltando RLS.
Un llamador anónimo que conozca o adivine un `provider_id` (UUID) puede provocar la
creación de una organización y la reasignación del proveedor. Impacto: integridad y
contaminación del modelo multiempresa; también permite **vincular un proveedor a una
organización existente** por coincidencia de `trade_name` (comparación laxa, sin tenant).

Recomendación (Fase 1B): exigir `auth.uid() IS NOT NULL` + `is_operations(auth.uid())`
o `has_role(...,'admin')`, y `REVOKE EXECUTE ... FROM anon, PUBLIC`.

---

## 4. Auditoría RLS

- Tablas en `public`: **todas con `relrowsecurity = true`**.
- Tablas **sin políticas**: ninguna.
- Políticas asignadas a `anon` o `PUBLIC`: **ninguna**.
- `GRANT` a `anon` sobre tablas de `public`: **ninguno**.

Revisión de las tablas sensibles pedidas:

| Tabla | Lectura | Observación |
| --- | --- | --- |
| `profiles` | propio / admin / operations | ✅ correcto |
| `user_roles` | 4 políticas, roles fuera de `profiles` | ✅ patrón correcto |
| `organizations` | `is_approved(auth.uid())` | 🟡 cualquier usuario aprobado ve **todas** las organizaciones; update solo admin/operations, delete solo admin |
| `providers` | `USING (true)` para `authenticated` | 🟠 **datos comerciales de terceros visibles a cualquier usuario autenticado**, incluidos agentes externos |
| `clients` | propio + admin + agente asignado (vía `opportunities`) | ✅ |
| `quotations` | propio + admin + agente asignado | ✅ |
| `smart_quotes` | 5 políticas vía `can_read_smart_quote` / `can_manage_smart_quote` | ✅ |
| `bookings` | propio + admin + operations + agente asignado | ✅ |
| `transport_services` | 6 políticas (dueño, operaciones, conductor) | ✅ |

Riesgo estructural heredado de la auditoría general: `organization_id` sigue siendo
**nullable** en tablas sensibles (`commissions`, `booking_service_economics`,
`transport_services`, `smart_quotes`…). Filas huérfanas pueden escapar de filtros
por tenant. **Severidad: Alto** (no explotable hoy, se agrava con volumen).

---

## 5. Auditoría de acceso público

Rutas sin login: `/`, `/auth`, `/cotizacion/$token`, `/propuesta/$token`, `/seguimiento/$token`.
No existen server routes bajo `src/routes/api/public/*`.

| Superficie | Mecanismo | Evaluación |
| --- | --- | --- |
| `/cotizacion/$token` | `getPublicQuotation` (server fn) valida formato `^[a-f0-9]{20,64}$`, usa `supabaseAdmin` solo en el handler, controla `expires_at` y `archived`, y devuelve una lista blanca de campos | ✅ Sin costos ni proveedor; sin política pública sobre `quotations` |
| `/propuesta/$token` | `getPublicSmartQuote` selecciona lista blanca de columnas, filtra por `share_token` y rechaza `share_expires_at` vencido | ✅ Oculta costos, márgenes y proveedores |
| `/seguimiento/$token` | `booking_public_tracking(token)` | ✅ Devuelve 6 campos no sensibles |
| Emisión/revocación de tokens | `smart_quote_share_token` / `_revoke` exigen `can_manage_smart_quote` | ✅ |

- **Enumeración**: no viable. Tokens de 20 bytes aleatorios (160 bits) para smart quotes;
  la validación por regex descarta sondeos malformados antes de tocar la base.
- **Acceso accidental**: el vector real no es técnico sino de distribución — un enlace
  reenviado o indexado (§6) da acceso completo a la propuesta hasta su expiración.
- **Exposición comercial**: correctamente acotada por listas blancas de campos.
- **Faltante**: sin rate limiting ni registro de accesos en las tres rutas por token
  (defensa en profundidad ante escaneo/DoS). **Severidad: Bajo.**

---

## 6. Auditoría SEO / robots.txt

`public/robots.txt` actual permite `Allow: /` a Googlebot, Bingbot, Twitterbot,
facebookexternalhit y `*`, **sin ningún `Disallow` ni `Sitemap:`**. Un enlace de propuesta
publicado en una web o red social puede quedar indexado con precios y datos del pasajero.
**Severidad: Alto.**

Propuesta (a aplicar en Fase 1B):

```
User-agent: *
Allow: /
Disallow: /cotizacion/
Disallow: /propuesta/
Disallow: /seguimiento/
Disallow: /auth
Disallow: /dashboard
Disallow: /quotations
Disallow: /smart-quotes
Disallow: /bookings
Disallow: /opportunities
Disallow: /clients
Disallow: /leads
Disallow: /providers
Disallow: /organizations
Disallow: /agents
Disallow: /resources
Disallow: /transport
Disallow: /agenda
Disallow: /operations
Disallow: /driver
Disallow: /agreements
Disallow: /admin
Disallow: /settings

Sitemap: https://sales.viaetravel.com/sitemap.xml
```

Complemento recomendado: `<meta name="robots" content="noindex, nofollow">` en el `head()`
de las tres rutas públicas por token (defensa efectiva incluso si alguien ignora `robots.txt`).

---

## 7. Riesgos consolidados

| # | Riesgo | Severidad | Evidencia | Recomendación |
| --- | --- | --- | --- | --- |
| 1 | `ensure_provider_organization` ejecutable por `anon`, sin validar sesión; crea organizaciones y reasigna proveedores | **Crítico** | §3 (`proacl` incluye `anon=X`) | Guardia de rol + `REVOKE EXECUTE` a `anon`/`PUBLIC` |
| 2 | 77 funciones `SECURITY DEFINER` con `EXECUTE` para `anon`/`PUBLIC` | **Alto** | `pg_proc.proacl` | `REVOKE` masivo; conservar solo `booking_public_tracking` para `anon` |
| 3 | `robots.txt` indexa enlaces privados por token y paneles internos | **Alto** | `public/robots.txt` | Disallow + `noindex` en rutas por token |
| 4 | `organization_id` nullable en tablas sensibles | **Alto** | esquema | Backfill + `NOT NULL` antes de crecer en datos |
| 5 | `providers` con `USING (true)` legible por cualquier autenticado | **Medio** | `pg_policies` | Restringir a admin/operations o a la organización del usuario |
| 6 | `organizations` legible por cualquier cuenta aprobada | **Medio** | `pg_policies` | Filtrar por `is_member_of` salvo admin/operations |
| 7 | Sin rol `driver`: `/driver` visible para toda cuenta aprobada | **Medio** | auditoría general §3 | Crear rol y centralizar el gating |
| 8 | Sin rate limiting ni auditoría de acceso en rutas por token | **Bajo** | §5 | Límite por IP + log de accesos |
| 9 | Buckets `quotation-images` / `company-logos`: privacidad a nivel de bucket no verificada | **Bajo (a verificar)** | pendiente | Confirmar `public = false` |

---

## 8. Orden recomendado de corrección

1. **Riesgo 1** — parche de `ensure_provider_organization` (bloqueante, migración mínima).
2. **Riesgo 2** — `REVOKE EXECUTE` a `anon`/`PUBLIC` en todas las `SECURITY DEFINER` salvo `booking_public_tracking`.
3. **Riesgo 3** — `robots.txt` + `noindex` en las rutas por token (cambio sin riesgo funcional).
4. **Riesgos 5 y 6** — endurecer las políticas de `providers` y `organizations`.
5. **Riesgo 4** — backfill y `NOT NULL` de `organization_id` (ventana de mantenimiento).
6. **Riesgo 7** — rol `driver` + helper único de autorización y menú por rol.
7. **Riesgos 8 y 9** — rate limiting, logging de accesos públicos y verificación de buckets.

Ningún cambio fue aplicado: este documento es el diagnóstico previo a la Fase 1B.
