# Cart

Lista de líneas de la venta. Cada fila es navegable y editable sin mouse.

## Columnas
Producto (nombre + badge si "Sin stock") · Cantidad · Precio unit. · Total de la línea (bold) · ✕.

## Edición en el lugar (`ig-cell-edit`)
- En reposo la celda parece texto (sin borde); hover muestra borde; al editar: borde + anillo `focus-ring` (`is-editing`).
- Enter o salir del campo → confirma. Esc → descarta. Valor inválido (cantidad < 1, precio < 0, vacío, letras) → se restaura el anterior **en silencio**. La fila nunca desaparece por un valor intermedio.
- Precio distinto del de lista → texto `info` (`is-modified`) + precio original tachado debajo. Así se ve el descuento manual.

## Teclado
| Tecla | En la fila | En una celda |
|---|---|---|
| ↑ / ↓ | Mover fila activa (`is-selected`) | Confirma y mueve a la misma celda de la otra fila |
| Enter | Editar cantidad | Confirmar |
| Tab | Cantidad → Precio → ✕ → siguiente fila | — |
| Supr | **Quitar la línea** | Borra texto (comportamiento normal) |
| Esc | Volver al input de código | Descartar edición |

## Reglas
- Escanear un producto ya presente suma 1 a su fila y la resalta 600 ms (no crea otra).
- Líneas **General**: ícono `receipt`, nombre "General", badge F10. Editables y eliminables como las demás.
- Al quitar la línea con foco, el foco pasa a la siguiente (o a la anterior si era la última; si el carrito queda vacío, al input de código).
- Vacío: `ig-cart-empty` "Escaneá un producto para empezar" + atajos F2 / F10.
