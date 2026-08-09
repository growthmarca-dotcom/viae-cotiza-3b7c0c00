# FASE 1A.3 — Auditoría y preparación del entorno de STAGING

> Fecha: agosto 2026 · **Solo diagnóstico**. No se modificó código funcional, esquema,
> datos, RLS, políticas, grants, funciones, variables, dominios ni migraciones.
> No se implementó staging. No se inició la Fase 1B.
> Ningún valor secreto se reproduce en este documento.

---

## 1. Estado actual de infraestructura

| Elemento | Estado verificado |
| --- | --- |
| Proveedor de base de datos | Postgres gestionado por **Lovable Cloud** (backend administrado) |
| Proyecto/base conectada | **Un único proyecto backend**, el mismo para Preview y Producción |
| Entorno del sitio publicado | El mismo backend que usa el editor/Preview |
| URL de backend | Endpoint gestionado del backend (no se publica aquí; vive en variables de entorno) |
| URL de frontend (Lovable) | `https://viae-cotiza.lovable.app` |
| Preview | `https://id-preview--<project-id>.lovable.app` |
| Dominio de producción | `https://sales.viaetravel.com` (dominio propio conectado) |
| Autenticación | Auth gestionado del backend: email + contraseña, aprobación manual (`profiles.status`), roles en `user_roles`; sin registro libre |
| Despliegue | Build de TanStack Start desplegado por Lovable a runtime edge (Workers). Frontend requiere “Publish”; los cambios de backend (migraciones) se aplican de inmediato |

### Variables de entorno (solo nombres y finalidad)

| Variable | Finalidad | Entorno | Separación |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | URL del backend para el cliente del navegador | Producción (única) | ❌ No hay variante de staging |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave publicable del cliente navegador | Producción (única) | ❌ |
| `VITE_SUPABASE_PROJECT_ID` | Identificador del proyecto backend | Producción (única) | ❌ |
| `SUPABASE_URL` | URL del backend en server functions | Producción (única) | ❌ |
| `SUPABASE_PUBLISHABLE_KEY` | Lecturas públicas server-side | Producción (única) | ❌ |
| `SUPABASE_PROJECT_ID` | Referencia del proyecto server-side | Producción (única) | ❌ |
| `SUPABASE_SERVICE_ROLE_KEY` | Cliente privilegiado (`client.server.ts`), rutas públicas por token | Producción (única) | ❌ (inaccesible por diseño en Lovable Cloud) |

**Conclusión:** existe **un solo conjunto de variables**. No hay separación producción/staging
en ningún nivel (frontend, server functions, base de datos, storage, auth).

---

## 2. Arquitectura de deployment

```
Editor Lovable ──► Preview (id-preview--…lovable.app)  ─┐
                                                        ├──► MISMO backend gestionado
Publish ──► viae-cotiza.lovable.app + sales.viaetravel.com ─┘   (DB + Auth + Storage)
```

- **Preview**: build de desarrollo servido por Lovable; se actualiza en cada cambio de código.
- **Publicación**: los cambios de *frontend* requieren pulsar “Publish/Update”.
- **Backend**: las migraciones y cambios de esquema se aplican **directamente y de inmediato**,
  sin paso intermedio de aprobación y sin entorno previo de prueba.
- **Variables**: gestionadas por la plataforma; un único juego, compartido por Preview y Producción.

---

## 3. Arquitectura de base de datos

- Base única, esquema `public` con **97 tablas**, todas con RLS habilitado (Fase 1A.2).
- Volumen actual verificado (bajo, favorable para reconstrucción):
  5 usuarios de Auth, 3 organizaciones, 8 clientes, 21 cotizaciones, 3 reservas,
  0 smart quotes, 0 `communication_events`.
