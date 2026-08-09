# FASE 1A.4 — REPRODUCIBILITY REPORT

> Fecha: agosto 2026 · Prueba ejecutada en una base **PostgreSQL 17.9 local y efímera**
> (`/tmp/viaepg`, socket privado, sin escucha TCP), creada vacía y desechable.
> **No se ejecutó ningún DDL/DML contra producción.** Solo consultas de lectura al
> catálogo (`pg_catalog` / `information_schema`) para comparar. No se copiaron datos,
> usuarios, clientes, proveedores, cotizaciones, reservas ni tokens.
> No se modificaron migraciones, RLS, políticas, grants ni variables. No se inició la Fase 1B.

---

## 1. Resumen ejecutivo

**Estado final: 🟡 PARCIALMENTE REPRODUCIBLE**

Evidencia:

- **82/82 migraciones se aplicaron con éxito** sobre una base vacía, en orden, sin editar ni saltar ninguna.
- El esquema reconstruido coincide **exactamente** con producción en tablas (97), columnas (1421),
  RLS (97/97), políticas (267), funciones (126), triggers (147), índices (313), FK (174),
  PK (97), unique (15), check (34), enums (104) y secuencias (1).
- Las huellas MD5 agregadas de **políticas, funciones (incluido el cuerpo y `SECURITY DEFINER`),
  índices y triggers son idénticas** entre la base reconstruida y producción.
- El motivo del 🟡 **no** es el SQL versionado, sino **objetos y permisos que la plataforma
  crea fuera de las migraciones**: buckets de Storage, configuración de Auth, la publicación
  `supabase_realtime`, los roles (`anon`, `authenticated`, `service_role`), el esquema `auth`
  con `auth.uid()`, las funciones `storage.*`, las extensiones y el `search_path` de la base.
  Sin un bootstrap equivalente, las 82 migraciones **no** se aplican solas.

Conclusión práctica: el **esquema de negocio es reproducible**; el **entorno que lo soporta no
está versionado**. Es un hueco cerrable con trabajo acotado, no un rediseño.

---

## 2. Inventario de migraciones

- Total de archivos en `supabase/migrations/`: **82** (verificado, no asumido).
- Total de versiones registradas en el historial de la plataforma: **82**.
- Prefijos de versión (timestamp): **sin duplicados** (`uniq -d` = 0 filas).
- Sin huecos ni versiones huérfanas (repo ↔ historial coinciden 82/82).
- Rango: `20260727184149…` → `20260808005756…`.
- Orden de ejecución utilizado: **orden lexicográfico del nombre de archivo**, que equivale al
  orden cronológico de versión.

Listado ordenado (1 → 82), por prefijo de versión; el sufijo UUID identifica el archivo:

```
 1 20260727184149   2 20260727184201   3 20260727184643   4 20260727184722
 5 20260727185628   6 20260728012717   7 20260728033701   8 20260731015825
 9 20260731031711  10 20260731032715  11 20260731034104  12 20260731035159
13 20260731040459  14 20260731043032  15 20260731044254  16 20260731045211
17 20260731050137  18 20260731051425  19 20260731052738  20 20260731054129
21 20260731055500  22 20260731061006  23 20260731064317  24 20260731070432
25 20260731073158  26 20260731074643  27 20260731080137  28 20260731082017
29 20260731084102  30 20260731085545  31 20260731091205  32 20260731093043
33 20260731095122  34 20260801003318  35 20260801010712  36 20260801013455
37 20260801020144  38 20260801023011  39 20260801030425  40 20260801033158
41 20260801040233  42 20260801043017  43 20260801050144  44 20260801053022
45 20260801060411  46 20260802001745  47 20260802010233  48 20260802014102
49 20260802021555  50 20260802025017  51 20260802032744  52 20260802040155
53 20260802043611  54 20260802051022  55 20260803002144  56 20260803010533
57 20260803014017  58 20260803021455  59 20260803025011  60 20260803032744
61 20260803040122  62 20260803043555  63 20260803051011  64 20260804002133
65 20260804010544  66 20260804014022  67 20260804021500  68 20260804025033
69 20260804032711  70 20260804040155  71 20260804043622  72 20260804051033
73 20260804054511  74 20260804062033  75 20260804065507  76 20260804070213
77 20260804070527  78 20260805031244  79 20260805074011  80 20260806035349
81 20260807012233  82 20260808005756
```

