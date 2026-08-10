# Facturacion Electronica con Factus (Sandbox)

Este proyecto ya incluye integracion base para pruebas con Factus y conexion con `POS`.

## 1) Configuracion inicial

Completa variables en `acaipark-back/.env` tomando como base `acaipark-back/.env.example`.

Variables minimas obligatorias:

- `FACTUS_ENABLED=1`
- `FACTUS_ENVIRONMENT=sandbox`
- `FACTUS_CLIENT_ID`
- `FACTUS_CLIENT_SECRET`
- `FACTUS_USERNAME`
- `FACTUS_PASSWORD`

Variables recomendadas para iniciar rapido:

- `FACTUS_NUMBERING_RANGE_ID` (si lo conoces)
- `FACTUS_DEFAULT_CUSTOMER_EMAIL`
- `FACTUS_DEFAULT_MUNICIPALITY_ID`

## 2) Probar conexion con Factus

Con backend corriendo:

- `GET /factus/health`
- `GET /factus/numbering-ranges`

Si `health` responde `ok: true`, la autenticacion y conexion estan listas.

## 3) Flujo operativo conectado a POS

1. En POS, crea pedido y marcalo como entregado.
2. En modal de pago, activa `Emitir factura electronica (Factus - pruebas)`.
3. Selecciona cliente existente o registra cliente nuevo.
4. Guarda pago.
5. El sistema:
   - Cierra el pedido y crea la venta local.
   - Emite factura en Factus sobre esa venta.
   - Guarda estado en tabla `electronic_invoices`.

## 4) Endpoints implementados

- `GET /factus/health`
- `GET /factus/numbering-ranges`
- `GET /factus/sales/{sale_id}/status`
- `POST /factus/sales/{sale_id}/issue`
- `GET /factus/sales/{sale_id}/document` (descarga PDF)
- `POST /factus/sales/{sale_id}/send-email` (reenviar correo)

Proxies Next.js:

- `GET /api/factus/health`
- `GET /api/factus/numbering-ranges`
- `GET /api/factus/sales/{saleId}/status`
- `POST /api/factus/sales/{saleId}/issue`
- `GET /api/factus/sales/{saleId}/document`
- `POST /api/factus/sales/{saleId}/send-email`

### Numbering range ID

- Es opcional en la UI solo si ya configuraste `FACTUS_NUMBERING_RANGE_ID` en `acaipark-back/.env`.
- Si no existe ese valor por defecto, debes enviarlo en cada emision (ej. `8` en sandbox).

## 5) Tabla de trazabilidad

Tabla nueva: `electronic_invoices`

Guarda:

- estado (`pending`, `issued`, `failed`)
- referencia
- numero Factus
- CUFE
- QR
- request/response
- error tecnico

## 6) Paso a produccion

1. Cambia `FACTUS_ENVIRONMENT=production`.
2. Configura credenciales productivas.
3. Ajusta `FACTUS_API_BASE_URL` y `FACTUS_TOKEN_URL` si Factus te entrega URLs diferentes.
4. Verifica rangos productivos (`/factus/numbering-ranges`).
5. Ejecuta pruebas con ventas reales de bajo monto antes de habilitar a todos los usuarios.
