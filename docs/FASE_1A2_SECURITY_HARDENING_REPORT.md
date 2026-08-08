# FASE 1A.2 — Informe de hardening de seguridad (ViaE Sales Hub)

> Fecha: agosto 2026 · Alcance: **solo** las correcciones confirmadas en
> `docs/FASE_1A_SECURITY_AUDIT_REPORT.md`. Una migración aplicada + `robots.txt` +
> `noindex` en tres rutas. Sin cambios de esquema, RLS, grants de tablas ni lógica comercial.

## 1. Resumen

| # | Corrección | Estado |
| --- | --- | --- |
| 1 | `ensure_provider_organization`: guardia de sesión + rol y revocación de `anon` | ✅ Aplicada |
| 2 | Revocación **selectiva** de `EXECUTE` a `anon`/`PUBLIC` en 76 funciones `SECURITY DEFINER` | ✅ Aplicada |
| 3 | `booking_public_tracking` conservada como única función `SECURITY DEFINER` pública | ✅ Verificada |
| 4 | `robots.txt` + `noindex, nofollow` en `/cotizacion/$token`, `/propuesta/$token`, `/seguimiento/$token` | ✅ Aplicada |

Resultado verificado en la base: hoy **ninguna** función `SECURITY DEFINER` de `public`
es ejecutable por `anon`, salvo `booking_public_tracking`.

---

## 2. `ensure_provider_organization`

### Estado anterior
- `SECURITY DEFINER`, owner `postgres`, `search_path = public`.
- `EXECUTE`: `postgres`, **`anon`**, `authenticated`, `service_role`, y `=X/postgres` (PUBLIC).
- Cuerpo sin ninguna lectura de `auth.uid()`.

### Vulnerabilidad
Al correr como `postgres` saltaba RLS. Un llamador **sin sesión** que conociera un
`provider_id` podía: crear una fila en `organizations`, insertar `organization_roles`
con rol `provider`, y reasignar `providers.organization_id` — incluso vinculando el
proveedor a una organización existente por coincidencia laxa de `trade_name`.
Severidad: **Crítico** (integridad del modelo multiempresa).

### Cambio aplicado (mínimo y explícito)
Se añadieron **cuatro líneas** al inicio del cuerpo, sin tocar el resto de la lógica:

```sql
DECLARE ... v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_operations(v_uid) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  ...  -- lógica original intacta
```

`is_operations()` = admin **o** rol `operations`. Se eligió ese umbral porque coincide
exactamente con el gating ya existente en la UI: `src/routes/_authenticated/providers_.$id.tsx`
carga la ficha y muestra el botón "Vincular organización" solo cuando `isOperations` es
verdadero (líneas 67–124, 195–204). Ningún flujo legítimo pierde acceso.

Único invocador en el código: `ensureProviderOrganization()` en `src/lib/organizations.ts:319`,
usado desde esa ficha. `service_role` conserva `EXECUTE` (el guardia por `auth.uid()` sí
aplica también al backend; no hay hoy ningún llamador de servidor).

### Estado posterior — grants finales
```
ensure_provider_organization: postgres=X | authenticated=X | service_role=X
```
`anon` y `PUBLIC` ya no aparecen. La función no se eliminó ni cambió de propósito.

---

## 3. Funciones `SECURITY DEFINER` — análisis individual

Criterios aplicados por función: finalidad, invocadores reales (`rg "\.rpc\("` sobre `src/`),
si es función de trigger (`RETURNS trigger` → no invocable fuera de un trigger),
si escribe datos, y si depende de `auth.uid()`.

Leyenda de clasificación: **A** = anon necesario · **B** = authenticated ·
**C** = service_role/backend (trigger interno) · **D** = requiere revisión.