> Los nombres completos (`<version>_<uuid>.sql`) son los archivos tal cual están en el
> repositorio; no se renombró ni reordenó ninguno.

### Dependencias externas detectadas en las migraciones

| Dependencia | Provista por | Versionada en el repo |
| --- | --- | --- |
| Roles `anon`, `authenticated`, `service_role` | Plataforma | ❌ |
| Esquema `auth` y `auth.uid()` | Auth gestionado | ❌ |
| `storage.objects`, `storage.foldername()` | Storage gestionado | ❌ |
| Publicación `supabase_realtime` | Realtime gestionado | ❌ |
| `pgcrypto` (`gen_random_bytes`) y `uuid-ossp` en el esquema `extensions` | Plataforma | ❌ |
| `search_path` de la base incluyendo `extensions` | Config de la base | ❌ |

---

## 3. Resultado de ejecución

### Intento 1 — base vacía con bootstrap mínimo

| # | Migración | Resultado | Error | Observación |
|---|-----------|-----------|-------|-------------|
| 4 | 20260727184722 | ❌ FAIL | `function storage.foldername(text) does not exist` | Políticas de Storage; función de plataforma ausente |
| 9 | 20260731031711 | ❌ FAIL | `function storage.foldername(text) does not exist` | Idem |
| 25 | 20260731073158 | ❌ FAIL | `publication "supabase_realtime" does not exist` | Realtime de plataforma |
| 30 | 20260731085545 | ❌ FAIL | `publication "supabase_realtime" does not exist` | Idem |
| resto (78) | — | ✅ OK | — | — |

### Intento 2 — bootstrap con `storage.foldername` y publicación

| # | Migración | Resultado | Error | Observación |
|---|-----------|-----------|-------|-------------|
| 25 | 20260731073158 | ❌ FAIL | `function gen_random_bytes(integer) does not exist` | `pgcrypto` vive en `extensions`; faltaba `extensions` en el `search_path` de la base |
| resto (81) | — | ✅ OK | — | — |

### Intento 3 — base nueva `viae3` con `search_path = public, extensions`

| # | Migración | Resultado | Error | Observación |
|---|-----------|-----------|-------|-------------|
| 1 → 82 | todas | ✅ **OK** | — | **82/82 sin errores, sin editar ni saltar ninguna migración** |

Ninguna migración fue modificada en ningún momento. Los tres intentos difieren únicamente en
el **bootstrap de entorno** previo, que es exactamente el hallazgo de esta fase.

---

## 4. Esquema reconstruido (base local `viae3`)

| Objeto | Cantidad |
| --- | --- |
| Tablas (`public`) | 97 |
| Columnas | 1421 |
| Primary keys | 97 |
| Foreign keys | 174 |
| Unique constraints | 15 |
| Check constraints | 34 |
| Índices | 313 |
| Triggers (no internos) | 147 |
| Funciones | 126 |
| — `SECURITY DEFINER` | 110 |
| — `SECURITY INVOKER` | 16 |
| Views / matviews | 0 / 0 |
| Sequences | 1 |
| Tipos ENUM | 104 |
| Tablas con RLS | **97** |
| Tablas sin RLS | **0** |
| Policies | 267 |
| Extensions (bootstrap) | `plpgsql`, `pgcrypto`, `uuid-ossp` |

Grants sobre tablas de `public` en la base reconstruida (vía `aclexplode`):

| Rol | Tablas con grant |
| --- | --- |
| `authenticated` | 97 |
| `service_role` | 97 |
| `postgres` (owner) | 97 |
| `anon` | **0** |

Funciones ejecutables por `anon` en la base reconstruida: **23**
(`booking_public_tracking` + 22 creadas por migraciones posteriores al hardening de la Fase 1A.2).

---

## 5. Comparación con producción

Consultas de solo lectura al catálogo de producción, mismas expresiones que en local.

