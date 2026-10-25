# ScreenLoadStock

Modal **Cargar stock** (640px), flujo de 2 pasos, solo para productos existentes. Se muestran ambos pasos lado a lado como referencia; en la app es un solo modal que cambia de contenido.

## Paso 1 · Buscar
- Indicador de pasos en la cabecera (1 actual, 2 pendiente).
- Input grande con foco (debounce 250 ms; acepta escaneo: con código exacto salta directo al paso 2).
- Tabla Código | Nombre | Stock actual, coincidencia en negrita. ↑/↓ mueven, Enter continúa con la fila seleccionada. Click también.
- Esc cierra el modal. Sin resultados: "No encontramos «x». ¿Es un producto nuevo?" + botón "Crear producto" (abre Nuevo producto con el nombre/código precargado).

## Paso 2 · Confirmar
- Producto en solo lectura con stock actual.
- **Cantidad** (entero ≠ 0) con foco. Vista previa en vivo debajo: positivo → "Reposición: el stock queda en 30" (`success`); negativo → "Merma: el stock queda en 22" (`warning`, número en `warning`). Si queda negativo: "El stock quedará en −3" (`danger`, no bloquea).
- Vencimiento del lote (opcional) y Notas (opcional).
- Botones **Volver** (secondary) y **Cargar stock** (primary). Esc = Volver (no cierra).
- Confirmar: cierra, refresca la tabla y resalta la fila actualizada.