| Función | Anon antes | Anon después | Clasificación | Acción |
|---------|------------|--------------|---------------|--------|
| booking_public_tracking | ✔ | ✔ | A | **Conservada** — `/seguimiento/$token`; devuelve 6 campos no sensibles y filtra por token + `tracking_enabled` + `record_status` |
| ensure_provider_organization | ✔ | ✖ | B (admin/ops) | Guardia + revoke |
| can_create_opportunity_for_organization | ✔ | ✖ | B | Revoke |
| can_manage_availability_profile | ✔ | ✖ | B | Revoke |
| can_manage_organization_members | ✔ | ✖ | B | Revoke |
| can_manage_package | ✔ | ✖ | B | Revoke |
| can_manage_package_template | ✔ | ✖ | B | Revoke |
| can_manage_pricing_profile | ✔ | ✖ | B | Revoke |
| can_manage_search_request | ✔ | ✖ | B | Revoke |
| can_manage_search_result | ✔ | ✖ | B | Revoke |
| can_manage_smart_quote | ✔ | ✖ | B | Revoke |
| can_read_package | ✔ | ✖ | B | Revoke |
| can_read_package_template | ✔ | ✖ | B | Revoke |
| can_read_search_request | ✔ | ✖ | B | Revoke |
| can_read_search_result | ✔ | ✖ | B | Revoke |
| can_read_smart_quote | ✔ | ✖ | B | Revoke |
| currency_rate_at | ✔ | ✖ | B | Revoke — usada por `src/lib/money.ts:129` solo con sesión; las rutas públicas no la invocan (`/cotizacion` usa `lib/currency.ts`, `/propuesta` usa server fn con cliente de servidor) |
| current_agent_id | ✔ | ✖ | B | Revoke — `src/lib/pipeline.ts:23` |
| has_org_role | ✔ | ✖ | B | Revoke |
| is_member_of | ✔ | ✖ | B | Revoke |
| is_operations | ✔ | ✖ | B | Revoke |
| mark_notifications_read | ✔ | ✖ | B | Revoke — `src/lib/notifications.ts:98,104`; ya exigía sesión internamente |
| notify_operations_team | ✔ | ✖ | C | Revoke — helper interno de notificación |
| provider_in_package_template | ✔ | ✖ | B | Revoke |
| resolve_opportunity_organization | ✔ | ✖ | B | Revoke |
| resolve_smart_quote_organization | ✔ | ✖ | B | Revoke — `src/lib/smartQuotes.ts:216` |
| smart_quote_share_revoke | ✔ | ✖ | B | Revoke — `smartQuotes.ts:1085`; ya exigía `can_manage_smart_quote` |
| smart_quote_share_token | ✔ | ✖ | B | Revoke — `smartQuotes.ts:1070`; ídem |
| sync_booking_client_status | ✔ | ✖ | C | Revoke |
| log_quotation_change | ✔ | ✖ | C | Revoke (trigger) |
| log_role_change | ✔ | ✖ | C | Revoke (trigger) |
| log_status_change | ✔ | ✖ | C | Revoke (trigger) |
| prevent_last_admin_removal | ✔ | ✖ | C | Revoke (trigger) |
| tg_agreement_history | ✔ | ✖ | C | Revoke (trigger) |
| tg_audit_branding_change | ✔ | ✖ | C | Revoke (trigger) |
| tg_audit_checklist | ✔ | ✖ | C | Revoke (trigger) |
| tg_audit_communication_event | ✔ | ✖ | C | Revoke (trigger) |
| tg_audit_incident | ✔ | ✖ | C | Revoke (trigger) |
| tg_booking_operations | ✔ | ✖ | C | Revoke (trigger) |
| tg_booking_require_organization | ✔ | ✖ | C | Revoke (trigger) |
| tg_booking_service_events | ✔ | ✖ | C | Revoke (trigger) |
| tg_booking_smart_quote_same_org | ✔ | ✖ | C | Revoke (trigger) |
| tg_booking_status_history | ✔ | ✖ | C | Revoke (trigger) |
| tg_lead_comment_activity | ✔ | ✖ | C | Revoke (trigger) |
| tg_lead_history | ✔ | ✖ | C | Revoke (trigger) |
| tg_lead_notifications | ✔ | ✖ | C | Revoke (trigger) |
| tg_notify_transport_events | ✔ | ✖ | C | Revoke (trigger) |
| tg_opportunity_guard_update | ✔ | ✖ | C | Revoke (trigger) |
| tg_opportunity_history | ✔ | ✖ | C | Revoke (trigger) |
| tg_opportunity_require_organization | ✔ | ✖ | C | Revoke (trigger) |
| tg_quotation_opportunity_same_org | ✔ | ✖ | C | Revoke (trigger) |
| tg_quotation_require_organization | ✔ | ✖ | C | Revoke (trigger) |
| tg_quotation_smart_quote_same_org | ✔ | ✖ | C | Revoke (trigger) |
| tg_resource_availability_log | ✔ | ✖ | C | Revoke (trigger) |
| tg_resource_catalog_audit | ✔ | ✖ | C | Revoke (trigger) |
| tg_seed_booking_checklist | ✔ | ✖ | C | Revoke (trigger) |
| tg_smart_quote_coherence | ✔ | ✖ | C | Revoke (trigger) |
| tg_smart_quote_currency_propagate | ✔ | ✖ | C | Revoke (trigger) |
| tg_smart_quote_guard_update | ✔ | ✖ | C | Revoke (trigger) |
| tg_smart_quote_item_currency | ✔ | ✖ | C | Revoke (trigger) |
| tg_smart_quote_normalize_currency | ✔ | ✖ | C | Revoke (trigger) |
| tg_smart_quote_pricing_currency | ✔ | ✖ | C | Revoke (trigger) |
| tg_smart_quote_recalc_total | ✔ | ✖ | C | Revoke (trigger) |
| tg_smart_quote_require_organization | ✔ | ✖ | C | Revoke (trigger) |
| tg_smart_quote_version_number | ✔ | ✖ | C | Revoke (trigger) |
| tg_sync_booking_client_status | ✔ | ✖ | C | Revoke (trigger) |
| tg_timeline_booking_documents | ✔ | ✖ | C | Revoke (trigger) |
| tg_timeline_booking_payments | ✔ | ✖ | C | Revoke (trigger) |
| tg_timeline_booking_services | ✔ | ✖ | C | Revoke (trigger) |
| tg_timeline_bookings | ✔ | ✖ | C | Revoke (trigger) |
| tg_timeline_checklist | ✔ | ✖ | C | Revoke (trigger) |
| tg_timeline_communication | ✔ | ✖ | C | Revoke (trigger) |
| tg_timeline_incidents | ✔ | ✖ | C | Revoke (trigger) |
| tg_transport_communication_events | ✔ | ✖ | C | Revoke (trigger) |
| tg_transport_economics_audit | ✔ | ✖ | C | Revoke (trigger) |
| tg_transport_service_history | ✔ | ✖ | C | Revoke (trigger) |
| tg_validate_currency_exchange_rate | ✔ | ✖ | C | Revoke (trigger) |

