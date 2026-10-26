# Estados y textos

Inventario de todos los estados por pantalla y los textos exactos. Usar estos copys tal cual.

## Matriz de estados

| Pantalla / componente | Vacío | Cargando | Error | Alerta (no bloquea) | Deshabilitado |
|---|---|---|---|---|---|
| Stock › Productos | "Todavía no hay productos" + Nuevo producto | Skeleton de 8 filas | "No pudimos leer los productos" + Reintentar | Stock negativo (danger), stock bajo (warning) | — |
| Stock › Movimientos | "Todavía no hay movimientos" | Skeleton | Igual que Productos | — | — |
| Buscar (tablas, F2, Cargar stock) | "No encontramos «x»" | Skeleton de 3 filas tras 300 ms | — | — | — |
| Carrito | "Escaneá un producto para empezar" + atajos F2/F10 | — | — | "Sin stock" en fila | — |
| Panel de pago | Oculto | — | Toast si falla guardar | Falta cubrir | APROBAR con hint |
| Historial de ventas | "No hay ventas en este período" + "Ver últimos 7 días" | Skeleton | Reintentar | — | — |
| Estadísticas | Por tarjeta: "Sin ventas en este período"; KPIs en "—" | Skeleton por tarjeta | Reintentar por tarjeta | Productos sin precio de compra | — |
| Widget vencimientos | No se muestra | — | — | Siempre | — |

## Textos

### Validaciones del formulario Producto
| Campo | Regla | Mensaje |
|---|---|---|
| Nombre | obligatorio | Ingresá el nombre del producto. |
| Precio de compra / venta | obligatorio, ≥ 0 | Ingresá un precio mayor o igual a 0. |
| Precio de venta < compra | aviso (no bloquea) | Estás vendiendo por debajo del costo. |
| Categoría | obligatorio | Elegí o creá una categoría. |
| Proveedor | obligatorio | Elegí o creá un proveedor. |
| Código de barras | solo dígitos, ≤ 20 | El código solo puede tener números (hasta 20). |
| Código de barras | único | Ese código ya lo usa «{producto}». Usá otro o dejalo vacío. |
| Stock inicial / mínimo | entero ≥ 0 | Ingresá un número entero, 0 o mayor. |
| Vencimiento | fecha válida | Revisá la fecha (DD/MM/AAAA). |
| Picker (alta) | nombre repetido | Ya existe «{nombre}». Elegilo de la lista. |

### Cargar stock
- Label: **Cantidad a agregar (negativo = merma) \***
- Vista previa: "Reposición: el stock queda en {n}" · "Merma: el stock queda en {n}" · "El stock quedará en {n}" (si < 0).
- Error: "Ingresá una cantidad distinta de 0, sin decimales."
- Sin resultados: "No encontramos «{x}». ¿Es un producto nuevo?" + **Crear producto**.

### Ventas
- Input: placeholder "Escaneá o escribí un código de barras".
- Toasts: "Producto no encontrado" · "Sin stock suficiente" / "«{producto}» se agregó igual" · "El producto no tiene un precio cargado" / "«{producto}» — no se agregó" · "No se pudo guardar la venta. Probá de nuevo."
- Vuelto: "Falta cubrir" · "Pago exacto" · "Vuelto".
- Hints de APROBAR: "Falta cubrir {monto}" · "Las líneas General aún no se pueden guardar" · "Agregá al menos un producto".
- Descuento: ayuda "positivo = descuento · negativo = recargo"; label cambia a "Recargo" si es negativo.
- F10: título "Ítem general", ayuda "Mayor a 0. Podés usar coma o punto.", error "Ingresá un monto mayor a 0."

### Vencimientos
- Botón: "{n} vencido(s)" · "{n} vence(n) hoy" · ambos separados por " · ".
- Popup: título "Lotes a revisar", bajada "Sacalos de la góndola o recordalos más tarde.", acciones "Recordame luego" / "Ya lo saqué".
- Detalle de fila: "Venció el {fecha} · lote cargado el {fecha} · {n} u." · "Vence hoy · {n} u." · "lote ya vendido (0 u.)".

### Salir de Ventas con carrito (si no se persiste)
Diálogo: "Tenés una venta en curso" / "Si salís, se pierde el carrito." · **Seguir vendiendo** (primary) · Salir igual (ghost).
