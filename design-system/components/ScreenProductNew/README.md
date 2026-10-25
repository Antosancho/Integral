# ScreenProductNew

Modal **Nuevo producto** (640px) sobre Stock. Mismo formulario que Editar.

## Orden de campos (orden de Tab)
Nombre* → Categoría* → Proveedor* → Precio de compra* → Precio de venta* → Código de barras → Stock inicial → Stock mínimo → Vencimiento del lote.

## Reglas
- Grilla de 2 columnas; Nombre, Código y Vencimiento ocupan el ancho.
- Bajo Precio de venta se muestra **margen y ganancia por unidad** en vivo (ayuda al dueño a no vender a pérdida). Si venta < compra: texto en `warning` "Estás vendiendo por debajo del costo" (no bloquea).
- Código de barras: el lector funciona dentro del campo; el Enter del scanner **no** envía el formulario (se intercepta y pasa al campo siguiente).
- **Vencimiento del lote** aparece solo si Stock inicial > 0 (entra con animación de altura 150 ms) y solo al crear.
- Validación al confirmar: foco al primer campo con error; todos los errores visibles a la vez.
- Código duplicado → error en el campo, el modal no se cierra.
- Guardar con `Ctrl+Enter` o el botón; Esc pregunta "¿Descartar los cambios?" solo si hay datos tipeados.
- Al guardar: cierra, refresca la tabla y **selecciona y scrollea** a la fila nueva (resaltada 600 ms).