**Total: 77 funciones** (76 revocadas + 1 conservada). No se ejecutó ningún
`REVOKE ... ON ALL FUNCTIONS`: la migración recorre una **lista nominal explícita** y
revoca solo `EXECUTE` para `anon` y `PUBLIC`, conservando `authenticated`, `service_role`
y `postgres`. `create_booking_timeline_event` no formaba parte del grupo: ya estaba
restringida a `service_role` y se dejó como está.

Funciones que ya exigían sesión/rol internamente (`claim_admin_if_none`,
`mark_notifications_read`, `smart_quote_share_*`, `simulate_commission`) **conservan** esa
validación: el revoke es defensa en profundidad, no reemplazo de la lógica.

Ninguna función clasificada **D** (no hubo hallazgos estructurales nuevos que obligaran a detener una corrección).

---

## 4. `robots.txt`

### Estado anterior
`Allow: /` para Googlebot, Bingbot, Twitterbot, facebookexternalhit y `*`,
**sin ningún `Disallow`** ni `Sitemap`.

### Cambios
- `Disallow` de las tres rutas por token: `/cotizacion/`, `/propuesta/`, `/seguimiento/`.
- `Disallow` de los paneles internos (`/dashboard`, `/quotations`, `/smart-quotes`,
  `/bookings`, `/opportunities`, `/clients`, `/leads`, `/providers`, `/organizations`,
  `/agents`, `/resources`, `/transport`, `/agenda`, `/operations`, `/driver`,
  `/agreements`, `/admin`, `/settings`, `/auth`).
