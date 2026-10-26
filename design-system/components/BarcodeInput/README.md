# BarcodeInput

El input de código de barras de Ventas. **Siempre** tiene el foco salvo que el usuario esté editando una celda o haya un popup abierto.

- Alto 56px, borde 2px `primary`, texto en `barcode` (IBM Plex Mono 18px) para leer dígitos sin confusión.
- A la derecha, estado: "Listo para escanear" (`success`) cuando tiene foco; si lo pierde, cambia a "Hacé click acá o tocá Esc para escanear" en `warning` — así el cajero sabe que un escaneo se perdería.
- Debajo: fila `ig-shortcuts` fija con los atajos de caja.
- Flujo: scanner tipea + Enter → se busca exacto → se agrega/suma 1 → se limpia el input → foco sigue acá. Sin sonido de éxito; el feedback es la fila nueva resaltada 600 ms (`surface-selected` que se desvanece).
- Si el código no existe: toast "Producto no encontrado", el input conserva el texto seleccionado (para reintentar o borrar con una tecla).
