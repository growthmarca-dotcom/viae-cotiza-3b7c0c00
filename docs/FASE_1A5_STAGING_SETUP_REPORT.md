# FASE 1A.5 — STAGING SETUP REPORT

> Fecha: agosto 2026
> **No se ejecutó ninguna operación de escritura contra producción.** Ni DDL, ni DML, ni RLS,
> ni grants, ni funciones, ni Auth, ni Storage, ni variables de entorno, ni DNS.
> No se inició la Fase 1B.

---

## 1. Estado final

**🔴 STAGING NO CREADO**

Motivo: **no existe una vía automatizada disponible para crear ni conectar un segundo
proyecto backend.** Todas las herramientas de infraestructura de las que dispongo en este
proyecto (migraciones, consultas, Auth, Storage, secretos, despliegue) operan
**exclusivamente sobre el único proyecto backend conectado, que es el de producción**.

En consecuencia, y aplicando la REGLA ABSOLUTA DE AISLAMIENTO de esta fase:

- No se podía "identificar inequívocamente el proyecto STAGING destino" (Fase 0 del checklist),
  porque no existe tal proyecto.
- Cualquier ejecución de las 82 migraciones, creación de buckets, configuración de Auth o
  inserción de datos sintéticos habría impactado **producción**.
- Por lo tanto **se detuvo la ejecución antes de la Fase 1**, tal como el propio prompt exige
  ("Si Lovable no tiene permisos para crear/conectar un segundo proyecto Supabase: NO improvisar.
  Detenerse y entregar instrucciones exactas").

Este resultado **no es un fallo de la aplicación ni del esquema**: la Fase 1A.4 ya demostró que
las 82 migraciones reconstruyen el esquema correctamente. Es un límite de la infraestructura
actual: **un solo proyecto backend, compartido por Preview y Producción.**

---

## 2. Proyecto Supabase STAGING

| Campo | Valor |
| --- | --- |
| Nombre | — (no creado) |
| Identificador | — |
| Región | — |
| URL pública | — |

Proyecto de **producción** (solo para dejar constancia de que **no** fue tocado): es el único
proyecto conectado al repositorio; su identificador y claves permanecen sin cambios y no se
reproducen aquí. No se leyó ni se expuso ninguna clave secreta.

---

## 3. Base de datos

| Ítem | Estado |
| --- | --- |
| Migraciones aplicadas a STAGING | **0 de 82** (no hay base destino) |
| Esquema STAGING | inexistente |
| Migraciones versionadas en el repo | **82** (verificado en esta fase, sin cambios) |
| Reproducibilidad del esquema | ✅ ya demostrada en Fase 1A.4 (82/82 OK, huellas MD5 idénticas) |

La base local efímera de la Fase 1A.4 (`/tmp/viaepg`) era desechable y **ya no existe**; era un
entorno de verificación, no un staging (sin Auth real, sin Storage real, sin URL, sin la app
apuntando a ella). No se ha promovido a staging ni se propone hacerlo.

---

## 4. Auth

| Ítem | Estado |
| --- | --- |
| Auth STAGING | no creado |
| Redirects STAGING | no configurados |
| Auth de producción | **sin modificar** (proveedores, confirmación de email, redirects, plantillas) |

No se copiaron usuarios, sesiones ni tokens: no había destino donde copiarlos, y tampoco estaba
permitido.

---

## 5. Storage

| Ítem | Estado |
| --- | --- |
| Buckets STAGING | no creados |
| Buckets de producción | **sin modificar** |

Buckets que un staging deberá reproducir (identificados por código de la app, sin tocar nada):

| Bucket | Privacidad requerida en staging |
| --- | --- |
| `quotation-images` | **privado** (igual que producción; la app usa Signed URLs) |
| `company-logos` | **privado** (igual que producción) |

Las políticas de `storage.objects` **sí** están versionadas (migraciones 4 y 9), por lo que se
crearían solas al aplicar las migraciones; los **buckets** no lo están y deben crearse aparte.
No se copió ningún archivo real (logos, imágenes de cotizaciones, documentos).

---

## 6. Variables de entorno

No se creó, modificó ni leyó ningún valor secreto. Nombres y propósito de las variables que un
entorno staging necesitaría, **con valores propios y distintos de producción**:

| Variable | Propósito | Visibilidad |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | URL del backend que usa el navegador | pública |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave publicable del backend (cliente) | pública |
| `VITE_SUPABASE_PROJECT_ID` | Identificador del proyecto backend | pública |
| `SUPABASE_URL` | Misma URL, para código de servidor | pública |
| `SUPABASE_PUBLISHABLE_KEY` | Clave publicable, para lecturas públicas de servidor | pública |
| `SUPABASE_SERVICE_ROLE_KEY` | Operaciones privilegiadas de servidor | **secreta — nunca en código ni en docs** |

Regla que se mantiene: **jamás reutilizar el valor de producción de ninguna de estas variables
en staging.**

---

## 7. Datos sintéticos

**No creados** (no hay base destino aislada). El dataset queda **especificado** para ejecutarse
en staging una vez exista, todo con marca `TEST —` y dominio `@example.invalid`:

- **Organizaciones**: `TEST — ViaE Travel` (principal) y `TEST — Agencia Demo` (segundo tenant,
  para probar aislamiento multi-tenant).
- **Usuarios**: `test-admin@example.invalid`, `test-ops@example.invalid`,
  `test-agent@example.invalid`, `test-provider@example.invalid`,
  `test-other-tenant@example.invalid`.
- **CRM**: 3 clientes ficticios, 3 leads, 3 oportunidades (una por etapa relevante).
- **Comercial**: 2 Smart Quotes (con ítems y una versión), 1 cotización, 1 reserva.
- **Operación**: 2 proveedores ficticios, 2 recursos (vehículo + alojamiento), 1 servicio de
  transporte con conductor de prueba.
- **Base**: moneda base, tipo de cambio de prueba y `opportunity_stage_config`.

Ningún nombre, email, teléfono o dirección real.

---

## 8. Lovable

Estado actual, sin cambios en esta fase:

```
Preview  ─┐
          ├──► ÚNICO backend (PRODUCCIÓN) ──► datos reales
Producción┘
```

Objetivo de la fase (no alcanzado):

```
Preview/Staging ──► backend STAGING ──► datos de prueba
Producción      ──► backend PRODUCCIÓN ──► datos reales
```

Conclusión operativa que sigue vigente: **Preview NO es un entorno de pruebas.** Cualquier
cambio estructural probado en Preview se aplica a producción.

---

## 9. Dominio

| Ítem | Estado |
| --- | --- |
| `staging.sales.viaetravel.com` | **no configurado** |
| DNS de producción (`sales.viaetravel.com`) | **sin tocar** |

No se creó ni modificó ningún registro DNS. La configuración del subdominio depende de que
exista antes un proyecto/deployment de staging al que apuntar.

---

## 10. Pruebas de aislamiento

| Prueba | Resultado |
|--------|-----------|
| DB aislada | 🔴 No verificable — no existe DB de staging |
| Auth aislado | 🔴 No verificable — no existe Auth de staging |
| Storage aislado | 🔴 No verificable — no existen buckets de staging |
| Datos sintéticos | 🔴 No creados (no había destino aislado) |
| **Producción intacta** | 🟢 **Sí — cero operaciones de escritura; solo lectura de archivos del repo** |
| Preview → STAGING | 🔴 No — Preview continúa apuntando a producción |
| Dominio staging | 🔴 No configurado |

TEST 1 a TEST 4 (crear organización, cotización, usuario y archivo de prueba) **no se
ejecutaron deliberadamente**: sin backend de staging, ejecutarlos habría escrito datos ficticios
en producción, violando la regla absoluta de la fase.

TEST 5 y TEST 6 se cumplen: producción no fue creada, modificada ni eliminada en ningún punto, y
la aplicación de producción sigue usando exclusivamente su backend original.

---

## 11. Problemas pendientes — acciones manuales del propietario

Estas acciones **requieren al propietario del proyecto**; no son ejecutables desde aquí.

### Opción A (recomendada) — Proyecto Lovable duplicado para staging

1. En Lovable, **duplicar / remixar** el proyecto ViaE Sales Hub y nombrar la copia
   `ViaE Core — Staging`.
2. En la copia, **habilitar Cloud**: eso aprovisiona un backend nuevo e independiente
   (base de datos, Auth, Storage y credenciales propias) sin tocar el de producción.
3. Confirmar en la copia que el identificador de proyecto backend **es distinto** del de
   producción antes de ejecutar cualquier cosa. Si coincide, detenerse.
4. Avisar en la copia para que allí se apliquen las 82 migraciones en orden, se creen los
   buckets `quotation-images` y `company-logos` (privados) y se carguen los datos sintéticos
   de la sección 7.
5. Publicar la copia y, en sus ajustes de dominio, conectar
   `staging.sales.viaetravel.com`. El registro DNS a crear lo indica la propia pantalla de
   dominios (normalmente un `CNAME` para el subdominio `staging.sales`); **no** modificar el
   registro existente de `sales`.

### Opción B — Backend propio externo para staging

1. Crear una cuenta/proyecto Postgres+Auth+Storage propio para staging.
2. Cargar allí las 82 migraciones más el bootstrap de entorno documentado en la Fase 1A.4
   (roles `anon`/`authenticated`/`service_role`, esquema `auth` con `auth.uid()`,
   `storage.*` incluida `storage.foldername()`, publicación de realtime, extensiones
   `pgcrypto` y `uuid-ossp` en el esquema `extensions`, y `search_path = public, extensions`).
3. Configurar en el entorno de staging las variables de la sección 6 con **valores propios**.

### Deuda arrastrada de fases anteriores (sin resolver, fuera de alcance aquí)

- Grants a `anon` en 80 tablas de producción, no versionados.
- `booking_trip_state` ejecutable por `anon` en producción y no representada en migraciones.
- Bootstrap de entorno y configuración de Auth aún no versionados
  (pendiente `docs/ENVIRONMENT_BOOTSTRAP.md`).

### Fase 9 — Efectos reales: confirmado

Revisión del repositorio en esta fase: **no hay Edge Functions, ni rutas `api/`, ni `pg_cron`,
ni `pg_net`, ni envío de email/WhatsApp, ni pasarela de pagos, ni llamadas salientes con
efectos reales.** Las comunicaciones se registran en `communication_events` sin enviarse. Por
lo tanto un staging futuro no puede provocar efectos externos reales; si más adelante se añade
una integración, deberá recibir configuración específica de staging antes de activarse.

---

## 12. Próximo paso

**STAGING NO está listo. La Fase 1B NO debe comenzar.**

Secuencia mínima para desbloquear:

1. El propietario ejecuta la **Opción A** de la sección 11 (crear el proyecto staging con su
   backend independiente).
2. Se reejecuta esta Fase 1A.5 contra ese backend: migraciones, Auth, buckets, datos
   sintéticos, y los TEST 1 a TEST 6 completos.
3. Recién con el informe en 🟢 se habilita la Fase 1B.

**Esta fase queda cerrada aquí.** No se realizó ningún otro cambio.