- `Allow: /` se mantiene para la landing pública (`/`), que sí debe indexarse.
- Se agregó `Sitemap: https://sales.viaetravel.com/sitemap.xml`.

### Criterio sobre `/propuesta/$token`
La página **sigue siendo accesible por enlace** (no se tocó su lógica). Se bloquea su
indexación porque su contenido es comercialmente privado (precios, pasajeros, contacto):
"compartible por enlace" ≠ "público para buscadores". El modelo de producto no requiere
que las propuestas aparezcan en resultados de búsqueda.

### robots.txt no es una barrera de seguridad
Por eso se añadió, además, `<meta name="robots" content="noindex, nofollow">` en el
`head()` de las tres rutas (`propuesta.$token.tsx`, `cotizacion.$token.tsx`,
`seguimiento.$token.tsx`), que sí es respetado aun cuando un crawler ignore `robots.txt`.
La protección real de esos datos sigue siendo la misma que ya existía y **no se modificó**:
token aleatorio de alta entropía, validación de formato, control de vencimiento
(`expires_at` / `share_expires_at`), estado (`archived`, `record_status`) y lista blanca
de campos en las server functions (`public-quotation.functions.ts`,
`public-smart-quote.functions.ts`). Los paneles internos siguen protegidos por sesión
(`_authenticated/route.tsx`) y RLS.

---

## 5. Verificación

| Check | Resultado |
| --- | --- |
| `anon` puede ejecutar `ensure_provider_organization` | ❌ No — acl final `postgres=X, authenticated=X, service_role=X` |
| Funciones `SECURITY DEFINER` en `public` ejecutables por `anon` | **1** (`booking_public_tracking`, intencional) |
| Funciones que requieren autenticación expuestas a `anon` | 0 |
| Funciones públicas legítimas operativas | `booking_public_tracking` intacta (definición sin cambios) |
| Typecheck (`tsgo --noEmit`) | ✅ 0 errores |
| Lint (`npm run lint`) | 🟡 7011 hallazgos **preexistentes** de formato (`prettier/prettier`) en todo el proyecto; no se ejecutó `--fix` para no introducir un refactor masivo fuera de alcance |
| Tests | ⚠️ No existe script de test en `package.json` (deuda ya registrada en la auditoría general) |
| Build | El pipeline de la plataforma compila el proyecto en cada cambio; typecheck limpio |
| RLS | ✅ 97/97 tablas de `public` con RLS habilitado (sin cambios) |
| Políticas para `anon`/`PUBLIC` | ✅ 0 (sin cambios) |
| Esquema de tablas | ✅ Sin `CREATE`/`ALTER TABLE` en la migración |

### Flujos funcionales revisados (análisis de invocadores + typecheck)
- **Proveedores**: `ensureProviderOrganization` se invoca solo desde la ficha, que ya
  exige `isOperations` → mismo umbral que el nuevo guardia. Sin regresión.
