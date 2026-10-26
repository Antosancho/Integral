# PaymentPanel

Panel inferior **sticky** de Ventas: siempre visible, nunca se scrollea con el carrito. Solo aparece si el carrito tiene al menos una línea.

## Layout (≥1280px)
Dos columnas: izquierda flexible (Subtotal + Descuento en una línea; debajo los 5 medios de pago), derecha fija 420px (`panel-width`): **TOTAL** → **Vuelto** → **APROBAR VENTA**. Lectura natural de arriba a abajo en la columna derecha: cuánto es, cuánto falta/sobra, aprobar.

## Descuento %
Texto libre decimal, sufijo `%`. Positivo = descuento, negativo = recargo; rango −200 a 200 (fuera de rango se restaura el último válido, en silencio). Si es recargo, el label cambia a "Recargo" y el valor se muestra en `warning`.

## Medios de pago
EFECTIVO · DÉBITO · CRÉDITO · TRANSFERENCIA · OTROS. Cada uno: **botón-etiqueta** (`ig-pay-tag`) + input de monto.
- Click / Enter en la etiqueta → completa el input con **lo que falta pagar** (si falta 0, no hace nada) y pone el foco en ese input con el texto seleccionado.
- Con monto > 0 el medio queda `is-filled` (etiqueta rellena `primary`): se ve de un vistazo con qué se pagó.
- Se pueden combinar varios. Pagar de más está permitido (genera vuelto).
- Atajos propuestos: `Alt+1`…`Alt+5` = etiqueta de cada medio.

## APROBAR VENTA
`ig-btn-xl` primary. Habilitado solo si: carrito no vacío **y** pagado ≥ total **y** ninguna línea General. Deshabilitado = atenuado + hint debajo explicando por qué ("Falta cubrir $ 3.240,50" / "Las líneas General aún no se pueden guardar").
- Atajo propuesto: `F12` (o `Ctrl+Enter`).
- Al aprobar: el botón muestra "Guardando…" ≤ 300 ms, luego se vacía el carrito, se resetean descuento y montos y el foco vuelve al input de código. Sin alerta de éxito. Si falla al guardar: toast danger "No se pudo guardar la venta. Probá de nuevo." y **no** se vacía nada.
