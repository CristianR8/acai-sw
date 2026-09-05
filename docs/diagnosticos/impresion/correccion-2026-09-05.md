**Corrección aplicada en admin y cashier**

Los dos repositorios conservan ahora los índices de línea/página en un objeto compartido entre eventos PowerShell. Se cancela la impresión si una página no puede consumir ninguna línea o si supera 50 páginas. Los recursos de impresión se liberan mediante `finally`.

Se corrigió la incompatibilidad `fast_text`/`include_logo` de admin. El agente conserva la opción de logo y el tiempo de espera HTTP cubre el tiempo máximo del proceso de impresión por cada copia. Actualizar el cliente de una venta existente ya no vuelve a imprimir el recibo.

Validación: siete pruebas por versión aprobadas, incluyendo eventos .NET ejecutados con PowerShell 7.5.3 y dibujo simulado. Se verificaron recibos vacíos, cortos, de 200 y 1000 líneas, detención por falta de avance, límite de 50 páginas, interfaz del agente, tiempos de espera y repetición de pagos/cambios de cliente. No se enviaron documentos a una impresora.

Pruebas desde `acaipark-back`:

```sh
DATABASE_URL=sqlite:// ACAI_TEST_PWSH=/ruta/a/pwsh python3 -m unittest discover -s tests -v
```

PowerShell se busca también en PATH; si falta se omiten explícitamente las pruebas de eventos. La prueba del adaptador Linux se omite en Windows para no acceder a dispositivos reales.

**Aplicación en el equipo de impresión**

Actualizar los archivos de cada versión, reconstruir su backend Docker y reiniciar el agente Windows que atiende las solicitudes. El agente importa `app/thermal_printer.py` del directorio con el que fue iniciado; no basta con reconstruir Docker ni con abrir nuevamente el lanzador si el agente anterior sigue escuchando en el puerto 8765. También deben actualizarse `app/print_agent.py` y `app/pos.py` en cada instalación correspondiente.

Si el incidente dejó un trabajo antiguo en la cola de Windows, hay que cancelarlo antes de probar: corregir el generador no elimina documentos ya encolados. La prueba física debe confirmar un recibo corto y uno que requiera varias páginas.

La revisión original es evidencia del estado anterior. Esta corrección resuelve el bucle reproducido, agrega límites y elimina la reimpresión por cambio de cliente. No incorpora una cola persistente con deduplicación de solicitudes directas al agente ni una pantalla de estado de impresión; esas mejoras del informe siguen separadas de esta corrección.