- **Organizaciones**: sin cambios de RLS ni de lectura.
- **Consultas / Oportunidades / Smart Quotes / Cotizaciones / Reservas**: todas las RPC
  que usan (`current_agent_id`, `resolve_smart_quote_organization`, `smart_quote_share_*`,
  `mark_notifications_read`, `booking_trip_state`, `simulate_commission*`,
  `currency_rate_at`) se llaman con el cliente **autenticado**, cuyo rol es
  `authenticated` — permiso conservado.
- **Seguimiento público**: única ruta que llama a una RPC como `anon`
  (`booking_public_tracking`, `src/lib/client-tracking.ts:75`) → permiso conservado.

---

## 6. Cambios NO realizados

Esta fase **no** modificó:
- ❌ RLS (ni `ENABLE/DISABLE`, ni políticas: 0 `CREATE/ALTER/DROP POLICY`).
- ❌ Grants de tablas (0 `GRANT`/`REVOKE` sobre tablas).
- ❌ Esquema de datos (0 `CREATE/ALTER/DROP TABLE`, columna o tipo).
- ❌ `organization_id` en ninguna tabla (ni nullabilidad ni backfill).
- ❌ Modelo de entidades (`companies`/`providers`/`organizations`, `persons`… sin tocar).
- ❌ Flujo comercial (Opportunity → Smart Quote → Quotation → Booking sin cambios).
- ❌ Módulos dormidos (tarifas, disponibilidad, itinerarios, inventario, orquestador, paquetes).
- ❌ Arquitectura general, ni refactors ajenos a la corrección.
- ❌ Ninguna función fue eliminada ni reemplazada; solo se reescribió el cuerpo de
  `ensure_provider_organization` añadiendo el guardia.

---

## 7. Riesgos pendientes (no corregidos en esta fase)

| # | Riesgo | Severidad | Nota |
| --- | --- | --- | --- |
| 1 | **Discrepancia con el informe 1A**: 80 tablas de `public` **sí** tienen `GRANT` a `anon` (`arwdDxtm` en 79, `awdDxtm` en 1). El informe 1A dijo "ninguno" porque `information_schema.role_table_grants` devuelve vacío para el rol de solo lectura usado en la auditoría; `pg_class.relacl` muestra la realidad. **No hay exposición hoy**: existen 0 políticas para `anon`, así que RLS bloquea todas las filas. Aun así, el grant es superficie innecesaria. | **Medio** | Fuera de alcance: la Fase 1A.2 prohíbe tocar grants de tablas. Tratar en 1B con verificación fila a fila |
| 2 | 14 funciones `SECURITY INVOKER` siguen ejecutables por `anon` (`booking_trip_state`, `compute_commission`, `calculate_passenger_age`, `default_checklist_items`, `validate_opportunity` y 9 funciones de trigger). Al ser `INVOKER` corren con los permisos del llamador y RLS aplica → sin filtración. | **Bajo** | Revisar en 1B |
| 3 | `providers` con política `USING (true)` para `authenticated` | **Medio** | No corregido: implicaría cambiar RLS, prohibido en esta fase |
| 4 | `organizations` legible por cualquier cuenta aprobada | **Medio** | Ídem |
| 5 | `organization_id` nullable en tablas sensibles | **Alto** | Requiere backfill + `NOT NULL` (Fase 1B/2) |
| 6 | Sin rol `driver`; `/driver` visible para toda cuenta aprobada | **Medio** | Fase 1B |
| 7 | Sin rate limiting ni log de accesos en las rutas por token | **Bajo** | Fase 3 del plan general |
| 8 | Privacidad a nivel de bucket de `quotation-images` / `company-logos` sin verificar | **Bajo** | Pendiente de comprobación |
| 9 | Linter de base: quedan advertencias de `search_path` mutable en funciones `SECURITY INVOKER` y avisos genéricos | **Bajo** | No bloqueante |
| 10 | 7011 hallazgos de formato de `prettier` preexistentes; sin tests ni CI | **Bajo** | Deuda ya registrada |

**No se avanzó a la Fase 1B.** Este documento cierra la Fase 1A.2 para revisión.
