# Tarifas por fechas y estadía mínima — Diagnóstico y plan

## 1. Diagnóstico (verificado en código y base)

- Calendario: unidades (`product_variants`), bloqueos (`product_availability_blocks`, salida exclusiva), iCal (`availability_sources`). Funciona y no se toca.
- `product_pricing_profiles`: tiene producto, unidad opcional (`product_variant_id`), moneda, `valid_from`/`valid_until`, prioridad, estado. **0 filas, sin uso en la UI.**
- `pricing_rules`: valor, tipo de cálculo, `min_quantity`, prioridad, activo. **0 filas.** No tiene fechas propias (las fechas están en el perfil).
- `product_availability_rules`: 0 filas; 3 perfiles de calendario activos. No se usa para tarifas.
- Cotización: las noches se calculan por diferencia de fechas; el precio por noche se completa **automáticamente con `products.sale_amount`** (formulario y prellenado). El total = precio × noches + impuestos + otros.
- `quotations.accommodation_unit_id` **sí se guarda** en la base.
- Los importes se guardan como números en la cotización, por eso cambiar una tarifa no altera cotizaciones existentes.
- Permisos: administrar perfiles exige `can_manage_product`; reglas, `can_manage_pricing_profile`. Lectura: operaciones y agentes. **Observación:** la lectura de agentes no filtra por agencia; hoy no hay datos, pero al cargar tarifas un agente de otra agencia podría leerlas. Propongo alinearla con `can_read_product` (no amplía, restringe).

## 2. Modelo (reutilización, sin sistema paralelo)

Cada **período tarifario** = 1 fila en `product_pricing_profiles`:
- `valid_from` = primera noche, `valid_until` = última noche incluida.
- `product_variant_id` vacío = tarifa general; con valor = tarifa de esa unidad.
- `currency`, `status` (activo/inactivo).

Con 1 regla en `pricing_rules`: `rule_type='fixed'`, `calculation_type='per_unit'`, `value` = precio por noche, `min_quantity` = estadía mínima (noches).

Precio base del propietario separado de comisiones: estas siguen en el snapshot de la cotización, sin cambios.

## 3. Migración mínima (una)

- Función de servidor `accommodation_rate_quote(producto, unidad, entrada, salida)` que, noche por noche, devuelve precio, moneda, período aplicado, noches sin tarifa, conflictos y estadía mínima no cumplida. Respeta permisos de lectura actuales.
- Restricciones de validación: precio ≥ 0, mínimo ≥ 1, `valid_until ≥ valid_from` (ya existe).
- Ajuste de la política de lectura de agentes a `can_read_product`.
- Sin columnas nuevas, sin tocar datos existentes (tablas vacías).

## 4. Cálculo

1. Noches = entrada incluida, salida excluida.
2. Por cada noche: tarifa de la unidad si existe; si no, la general.
3. Más de un período activo del mismo nivel para una noche → **conflicto**, se informa, no se elige.
4. Noches sin tarifa → se listan; no se usa `sale_amount`.
5. Estadía mínima: la mayor exigida entre las noches de la estadía.
6. Monedas distintas en una misma estadía → error.

## 5. Interfaz

- Panel de calendario de alojamiento (Catálogo): nueva sección "Tarifas" con lista de períodos, alta/edición/baja (fechas, unidad o general, precio, moneda, mínimo) y aviso de superposiciones.
- Formulario de cotización: con alojamiento + fechas, muestra desglose por noche, avisos (sin tarifa, conflicto, mínimo). Si hay tarifas válidas, propone precio y total; el precio del Catálogo queda solo como referencia. Si el producto no tiene tarifas por fecha, comportamiento actual intacto.
- No se bloquea guardar borradores; se avisa antes de enviar.

## 6. Archivos

- Migración nueva.
- `src/lib/accommodationRates.ts` (nuevo).
- `src/components/accommodation-rates-panel.tsx` (nuevo) dentro de `accommodation-availability-panel.tsx`.
- `src/components/quotation-form.tsx` (desglose y avisos).
- Pruebas unitarias del cálculo.

## 7. Riesgos

- Precio por noche hoy editable a mano: se mantiene editable.
- Cotizaciones existentes: no se recalculan.
- Calendario, bloqueos, iCal, reservas, paquetes, comisiones: sin cambios.

## 8. Pruebas de aceptación

Los 12 casos del pedido: tarifa fija; dos períodos; mínimo cumplido; mínimo incumplido; noches sin tarifa; tarifa por unidad; salida no cobrada; superposición; usuario sin permiso; cotización histórica sin cambio; producto sin tarifas; calendario/iCal intactos. Cálculo con pruebas automáticas; permisos con consultas SQL; interfaz con una prueba en pantalla usando datos nuevos.
