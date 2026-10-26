# ScreenSalesHistory

**Historial** de ventas (segmentado dentro de Ventas). Maestro–detalle.

- Filtros en una fila: Desde / Hasta (default: hoy), Producto (nombre o código: muestra ventas que lo contienen), Medio de pago (Todos, Efectivo, Débito, Crédito, Transferencia, Otros, Combinado). "Limpiar filtros" solo visible si hay alguno activo. Los filtros aplican al instante.
- Resumen a la derecha: cantidad de ventas y total del filtro.
- Tabla: N° · Fecha y hora · Ítems · Medio de pago (combinados: "Efectivo + Transferencia") · Total. Orden: más reciente primero. ↑/↓ cambia la venta del detalle.
- Detalle: ítems, subtotal, descuento/recargo, total, pagos por medio y vuelto. Lugar reservado para futuras acciones: **Reimprimir ticket** y **Anular venta** (solo admin).
- Vacío: "No hay ventas en este período" + botón "Ver últimos 7 días".
- Recomendación: mantener el carrito de "Nueva venta" en memoria al cambiar a Historial.
