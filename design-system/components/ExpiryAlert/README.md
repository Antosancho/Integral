# ExpiryAlert

Aviso de lotes **vencidos** o que **vencen hoy**, a la derecha del header.

## Botón
- Blanco (`expiry-bg`) con borde rojo 2px (`expiry-border`), texto `expiry-ink`, ícono `triangle-alert`, píldora 38px. Igual en ambos temas.
- Muestra solo las categorías con cantidad > 0: "2 vencidos" · "3 vencen hoy" · "2 vencidos · 3 vencen hoy". Plural/singular correcto: "1 vencido", "1 vence hoy".
- Sin alertas → el widget **no se renderiza** (no un "0").

## Popup "Lotes a revisar"
- Se abre con click o Enter, anclado bajo el botón, 820px (`modal-lg`), `shadow-lg`. Esc o click fuera cierran.
- Agrupado: **Vencidos** primero, luego **Vencen hoy**. Rótulo `overline` con contador.
- Fila: nombre (`body-strong`), detalle en `caption` (fecha de vencimiento, fecha de carga del lote, unidades del lote; "lote ya vendido (0 u.)" si se agotó — sigue alertando).
- Acciones: **Recordame luego** (secondary: oculta en esta sesión) · **Ya lo saqué** (primary: descarta para siempre).
- Al resolver una fila: se colapsa con animación 150 ms, el contador del botón se actualiza; al quedar vacío el popup se cierra y el widget desaparece.
- Teclado: Tab recorre los botones fila por fila.