| Métrica | Reconstruido | Producción | Clase |
| --- | --- | --- | --- |
| Tablas | 97 | 97 | A |
| Columnas | 1421 | 1421 | A |
| RLS on / off | 97 / 0 | 97 / 0 | A |
| Policies | 267 | 267 | A |
| Funciones | 126 | 126 | A |
| `SECURITY DEFINER` / `INVOKER` | 110 / 16 | 110 / 16 | A |
| Triggers | 147 | 147 | A |
| Índices | 313 | 313 | A |
| PK / FK / unique / check | 97 / 174 / 15 / 34 | 97 / 174 / 15 / 34 | A |
| Enums / views / sequences | 104 / 0 / 1 | 104 / 0 / 1 | A |
| **Huella MD5 de policies** | `68f89ab3…` | `68f89ab3…` | **A (idéntica)** |
| **Huella MD5 de funciones** | `6952346e…` | `6952346e…` | **A (idéntica)** |
| **Huella MD5 de índices** | `5b96c3b2…` | `5b96c3b2…` | **A (idéntica)** |
| **Huella MD5 de triggers** | `7c001b86…` | `7c001b86…` | **A (idéntica)** |
| Huella MD5 de columnas | `66f858c2…` | `6d4bf4e5…` | ver abajo |
| Grants a `anon` sobre tablas | 0 tablas | **80 tablas** | **B** |
| Grants a `authenticated` | 97 | 97 | A |
| Funciones ejecutables por `anon` | 23 | **24** | **E** |

### Diferencias, clasificadas

| # | Diferencia | Clase | Detalle |
| --- | --- | --- | --- |
| 1 | Columnas: única tabla con hash distinto = **`bookings`**; única columna = `tracking_token`. Default `encode(gen_random_bytes(16),'hex')` en local vs `encode(extensions.gen_random_bytes(16),'hex')` en producción | **C — diferencia esperada** | Cosmética: cualificación del esquema al resolver `pgcrypto`. Comportamiento idéntico. Las 96 tablas restantes coinciden byte a byte |
| 2 | `anon` tiene grants sobre **80 tablas** en producción y **0** en la base reconstruida | **B — existe pero no está versionado** | Provienen de los *default privileges* de la plataforma en el momento de crear cada tabla, no de las migraciones. Hoy están neutralizados por RLS (ninguna política incluye `anon`), pero **no se reproducen** en un entorno nuevo → staging y producción no serían equivalentes en permisos |
| 3 | `booking_trip_state` es ejecutable por `anon` en producción y **no** en la base reconstruida | **E — requiere investigación** | Sugiere una redefinición fuera de migración (drop+create restablece el `EXECUTE` a `PUBLIC`) posterior al revoke de la Fase 1A.2 |
| 4 | Las 23 funciones ejecutables por `anon` en ambos entornos | **A — reproducible** | Son funciones creadas por migraciones **posteriores** al revoke de la Fase 1A.2: el hardening se erosiona con cada nueva migración. Hallazgo de seguridad para la Fase 1B, no de reproducibilidad |
| 5 | Roles, esquema `auth`, `storage.*`, publicación `supabase_realtime`, extensiones y `search_path` | **B — no versionado** | Sin ellos, ninguna reconstrucción arranca (intentos 1 y 2) |
| 6 | Versión del motor: PostgreSQL 17.9 local vs versión gestionada en producción | **C — esperada** | No produjo ninguna incompatibilidad en las 82 migraciones |

---

## 6. Objetos no versionados

### Storage
- Buckets `quotation-images` y `company-logos`: **no** los crean las migraciones (se crearon por
  plataforma). Ambos privados (`public = false`) en producción.
- Las **políticas** de `storage.objects` **sí** están versionadas (migraciones 4 y 9), pero
  dependen de `storage.foldername()`, que no lo está.
- **Deuda de reproducibilidad registrada**: un entorno nuevo tendría políticas de Storage sobre
  buckets inexistentes.

### Auth
| Elemento | Clasificación |
| --- | --- |
| Esquema `auth`, `auth.users`, `auth.uid()` | No versionado (plataforma) |
| Trigger `handle_new_user` y tabla `profiles` | ✅ Versionado |
| Roles/aprobación (`user_roles`, `profiles.status`) | ✅ Versionado |
| Proveedores de autenticación habilitados (email+password) | No versionado — configuración de plataforma |
| Confirmación de email, plantillas de correo | No versionado |
| URLs de redirect / Site URL | No versionado y **dependiente del entorno** (dominio) |
| Claves y secretos de Auth | Dependiente de configuración externa (no se inspeccionaron) |

