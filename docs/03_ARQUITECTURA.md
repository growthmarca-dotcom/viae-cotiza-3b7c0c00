# 03 — Arquitectura

## Índice
1. [Stack real](#stack-real)
2. [Estructura de carpetas](#estructura-de-carpetas)
3. [Rutas](#rutas)
4. [Capa de dominio](#capa-de-dominio)
5. [Acceso a datos](#acceso-a-datos)
6. [Server functions](#server-functions)
7. [Diseño y tema](#diseño-y-tema)
8. [Convenciones](#convenciones)

## Stack real

| Capa | Tecnología |
| --- | --- |
| Framework | TanStack Start v1 (SSR, edge/worker) + Vite 8 |
| UI | React 19, TypeScript, Tailwind CSS v4 (`src/styles.css`), shadcn/ui (Radix) |
| Router | TanStack Router (rutas de archivo en `src/routes`) |
| Estado de datos | TanStack Query v5 |
| Backend | Lovable Cloud (Postgres + Auth + Storage + Realtime) |
| Formularios | react-hook-form + zod |
| Gráficos | recharts · Iconos: lucide-react · Toasts: sonner |

No hay Redux, ni React Router DOM, ni edge functions propias: la lógica vive en la
base de datos (funciones/triggers) y en el cliente tipado.

## Estructura de carpetas

```
src/
  routes/                 # rutas de archivo (TanStack Router)
    __root.tsx            # layout raíz + head global
    index.tsx             # landing pública
    auth.tsx              # login / registro (con aprobación)
    cotizacion.$token.tsx # cotización pública por token
    seguimiento.$token.tsx# seguimiento público del viaje
    _authenticated/       # subárbol protegido (route.tsx = gate)
  components/             # componentes de dominio + ui/ (shadcn)
  lib/                    # capa de dominio: 1 archivo por módulo
  hooks/                  # use-account, use-analysis-currency, use-mobile, ...
  integrations/supabase/  # cliente autogenerado + tipos (no editar)
  styles.css              # tokens de diseño y tema
supabase/migrations/      # historia completa del esquema (48 migraciones)
docs/                     # esta documentación
```

## Rutas

Públicas: `/`, `/auth`, `/cotizacion/$token`, `/seguimiento/$token`.

Protegidas bajo `_authenticated/` (gate + `AccountGate` para estado de cuenta):
`/dashboard`, `/quotations` (`index`, `new`, `$id`, `$id/edit`), `/clients` y
`/clients/$id`, `/leads` y `/leads/$id`, `/agents` y `/agents/$id`, `/bookings` y
`/bookings/$id`, `/operations`, `/resources` y `/resources/$id`, `/transport`,
`/agenda`, `/driver`, `/organizations` y `/organizations/$id`, `/providers` y
`/providers/$id`, `/agreements`, `/admin`, `/settings`.

## Capa de dominio

Cada módulo tiene un archivo en `src/lib/` que concentra tipos, etiquetas en
español, validaciones y llamadas a la base: `quotations`, `clients`, `crm`,
`opportunities`, `leads`, `agents`, `bookings`, `operations`, `checklist`,
`passengers`, `timeline`, `trip-state`, `resources`, `resource-catalog`,
`transport`, `transport-ops`, `transport-economics`, `driver`, `organizations`,
`providers`, `agreements`, `commissions`, `exchange-rates`, `currency`,
`company`, `communication`, `notifications`, `audit`, `export`, `geo`,
`client-tracking`.

Regla: los componentes no arman consultas SQL/PostgREST propias; usan estos módulos.

## Acceso a datos

- Cliente del navegador: `import { supabase } from "@/integrations/supabase/client"` — siempre bajo RLS.
- Lógica sensible o de negocio compleja: **funciones de base de datos** llamadas por RPC
  (`booking_trip_state`, `simulate_commission`, `resolve_agreement`, `rate_at`,
  `booking_public_tracking`, `mark_notifications_read`, `claim_admin_if_none`, ...).
- Realtime: notificaciones y eventos operativos.
- Storage: bucket `quotation-images`, acceso mediante **signed URLs**.

## Server functions

Único uso actual: `src/lib/public-quotation.functions.ts` — valida el token de la
cotización pública en el servidor con el cliente admin y devuelve solo los campos
publicables (sin costos ni datos internos). No hay endpoints HTTP públicos propios.

## Diseño y tema

Tokens semánticos definidos en `src/styles.css` (blanco/beige, verde oscuro `primary`,
dorado `gold`). Los componentes usan tokens, no colores literales. El footer
"Desarrollado por MarCa Growth" aparece solo en pantallas internas
(`use-developer-branding`), nunca en cotizaciones públicas ni PDF.

## Convenciones

- Español en toda la UI y en los comentarios de dominio.
- Nunca `DELETE`: `record_status = 'archived'`.
- Timestamps `created_at` / `updated_at` con trigger `tg_set_updated_at`.
- Historial en tablas `*_history` y `audit_log`, siempre append-only.
- `src/integrations/supabase/*` y `src/routeTree.gen.ts` son autogenerados.
