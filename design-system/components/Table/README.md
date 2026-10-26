# Table

Tabla de datos de solo lectura con acciones por fila. Base de Stock, buscadores, historiales y estadísticas.

## Anatomía
`ig-table-wrap` (tarjeta) > `ig-table` > `thead` sticky (`surface-sunken`, `label`) > filas de 48px (`row-height`) > `ig-table-foot` con totales y atajos.

## Columnas
- Texto a la izquierda; **montos y cantidades a la derecha** (`.r`, tabular-nums); códigos en mono (`.code`, `ink-muted`).
- Nombre en `body-strong` (`.name`). Info secundaria (proveedor) en segunda línea `caption`.
- Acciones al final (`.actions`): botón `Editar` (variant edit, sm) + menú ⋮ (Movimientos, Eliminar — futuro).

## Estados de fila
| Estado | Tratamiento |
|---|---|
| hover | `surface-hover` |
| seleccionada / foco teclado | `surface-selected` + barra izquierda 4px `focus-ring` |
| stock bajo (stock ≤ mínimo) | celda en `warning` bold + ícono `arrow-down` |
| stock negativo | celda `danger` bold sobre `danger-soft` + ícono `triangle-alert` |
| sin stock (0) | igual que bajo (0 ≤ mín.) |

Color nunca solo: cada estado lleva ícono y aparece contado en el pie.

## Teclado
La tabla es un único tab-stop (`role="grid"`); ↑/↓ mueven la fila activa, Enter ejecuta la acción principal (Editar), Inicio/Fin saltan.