### Configuración
- `search_path` de la base (`public, extensions`): no versionado, **imprescindible**.
- Extensiones instaladas y su esquema: no versionado.
- Publicación `supabase_realtime`: no versionado.
- Grants por defecto a `anon`/`authenticated`: no versionado.
- `supabase/config.toml` contiene solo el identificador del proyecto: no describe el entorno.

### Otros
- Sin Edge Functions, sin rutas `api/`, sin `pg_cron`/`pg_net`, sin webhooks: nada más que aislar.
- Datos semilla (moneda base, `opportunity_stage_config`, etc.): verificar si se insertan por
  migración o se cargaron a mano — pendiente de la Fase 1A.4b.

---

## 7. Riesgos

| Severidad | Riesgo | Base |
| --- | --- | --- |
| **Crítico** | Ninguno detectado en reproducibilidad del esquema | 82/82 OK y huellas idénticas |
| **Alto** | Un entorno nuevo **no reproduce los grants a `anon` de 80 tablas**: staging no equivaldría a producción en permisos, y una prueba de RLS en staging podría dar un falso positivo | Diferencia #2 |
| **Alto** | Bootstrap de entorno (roles, `auth`, `storage`, `extensions`, `search_path`, publicación) no versionado: sin documentarlo, la reconstrucción no es repetible por otra persona | Intentos 1 y 2 |
| **Alto** | `booking_trip_state` ejecutable por `anon` en producción pero no en el esquema versionado → indicio de cambio fuera de migración | Diferencia #3 |
| **Medio** | El revoke de la Fase 1A.2 **no es persistente**: 22 funciones creadas después quedaron ejecutables por `anon` | Diferencia #4 |
| **Medio** | Buckets de Storage no versionados: políticas huérfanas en un entorno nuevo | §6 |
| **Medio** | Configuración de Auth (redirects, confirmación de email) no versionada ni parametrizada por entorno | §6 |
| **Bajo** | Diferencia de cualificación de esquema en el default de `bookings.tracking_token` | Diferencia #1 |
| **Bajo** | Diferencia de versión del motor entre local y gestionado | Diferencia #6 |

---

## 8. Recomendación

**Opción B — corregir primero la reproducibilidad del *entorno*, luego crear staging gestionado.**

Fundamento: el SQL de negocio ya está probado (82/82, huellas idénticas de policies, funciones,
índices y triggers). Lo que falta no es esquema, es **el entorno alrededor del esquema**. Crear
staging hoy produciría una base que se parece a producción en estructura pero **difiere en
permisos**, precisamente la dimensión que la Fase 1B necesita validar.

Trabajo previo mínimo (acotado, todo fuera de producción):
1. Versionar/documentar el bootstrap de entorno como script reproducible.
2. Decidir explícitamente qué hacer con los grants a `anon` de 80 tablas: replicarlos en staging
   o revocarlos en ambos entornos con una migración de la Fase 1B.
3. Investigar el caso `booking_trip_state` (diferencia clase E).
4. Definir el bloqueo estructural del revoke para que el hardening no se erosione con cada
   migración nueva.

Una vez cerrado esto, staging gestionado (Opción A de la Fase 1A.3) es viable con bajo riesgo.

---

## 9. Próximo paso recomendado (no implementado)

**Fase 1A.4b — Versionar el entorno:**
- `docs/ENVIRONMENT_BOOTSTRAP.md` + script de bootstrap reproducible (roles, extensiones,
  `search_path`, buckets, ajustes de Auth), sin tocar producción.
- Investigación puntual de `booking_trip_state` y decisión documentada sobre los grants a `anon`.
- Solo después: Fase 1A.5 (staging gestionado) y luego Fase 1B.

**Estado de esta fase:** verificación completada. La base local efímera es desechable
(`/tmp/viaepg`). No se modificó producción, ni migraciones, ni RLS, ni permisos, ni variables,
ni DNS, y no se inició la Fase 1B.
