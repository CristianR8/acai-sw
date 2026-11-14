# Ajustes solicitados — noviembre de 2026

Fuente: `C:\Users\This\Downloads\AJUSTES SISTEMA ACAI PARK - NOVIEMBRE 2026.docx`.
Se revisó todo el texto del documento y su estructura DOCX. Contiene seis comentarios en el cuerpo; no contiene comentarios de Word separados, notas al pie ni anexos. Todos los puntos se aplican a esta versión administrativa. **Compras** corresponde a **Compras y gastos → Compras** (`/inventory/purchases`).

| Comentario del documento | Implementación |
| --- | --- |
| Filtrar y organizar gastos según el análisis; consultar toda la nómina y el rubro más grande. | En Gastos se combinan fechas, búsqueda por nombre/categoría/concepto, categoría, tipo de gasto, clasificación y estado. Orden ascendente/descendente por monto o fecha, y por nombre. Resumen por categoría o tipo, de mayor a menor, con acceso a sus registros. Los anulados permanecen consultables y no suman. Compras también permite filtrar medio/estado de pago y ordenar por valor. |
| Mostrar uno a uno los gastos en el Excel del cierre. | Pantalla, Excel y PDF comparten las salidas de la fecha: referencia, gasto/proveedor, concepto y monto individual. Se incluyen todos los gastos manuales activos, incluso categorías sin clasificación, y se excluyen anulados. Excel y PDF permiten varias páginas para conservar el detalle. |
| Registrar contado, crédito y abonos; opciones Efectivo, Crédito, Transferencia y Efectivo caja. | Selector al crear/editar compras, pago inicial total o parcial, fecha de pago, total pagado, saldo, estado y detalle de pagos. Los abonos posteriores se registran en el desplegable de pagos de cada compra, con fecha y medio. Solo Efectivo caja reduce el cierre, en la fecha del pago. Anular una compra excluye sus pagos del cierre y revierte su inventario. El Excel de compras incorpora pagos y saldos. |
| Separar el detalle de ventas del día por datáfono, transferencia y efectivo del menú Cierre de caja; ubicarlo en Ventas. | Sección independiente en Ventas con fecha, cuatro totales y botón para consultar las ventas individuales de ese día. Se retiraron las tarjetas de medios de pago de la pantalla Cierre de caja. El efectivo vendido sigue visible en la conciliación; los archivos conservan los totales necesarios para documentar el cierre. |
| Permitir al administrador modificar el medio de pago de cada venta para corregir diferencias dentro del sistema. | Desplegable y Guardar cambio en cada venta activa del historial. La API exige sesión de administrador y rechaza ventas anuladas, métodos inválidos y cambios sobre una versión desactualizada. Se conserva auditoría con usuario, fecha, método anterior/nuevo y datos previos de efectivo. Ventas y cierres se recalculan desde los registros guardados. |
| Resumen inferior del cierre: X ventas y cantidades por producto, como conos, Tiny y Classic. | Resumen al pie de la pantalla, Excel y PDF con número de ventas activas, productos, cantidades y valores. Agrupa variantes de base bajo su producto/tamaño; usa los nombres registrados y no inventa equivalencias comerciales. Excluye otros días y ventas anuladas. |

## Reglas de operación

- Efectivo corresponde a dinero externo a la caja; Efectivo caja corresponde a dinero retirado del cajón. Crédito no genera una salida inicial. Un pago menor que el total deja estado Abono y saldo pendiente.
- Los gastos conservan su tratamiento actual de salida de caja. Las compras y abonos se registran en su propio historial de pagos: no se crean gastos duplicados ni se vuelve a contabilizar el costo de compra en PyG.
- Efectivo esperado = base inicial + ventas en efectivo − gastos − pagos de compras con efectivo caja.
- Las compras históricas conservan `Sin clasificar`. No se supone que fueron pagadas desde la caja. Deben clasificarse al editar antes de registrar nuevos abonos. No se modifican ventas históricas automáticamente.
- Corregir el medio de una venta conserva su total, productos y fecha. Se limpia el desglose automático de efectivo de esa venta porque no se pueden deducir billetes recibidos. El conteo físico guardado se conserva y se puede corregir en Cierre de caja.
- El importe total introducido para cada producto se conserva, aunque el costo unitario tenga decimales.

## Persistencia

Se añade `purchases.payment_method`, nullable para datos históricos. Las tablas nuevas `purchase_payments` y `sale_payment_method_changes` conservan pagos y auditoría. `Base.metadata.create_all` crea las tablas nuevas y el arranque con migraciones automáticas agrega la columna. No se rellena ni cambia la clasificación de registros existentes.

## Verificación reproducible

- Backend: instalar `acaipark-back/requirements-test.txt`; ejecutar desde `acaipark-back`: `python -m unittest discover -s tests`.
- Análisis de gastos: desde `acaipark-front`, `node tests/expense-analysis.test.cjs`.
- Compilación: desde `acaipark-front`, `npm run build`.
- Navegador: `tests/november-browser.cjs` usa `playwright-core`, Edge en modo headless y un servidor local en `http://127.0.0.1:3101` (configurable con `TEST_BASE_URL`). Todas las API están simuladas; no escribe en la base operativa. Comprueba filtros, compra con costo exacto, abono, corrección de venta, conteo, exportaciones y resumen. Capturas en `tmp/november-browser`.
- Las pruebas de noviembre cubren los cuatro medios de compra, compras históricas, abonos en distintas fechas, pagos inválidos, edición/anulación, ausencia de duplicación en PyG, autorización, concurrencia de correcciones, exclusión de anulados y exportación multipágina con 35 gastos.

## Comentarios adicionales

- Crear rubros: ya estaba implementado en “Agregar tipo de gasto”, con persistencia y validación de duplicados; verificado por la suite de tipos de gasto.
- Compras por mes/intervalo: los filtros ya existían. Se incorpora el resumen de compras directamente en Compras, vinculado al mismo rango de fechas y actualizado al registrar, editar, anular o abonar. Excluye anuladas y mantiene el costo separado de los pagos.
- Gastos al principio: el historial con su total y análisis se presenta ahora antes del formulario de registro.
- PyG: verificado mediante pruebas de conciliación de ventas, compras y gastos, categorías, períodos, anulaciones y exportación. Los abonos no duplican costos. El resultado sigue siendo provisional mientras no se ingresen inventarios inicial/final, limitación ya indicada en el informe.
- Por instrucción del usuario, no se ejecuta `docker compose up` ni se activa la versión local.
