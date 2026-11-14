# Cierre diario de caja

El administrador usa las ventas y aperturas de la base PostgreSQL compartida con el cajero. Las ventas se filtran por día calendario de Bogotá. El cierre incluye los gastos manuales activos de esa fecha y los pagos de compras registrados como **Efectivo caja**, incluidos los abonos.

La conciliación usa:

`Efectivo esperado = base inicial + ventas en efectivo − gastos − compras y abonos de caja`

Las compras con Efectivo externo, Transferencia o Crédito no descuentan dinero del cajón. Los abonos se descuentan en su fecha de pago, que puede ser distinta de la fecha de compra. Las compras y gastos anulados se excluyen.

## Conteo y exportaciones

El conteo se precarga con `sales.cash_denomination_counts`. Estos billetes recibidos no representan por sí solos el efectivo final después de cambios, gastos y compras. El administrador puede ingresar el conteo físico y guardarlo en `cash_drawer_closings`.

La pantalla, Excel y PDF usan el conteo guardado. Los enlaces de descarga se habilitan cuando no hay cambios de conteo pendientes de guardar. El Excel conserva fórmulas de conciliación, lista cada salida con referencia/concepto/monto y permite varias páginas. Si falta apertura, indica que la conciliación está pendiente. El PDF también conserva todo el detalle en varias páginas.

El resumen inferior muestra número de ventas y cantidades por producto. Los totales diarios de Efectivo, Datáfono y Transferencia se consultan en **Ventas**, donde un administrador puede corregir el medio de pago de cada venta activa. La corrección conserva el total y se registra en auditoría; el cierre se recalcula al consultarlo o actualizarlo. Un conteo físico guardado no se sustituye automáticamente al corregir una venta.

## Persistencia y pruebas

`AUTO_CREATE_TABLES=1` y `AUTO_MIGRATE_SCHEMA=1` crean las tablas nuevas de pagos/auditoría y agregan `purchases.payment_method`. Las compras históricas quedan sin clasificar hasta que se confirme su naturaleza. No se generan pagos retrospectivos automáticamente.

La cobertura por comentario, reglas de operación y comandos de prueba están en [Ajustes de noviembre de 2026](ajustes-noviembre-2026.md). Las pruebas de caja usan bases temporales y verifican conteos, conciliación, detalle de salidas, productos, Excel y PDF multipágina.
