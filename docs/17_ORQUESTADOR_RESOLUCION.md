# 17 — Orquestador: Motor de Resolución (v1.10.4 Fase B)

> Estado: **estructura únicamente**. No genera reservas, no modifica cupos,
> no calcula pagos, no reemplaza ningún motor existente y no incluye IA.

## 1. Objetivo

La Fase A (`docs/16_ORQUESTADOR_MULTIPROVEEDOR.md`) creó la capa que **busca**
y registra candidatos. Esta Fase B crea la capa que **resuelve**: recibe esos
candidatos y permite evaluar compatibilidad, aplicar prioridades comerciales,
puntuar opciones y componer paquetes posibles.

## 2. Arquitectura de datos

| Tabla | Rol |
| --- | --- |
| `orchestrator_rules` | Reglas de resolución: prioridad, compatibilidad, exclusión, preferencia, armado de paquete |
| `orchestrator_scores` | Evaluación por resultado: disponibilidad, precio, proveedor, calidad y score final |
| `package_compositions` | Paquetes posibles generados para una búsqueda |
| `package_components` | Componentes de cada paquete, ligados a un `search_results` |
| `provider_preferences` | Preferencias comerciales por organización/proveedor |

### Enums

- `orchestrator_rule_type`: `priority`, `compatibility`, `exclusion`, `preference`, `package`
- `orchestrator_rule_scope`: `global`, `destination`, `product_category`, `provider`
- `package_composition_status`: `draft`, `generated`, `selected`, `rejected`
- `package_component_type`: `accommodation`, `activity`, `transfer`, `rental`, `other`
- `provider_preference_type`: `preferred`, `blocked`, `priority`, `commission`, `quality`

### Diagrama

```
search_requests
   └── search_results ──┬──► orchestrator_scores      (cuánto puntúa)
                        └──► package_components
                                   ▲
                        package_compositions          (paquetes posibles)
                                   ▲
orchestrator_rules  +  provider_preferences  ──► reglas y prioridades
```

## 3. Reglas de resolución

`orchestrator_rules` es declarativa: `conditions` describe cuándo aplica y
`actions` qué efecto produce. El motor evalúa por `priority` ascendente y
respeta `scope` (de lo más específico a lo global).

| Tipo | Uso |
| --- | --- |
| `priority` | Elevar o bajar candidatos (p. ej. proveedor con mejor acuerdo) |
| `compatibility` | Definir combinaciones válidas (hotel + traslado del mismo destino) |
| `exclusion` | Descartar candidatos o combinaciones prohibidas |
| `preference` | Sesgo comercial suave, sin descartar alternativas |
| `package` | Plantilla de armado: qué componentes debe tener un paquete |

`provider_preferences` complementa las reglas con decisiones comerciales por
organización: proveedor preferido, bloqueado, prioridad, comisión o calidad.
Un proveedor `blocked` nunca puede ser rescatado por una regla de prioridad.

## 4. Scoring

Cada candidato puede recibir un registro en `orchestrator_scores` con cuatro
dimensiones independientes y un `final_score` derivado:

| Dimensión | Qué mide | Peso de referencia |
| --- | --- | --- |
| `availability_score` | Certeza de cupo (`available` > `request_only` > `unknown`) | 0.40 |
| `pricing_score` | Competitividad y confiabilidad del precio calculado | 0.30 |
| `provider_score` | Preferencias comerciales, acuerdos y evaluación interna | 0.20 |
| `quality_score` | Calidad del producto y evaluaciones históricas | 0.10 |

Reglas invariantes:

- Los pesos son **de referencia** (`SCORE_REFERENCE_WEIGHTS` en
  `src/lib/orchestratorResolution.ts`), configurables por reglas en el futuro.
- `calculation_metadata` guarda siempre la traza: reglas aplicadas, pesos
  usados y valores de entrada. El scoring debe ser explicable.
- Un score nulo significa "no evaluado", nunca "cero".
- El score **ordena**, no decide: nunca confirma ni reserva.

## 5. Paquetes

Un `package_compositions` es una combinación propuesta para una búsqueda.
Ciclo de estados:

```
draft ──► generated ──► selected
                   └──► rejected
```

- `draft`: en armado, incompleto.
- `generated`: combinación válida según reglas de compatibilidad.
- `selected`: elegida por el agente para avanzar a cotización o reserva
  mediante los flujos existentes (el orquestador no la materializa).
- `rejected`: descartada por regla de exclusión o por el agente.

`total_amount` y `currency` son **estimados**, provenientes de los resultados
componentes. La cifra comercial válida sigue siendo la de la cotización.

## 6. Prioridades — orden de resolución

```
1. Exclusiones y proveedores bloqueados   (filtro duro)
2. Compatibilidad entre componentes       (filtro duro)
3. Reglas de scope más específico → global
4. Preferencias comerciales del proveedor
5. Cálculo de score y ordenamiento
6. Composición de paquetes y devolución de opciones
```

Espejo en código: `RESOLUTION_STEPS` en `src/lib/orchestratorResolution.ts`.

## 7. Relación futura con IA

La estructura está preparada para que un modelo se sume **sin reemplazar** las
reglas explícitas:

- `calculation_metadata` y los estados `selected` / `rejected` generan el
  historial etiquetado necesario para entrenar o ajustar pesos.
- Una capa de recomendación podrá escribir un score adicional dentro de
  `calculation_metadata` o proponer `package_compositions` en estado `draft`.
- Las exclusiones y los proveedores bloqueados permanecen como filtros duros:
  ningún modelo puede sobrescribirlos.
- No se implementa IA ni machine learning en esta fase.

## 8. Seguridad (RLS)

| Rol | Acceso |
| --- | --- |
| Administrador | CRUD completo sobre las 5 tablas |
| Operaciones | Lectura de reglas, scores, paquetes y preferencias |
| Agente | Solo scores, paquetes y componentes de sus propias búsquedas |
| Proveedor | Solo información asociada a resultados de productos que gestiona (`can_manage_product`) |
| Cliente | Sin acceso |
| Anónimo | Sin acceso (sin GRANT a `anon`) |

Funciones auxiliares `SECURITY DEFINER` agregadas: `can_read_package(uuid)` y
`can_manage_package(uuid)`, sobre las de Fase A
(`can_read_search_request`, `can_manage_search_request`,
`can_read_search_result`, `can_manage_search_result`).

## 9. Relación con los demás motores

- **Fase A del Orquestador**: única fuente de candidatos (`search_results`).
- **Inventario / Tarifario / Disponibilidad**: siguen siendo la autoridad; el
  motor de resolución solo lee y puntúa lo que ellos informaron.
- **Itinerarios**: una plantilla podrá expresarse como regla `package`.
- **Comisiones y Acuerdos**: alimentan `provider_score` vía
  `provider_preferences`; el devengo real sigue ocurriendo sobre reservas.
- **Reservas / Expediente 360°**: fuera de alcance; un paquete `selected` se
  materializa manualmente con los flujos existentes.

## 10. Fuera de alcance en esta fase

Algoritmo de IA, machine learning, reservas automáticas, pagos, confirmación
automática y APIs externas.

## 11. Confirmación de impacto

No se modificaron `bookings`, `quotations`, `booking_services`,
`transport_services`, `commissions`, ni las tablas de inventario, tarifas,
disponibilidad o del Expediente 360°. Solo se agregaron tablas, enums,
funciones auxiliares y políticas nuevas, más los tipos en
`src/lib/orchestratorResolution.ts`.