- Storage: 2 buckets, ambos **privados** (`public = false`): `quotation-images`, `company-logos`.
  (Esto cierra el riesgo #9 abierto en la Fase 1A.)
- Sin `pg_cron`/`pg_net` en migraciones: no hay jobs programados que puedan disparar efectos externos.
- Sin edge functions (`supabase/functions/` no existe) y sin rutas HTTP públicas (`src/routes/api/` no existe).

---

## 4. Sistema de migraciones

| Punto | Hallazgo |
| --- | --- |
| Ubicación | `supabase/migrations/` (repositorio del proyecto) |
| Cantidad | **82 archivos** (`20260727184149…` → `20260808005756…`) |
| Mecanismo de aplicación | Herramienta de migración de la plataforma; registro en `supabase_migrations.schema_migrations` |
| Historial | ✅ Existe: **82 filas** en `schema_migrations`, coincidencia exacta 82/82 con los archivos del repo |
| ¿Reproducible desde cero? | 🟡 **Probablemente sí para el esquema**, pero **no verificado** — nunca se ejecutó un replay limpio |
| Migraciones manuales fuera del repo | No detectadas (no hay versiones huérfanas en el historial) |
| Cambios de DB no representados | 🟡 Riesgo en objetos **no** creados por migración: buckets de Storage, ajustes de configuración de Auth (confirmación de email, proveedores) y usuarios/roles iniciales. Estos son estado de plataforma, no SQL versionado |

**Veredicto:** el esquema SQL está versionado y es plausible reconstruirlo; **la configuración de
Auth y los buckets de Storage no lo están** y deben documentarse/scriptarse antes de considerar
staging reproducible.

---

## 5. Estado actual de Preview

Respuesta a la pregunta A/B/C/D: **opción A — el Preview usa la MISMA base de datos de producción.**

Evidencia:
- Un único juego de variables `VITE_SUPABASE_*` / `SUPABASE_*` en el proyecto.
- `src/integrations/supabase/client.ts` resuelve siempre esas variables, sin ramas por entorno.
- No hay archivos `.env.staging`, ni lógica condicional por `MODE`/`NODE_ENV` en la capa de datos.

Consecuencia directa: **cualquier prueba hecha en Preview escribe en producción**
(clientes, cotizaciones, reservas, roles, storage y usuarios reales).

---

## 6. Riesgos de probar cambios estructurales directamente en producción

| # | Riesgo | Severidad | Nota |
| --- | --- | --- | --- |
| 1 | `ALTER … SET NOT NULL` sobre `organization_id` falla o bloquea con filas legacy | **Alto** | Sin rollback trivial en producción |
| 2 | Un cambio de RLS demasiado restrictivo deja a agentes reales sin ver sus datos | **Alto** | Interrupción comercial inmediata |
| 3 | Un cambio de RLS demasiado laxo filtra datos entre organizaciones | **Crítico** | Fuga de datos personales/comerciales reales |
| 4 | Nuevo rol (`driver`) mal asignado altera permisos de usuarios activos | **Medio** | |
| 5 | Backfills masivos sin ensayo previo corrompen relaciones comerciales | **Alto** | Sin snapshot verificado por el equipo |
| 6 | Pruebas de tokens públicos generan enlaces reales compartibles | **Medio** | `/propuesta`, `/cotizacion`, `/seguimiento` |
| 7 | Migración irreversible sin punto de restauración validado | **Alto** | No se ha probado ningún restore |
| 8 | Los datos de prueba contaminan métricas y dashboards reales | **Bajo** | Ya ocurre hoy en Preview |

---

## 7. Opciones de staging

### Opción A — Segundo proyecto backend completamente separado
- **Ventajas:** aislamiento total de DB, Auth, Storage y claves; permite ensayar migraciones destructivas; permite validar RLS con usuarios ficticios.
- **Desventajas:** requiere mantener dos juegos de variables y replicar configuración de Auth/buckets; doble mantenimiento de migraciones.
- **Aislamiento:** ★★★★★ · **Complejidad:** media-alta · **Riesgo:** bajo
- **Impacto Lovable:** requiere un segundo proyecto Lovable (o reconexión manual de variables), que hoy no puede hacerse sin decisión del propietario.
- **Auth:** separado (usuarios de prueba propios). **Migraciones:** replay de los 82 archivos. **Storage:** buckets nuevos vacíos.

### Opción B — Entorno de staging provisto por la infraestructura actual
- **Ventajas:** sería la vía más limpia si existiese soporte nativo de “branch”/entorno.
- **Desventajas:** **no disponible hoy** en este proyecto: la plataforma expone un único backend gestionado por proyecto, y Preview/Producción lo comparten.
- **Aislamiento:** n/a · **Recomendación:** descartada por indisponibilidad verificada.

### Opción C — Preview apuntando a una base de prueba
- **Ventajas:** un solo repositorio; se prueba el mismo código.
- **Desventajas:** exige variables por entorno en la capa de datos, que hoy es un cliente generado y no debe editarse; alto riesgo de que un despliegue cruce entornos por error de variable. Además Preview y Producción comparten el mismo juego de variables en esta plataforma.
- **Aislamiento:** ★★☆☆☆ (dependiente de configuración) · **Riesgo:** alto (cruce silencioso)
- **Recomendación:** no recomendada como mecanismo principal.

### Opción D — Réplica local reproducible (recomendada como primer paso)
Ejecutar el stack de base de datos en local/CI a partir de los 82 archivos de
`supabase/migrations/` + un script de semilla sintética.
- **Ventajas:** **cero impacto** sobre producción, Lovable, dominios y variables; no requiere aprobación de infraestructura; valida de inmediato la hipótesis “el esquema es reproducible”; permite ensayar `NOT NULL`, backfills y RLS con usuarios ficticios; desechable y repetible.
- **Desventajas:** no valida el frontend publicado ni el dominio; Auth/Storage locales no son idénticos al gestionado.
- **Aislamiento:** ★★★★★ · **Complejidad:** baja · **Riesgo:** nulo
- **Recomendación:** ✅ **Fase 1A.4 inmediata.**

---

## 8. Comparación

| Criterio | A (2º proyecto) | B (nativo) | C (Preview→test) | D (réplica local) |
| --- | --- | --- | --- | --- |
| Aislamiento de datos | Total | n/a | Parcial | Total |
| Aislamiento de Auth | Total | n/a | Parcial | Total |
| Aislamiento de Storage | Total | n/a | Ninguno por defecto | Total |
| Riesgo de cruzar producción | Bajo | n/a | **Alto** | **Nulo** |
| Requiere aprobación/infra | Sí | No disponible | Sí | **No** |
| Valida migraciones | Sí | n/a | Sí | Sí |
| Valida RLS y roles | Sí | n/a | Sí | Sí |
| Valida frontend publicado | Sí | n/a | Sí | No |
| Coste de mantenimiento | Medio-alto | n/a | Alto | Bajo |

---

## 9. Recomendación

**Estrategia en dos pasos:**

1. **Fase 1A.4 — Réplica local reproducible (Opción D).** Sin aprobaciones ni cambios de
   infraestructura. Objetivo verificable: reconstruir el esquema desde los 82 archivos en una
   base vacía, sembrar datos sintéticos y ensayar allí **todo** el plan de la Fase 1B
   (`organization_id NOT NULL`, rol `driver`, endurecimiento de RLS de `providers` y
   `organizations`). Si el replay falla, ese hallazgo por sí solo justifica la fase.
2. **Fase 1A.5 — Segundo entorno gestionado (Opción A), solo con aprobación explícita.**
   Necesario para validar el frontend publicado, los enlaces públicos por token y el flujo
   de Auth end-to-end antes de tocar producción.

No se recomienda la Opción C como mecanismo principal, y la Opción B no está disponible.

---

## 10. Arquitectura propuesta

```
PRODUCCIÓN
  Frontend : sales.viaetravel.com  (+ viae-cotiza.lovable.app)
  Backend  : proyecto actual — DB + Auth + Storage reales
  Cambios  : solo migraciones ya ensayadas en staging

STAGING (Fase 1A.5, requiere aprobación)
  Frontend : staging.sales.viaetravel.com
  Backend  : segundo proyecto — DB/Auth/Storage propios, datos 100% sintéticos
  Variables: mismo NOMBRE de variables, valores distintos por entorno

LAB LOCAL (Fase 1A.4, sin aprobación)
  DB efímera reconstruida desde supabase/migrations/ + seed sintético
  Uso: ensayo de migraciones destructivas y matriz de pruebas de RLS
```

Regla de promoción: **local → staging → producción**. Ninguna migración estructural llega a
producción sin haberse aplicado y revertido con éxito antes en los dos entornos previos.

---

## 11. Datos de prueba recomendados

Alternativa elegida: **B — copia del esquema + datos sintéticos** (nunca C).
Se descarta explícitamente copiar datos reales: hay clientes, pasajeros y proveedores
identificables. Una copia sanitizada solo se consideraría con un procedimiento de
anonimización aprobado por separado, y no es necesaria para los objetivos de la Fase 1B.

Conjunto mínimo (todo ficticio, dominios `@example.test`, CUIT/teléfonos inválidos por diseño):

| Entidad | Cantidad | Propósito de prueba |
| --- | --- | --- |
| Organizaciones | 3 (Org A, Org B, Org C sin miembros) | Aislamiento multiempresa y filas huérfanas |
| Usuarios de Auth | 6 | admin global, operaciones, 2 agentes Org A, 1 agente Org B, 1 pendiente de aprobación |
| Roles (`user_roles`) | 4 asignaciones | admin / operations / agent, y un usuario sin rol |
| `organization_members` | 5 | owner+member en A, owner en B, ninguno en C |
| Agentes | 3 | Métricas por agente y visibilidad propia |
| Proveedores / organizaciones proveedoras | 2 | Endurecimiento de RLS de `providers` |
| Clientes | 6 (4 en A, 2 en B) | Fuga cruzada entre organizaciones |
| Oportunidades | 6 | Etapas del pipeline y permisos del agente asignado |
| Smart quotes | 4 (1 con token público, 1 expirado) | Vista pública y filtrado de costos |
| Cotizaciones | 5 (1 archivada, 1 con token) | Enlace público y herencia de contexto |
| Reservas | 4 (distintos estados operativos) | Timeline, trip state y economía por rol |
| Recursos | 5 (alojamiento, vehículo, guía, extra, rent a car) | Catálogo y subtipos |
| Servicios de transporte | 4 (1 sin asignar, 1 con conductor) | Agenda, advertencias y panel del conductor |
| Filas legacy intencionadas | 3 con `organization_id` NULL | Ensayo del backfill y del `NOT NULL` de la Fase 1B |

---

## 12. Auth / Storage / integraciones a aislar

| Componente | Estado hoy | Acción para staging |
| --- | --- | --- |
| Auth (proveedores, plantillas de email) | Único, compartido con producción | Proyecto propio; email de confirmación desactivado o dominio de captura |
| Usuarios | 5 reales | Solo usuarios sintéticos; nunca importar reales |
| Buckets `quotation-images`, `company-logos` | ✅ ambos privados, únicos | Buckets nuevos vacíos en staging |
| URLs firmadas de Storage | Generadas contra el proyecto de producción | Se aíslan automáticamente al separar el proyecto |
| Server functions | En el bundle de la app; una única URL de backend | Se aíslan por variables de entorno |
| Rutas HTTP públicas / webhooks | **No existen** (`src/routes/api/` ausente) | Nada que aislar hoy |
| Edge functions | **No existen** | — |
| Jobs programados (`pg_cron`/`pg_net`) | **No detectados** en migraciones | Verificar antes de cada promoción |
| WhatsApp | `communication_events` **solo registra intención** (0 filas); el envío es manual por el operador | Marcar el entorno visualmente y no conectar ningún proveedor de envío |
| Emails comerciales | Sin proveedor transaccional integrado | Si se añade, exigir `sandbox`/dominio de captura en staging |
| Pagos | Ninguno integrado | Prohibido conectar credenciales reales en staging |
| APIs externas de proveedores | Motores de disponibilidad/orquestador **sin conectores reales** (solo estructura) | Cuando existan, staging debe usar credenciales de sandbox obligatorias |

**Riesgo actual de efectos externos accidentales: BAJO.** No hay integraciones salientes
activas. La ventana de riesgo se abre en el momento en que se conecten WhatsApp, email
transaccional o APIs de proveedores; la regla de sandbox debe fijarse **antes** de ese momento.

---

## 13. Criterios de aceptación del staging

Staging se declara listo cuando **todos** se cumplen y quedan evidenciados:

1. Base de datos distinta de producción (identificador de proyecto distinto, verificado).
2. Auth separado: ningún usuario real presente; alta de usuarios de prueba funcional.
3. Storage separado: buckets propios, vacíos y privados.
4. Variables de entorno separadas: mismos nombres, valores distintos; ninguna clave de producción presente.
5. Dominio separado y funcional, sin compartir cookies/sesión con producción.
6. Migraciones reproducibles: replay limpio de los 82 archivos sobre base vacía, sin errores.
7. Dataset sintético cargado según §11, incluidas las filas legacy intencionadas.
8. Cero envíos reales: sin credenciales de WhatsApp, email ni pagos productivos.
9. Un cambio estructural puede aplicarse y revertirse sin ningún impacto en producción.
10. Matriz de RLS verificable: por cada tabla sensible, un caso positivo y uno negativo.
11. Roles probables: admin, operations, agent, provider y (futuro) driver.
12. Aislamiento entre organizaciones demostrado: un usuario de Org A no lee datos de Org B.
13. Indicador visual permanente de entorno en la interfaz de staging.
14. Procedimiento de reconstrucción documentado y ejecutable por otra persona.

---

## 14. Próximos pasos

1. **Decisión del propietario** sobre la Opción A (segundo entorno gestionado): requiere
   crear infraestructura y por eso no se ejecuta en esta fase.
2. **Fase 1A.4 (sin aprobación necesaria):** réplica local desde migraciones + script de
   semilla sintética; entregable = informe de reproducibilidad del esquema.
3. **Fase 1A.4b:** documentar como código la configuración no versionada (buckets, ajustes
   de Auth, roles iniciales), único hueco real de reproducibilidad detectado.
4. **Fase 1A.5 (si se aprueba A):** provisionar staging, replay de migraciones, seed,
   subdominio y validación contra los 14 criterios de §13.
5. **Fase 1B:** solo después de que el plan estructural (`organization_id NOT NULL`, rol
   `driver`, RLS de `providers` y `organizations`) se haya ensayado con éxito fuera de producción.

**Estado de esta fase:** diagnóstico entregado. No se implementó staging, no se modificó
producción, no se crearon migraciones, no se cambiaron RLS ni permisos, y no se inició la Fase 1B.
