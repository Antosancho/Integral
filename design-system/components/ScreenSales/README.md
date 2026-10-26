# ScreenSales

**Nueva venta**: la pantalla más usada. Optimizada para teclado y lector.

## Zonas
1. Header (Ventas activo) + cabecera: título, segmentado **Nueva venta | Historial**, botones de apoyo **Buscar F2** e **Ítem general F10** (visibles para quien usa mouse; enseñan el atajo).
2. **Input de código** (`BarcodeInput`) con foco permanente.
3. **Carrito** (`Cart`), zona con scroll.
4. **Panel de pago** (`PaymentPanel`), sticky abajo. Oculto si el carrito está vacío (en su lugar, el estado vacío del carrito).
5. Toasts arriba a la derecha.

## Flujo feliz (cajero con scanner)
Escanear → fila agregada/sumada → … → click/Enter en etiqueta EFECTIVO (completa el total) → corregir monto si el cliente da más → ver **Vuelto** → `F12` APROBAR → carrito vacío, foco en el código. Cero modales, cero confirmaciones.

## Gestión del foco (crítico)
- Foco por defecto: input de código. Vuelve ahí después de: agregar, quitar la última línea, cerrar F2/F10, aprobar, Esc desde el carrito.
- ↓ desde el input → primera fila del carrito. Esc desde el carrito → input.
- Tab desde el input → carrito → Descuento → medios de pago → APROBAR.
- Cualquier dígito tipeado mientras el foco está en una zona **no editable** (fila, botón) se redirige al input de código (así un escaneo nunca se pierde).

## Estados del ejemplo
Descuento 5 %, pagado efectivo $ 10.000 + transferencia $ 5.000 → **Falta cubrir**, APROBAR deshabilitado con hint. Coca-Cola agregada con stock insuficiente: badge en la fila + toast.
