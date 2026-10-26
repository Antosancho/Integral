# Flujos de usuario

Mapa completo de la app y cada recorrido, paso a paso. Cada paso nombra la pantalla (preview en el grupo **Pantallas**) y el componente involucrado.

## Mapa de navegación

```
App (arranca en Stock)
├── Header ─ Stock | Ventas | Estadísticas ─ [widget vencimientos → popup Lotes a revisar]
├── STOCK
│   ├── Productos (default) ── tabla
│   │   ├── + Nuevo producto ──────── modal Producto (crear)
│   │   │     └── Categoría / Proveedor ── Picker con alta en el momento
│   │   ├── Editar (fila) ──────────── modal Producto (editar)
│   │   ├── Cargar stock ───────────── modal 2 pasos: Buscar → Confirmar
│   │   └── ⋮ fila ── Ver movimientos · Cargar stock de este producto · (Eliminar, futuro)
│   └── Movimientos ── historial de stock filtrable
├── VENTAS
│   ├── Nueva venta (default) ── input código + carrito + panel de pago
│   │   ├── F2  ── popup Buscar producto
│   │   └── F10 ── popup Ítem general
│   └── Historial ── filtros + lista + detalle
└── ESTADÍSTICAS ── período + 4 KPIs + rankings + franjas + menor rotación
```

## F1 · Abrir la app

1. Splash de 1 s máx. con `factor-integral-horizontal-claro.png` sobre `bg` mientras carga la base.
2. Entra a **Stock › Productos** (`ScreenStock`).
3. Si hay lotes vencidos o que vencen hoy → aparece `ExpiryAlert` en el header (no se abre solo).
4. Si hay stock negativo → `Alert` danger sobre la tabla.
5. Error al abrir la base → `States` (error) a pantalla completa con "Reintentar".

## F2 · Vender (camino feliz, con scanner)

1. Header › **Ventas** (o `Ctrl+2`). Foco en el input de código (`BarcodeInput`).
2. Escanear → la fila aparece arriba del carrito (o suma 1 si ya estaba), resaltada 600 ms. Foco sigue en el input.
3. Aparece el `PaymentPanel` con la primera línea. TOTAL se actualiza en vivo.
4. (Opcional) Descuento: `Tab` hasta Descuento, tipear `10` → TOTAL se recalcula.
5. Cobrar: click/Enter en **EFECTIVO** → el input se completa con lo que falta y queda seleccionado; si el cliente da $ 20.000, tipear `20000`.
6. `ChangeIndicator` pasa a **Vuelto $ 3.620,00** (success).
7. `F12` o click en **APROBAR VENTA** → carrito vacío, panel oculto, foco en el input. Sin mensaje.

## F3 · Vender con pago combinado

1–4 igual que F2.
5. Tipear `1000` en EFECTIVO → "Falta cubrir $ 500,00".
6. Click en etiqueta **TRANSFERENCIA** → completa $ 500,00 → "Pago exacto".
7. Aprobar.

## F4 · Producto sin código / buscar por nombre

1. `F2` → popup Buscar (`ScreenSalesSearch`), foco en su input.
2. Tipear "yer" → resultados en vivo; ↓ para elegir; `Enter` agrega y cierra.
3. Foco vuelve al input de código.
- Si se tipean solo dígitos, se busca el código exacto y **Enter no agrega**: click en la fila.

## F5 · Ítem General (monto suelto)

1. `F10` → popup (`ScreenSalesGeneral`), foco en Monto.
2. Tipear `850,50` + `Enter` → fila "General" en el carrito.
3. APROBAR queda deshabilitado con hint "Las líneas General aún no se pueden guardar". Para continuar, quitar la línea (`Supr` con la fila seleccionada).

## F6 · Corregir el carrito

- Cambiar cantidad: `↓` desde el input → fila → `Enter` → tipear → `Enter`.
- Descuento por línea: `Tab` al precio unitario → tipear el nuevo precio → `Enter` (se ve en `info` con el precio original tachado).
- Quitar: fila seleccionada + `Supr`, o click en ✕.
- Volver a escanear: `Esc`.

## F7 · Alertas durante la venta (no bloquean)

| Evento | Qué ve el cajero | Qué pasa |
|---|---|---|
| Código inexistente | Toast danger "Producto no encontrado" + código | Nada se agrega; el texto queda seleccionado en el input |
| Stock insuficiente | Toast warning "Sin stock suficiente" + badge "Sin stock" en la fila | Se agrega igual |
| Producto sin precio | Toast danger "El producto no tiene un precio cargado" | No se agrega (scanner y F2) |
| Falla al guardar | Toast danger "No se pudo guardar la venta. Probá de nuevo." | Nada se borra |

## F8 · Alta de producto

1. Stock › **+ Nuevo producto** (`Ctrl+N`) → modal (`ScreenProductNew`), foco en Nombre.
2. Completar; en Categoría/Proveedor, si no existe: tipear el nombre → "+ Crear «…»" → (proveedor: teléfono y notas opcionales) → **Crear y elegir** (`Picker`).
3. Precio de venta muestra margen en vivo.
4. Si Stock inicial > 0 aparece Vencimiento del lote.
5. `Ctrl+Enter` → valida. Con errores: foco al primero, el modal sigue abierto. OK: cierra, la tabla se refresca y selecciona la fila nueva.

## F9 · Editar producto

1. Fila › **Editar** (o `Enter` con la fila seleccionada) → modal (`ScreenProductEdit`).
2. Stock en solo lectura con "Para modificar el stock usá «Cargar stock»".
3. Guardar cambios → cierra y resalta la fila.

## F10 · Reponer stock o registrar merma

1. Stock › **Cargar stock** (`Ctrl+L`) → paso 1 (`ScreenLoadStock`), foco en buscar. Se puede escanear.
2. `↓` + `Enter` → paso 2, foco en Cantidad.
3. `24` = reposición ("el stock queda en 48") · `-2` = merma ("el stock queda en 22", warning).
4. Vencimiento (opcional) y Notas (opcional). `Enter` → cierra, refresca, resalta.
- `Esc` en paso 2 vuelve al paso 1; en paso 1 cierra.
- Atajo desde la fila: ⋮ › "Cargar stock de este producto" abre directo en paso 2.

## F11 · Revisar vencimientos

1. Click en el widget del header → popup **Lotes a revisar** (`ScreenExpiry`).
2. Por fila: **Ya lo saqué** (descarta para siempre) o **Recordame luego** (vuelve al reabrir la app).
3. Cuando no quedan filas, el popup se cierra y el widget desaparece.

## F12 · Consultar ventas pasadas

1. Ventas › **Historial** (`ScreenSalesHistory`). Default: hoy.
2. Filtrar por fechas, producto o medio de pago. `↑/↓` recorre ventas; el detalle se actualiza.

## F13 · Ver estadísticas

1. Header › **Estadísticas** (`ScreenStats`). Default: Este mes.
2. Cambiar período con el segmentado; Personalizado abre Desde/Hasta.
3. Click en un producto de un ranking → Stock › Movimientos filtrado por ese producto.
