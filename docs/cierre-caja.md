# Cierre diario de caja

El administrador lee `sales.cash_denominations` (JSON de denominación a cantidad) y `cash_drawer_openings` de la misma base PostgreSQL que usa acai-cashier. No se crea una base independiente. Las aperturas se suman por fecha del reporte (consolidado de todos los cajeros), y las ventas se filtran por día calendario de Colombia. Los gastos corresponden a los registros manuales del módulo de gastos para esa fecha.

En toma de pedidos, cada toque en un billete agrega una unidad. También se pueden modificar cantidades de billetes y monedas. El servidor verifica denominaciones, cantidades enteras no negativas y que el desglose coincida con el monto recibido. Otro valor y Pago exacto conservan el registro por monto, sin inventar denominaciones; el Excel avisa cuántos pagos no tienen desglose. Los pagos históricos tampoco se reconstruyen artificialmente.

El Excel separa efectivo recibido de efectivo real al cierre: los billetes recibidos no descuentan cambio ni gastos. La base inicial + ventas en efectivo - gastos produce el efectivo esperado. La celda amarilla permite ingresar el conteo físico final en Excel para calcular la diferencia; este ingreso en el archivo descargado no se sincroniza a la base de datos. Si no existe apertura, la conciliación queda pendiente en lugar de asumir base cero.

## Activación

Desplegar ambos repositorios (acai_sw y acai-cashier), incluyendo sus backends y frontends. Con `AUTO_MIGRATE_SCHEMA=1`, el arranque agrega de forma aditiva `sales.cash_denominations JSON`; `create_all` crea la tabla de aperturas si falta. Con migraciones automáticas desactivadas, aplicar previamente `ALTER TABLE sales ADD COLUMN IF NOT EXISTS cash_denominations JSON` y asegurar la tabla `cash_drawer_openings` según el modelo. Ambos backends deben usar la misma `DATABASE_URL`; la configuración Docker actual conecta el cajero a `acaipark-db` mediante `acai_shared`.

## Validación

- `PYTHONPATH=acaipark-back python -m unittest discover -s acaipark-back/tests -p test_cash_closing.py`
- TypeScript del administrador sin errores.
- TypeScript del cajero comprobado en copia temporal con las dependencias instaladas del administrador y las declaraciones de Next; el repositorio del cajero no tiene node_modules instalado.
- Persistencia del desglose comprobada también con los modelos y la función de ventas del cajero, usando SQLite temporal.

No se modificaron datos de producción ni se ejecutó un despliegue.
