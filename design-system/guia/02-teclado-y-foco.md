# Teclado y foco

La app se tiene que poder usar entera sin mouse. Esta es la referencia única de atajos. Los marcados **(propuesta)** no están en el brief original: son recomendaciones de diseño, a confirmar.

## Globales

| Tecla | Acción |
|---|---|
| `Ctrl+1` / `Ctrl+2` / `Ctrl+3` | Ir a Stock / Ventas / Estadísticas **(propuesta)** |
| `Esc` | Cerrar popup o modal · descartar edición · en Ventas, volver al input de código |
| `Tab` / `Shift+Tab` | Moverse entre campos en orden visual |
| `Enter` | Confirmar campo, popup o formulario de una línea |
| `Ctrl+Enter` | Confirmar formularios largos (Producto) **(propuesta)** |

## Stock

| Tecla | Acción |
|---|---|
| `Ctrl+N` | Nuevo producto **(propuesta)** |
| `Ctrl+L` | Cargar stock **(propuesta)** |
| `Ctrl+F` | Enfocar buscador **(propuesta)** |
| `↑` / `↓` | Mover fila seleccionada |
| `Enter` | Editar producto seleccionado |

## Ventas

| Tecla | Acción |
|---|---|
| Enter (scanner) | Agregar producto por código |
| `F2` | Abrir/cerrar buscador (excluyente con F10) |
| `F10` | Abrir/cerrar Ítem general (excluyente con F2) |
| `↓` desde el input | Ir a la primera fila del carrito |
| `↑` / `↓` | Navegar filas / resultados |
| `Enter` en fila | Editar cantidad |
| `Supr` | Quitar la línea seleccionada (en un input, borra texto) |
| `Alt+1`…`Alt+5` | Etiqueta de EFECTIVO…OTROS: completar lo que falta **(propuesta)** |
| `F12` | APROBAR VENTA si está habilitado **(propuesta)** |

## Cargar stock

| Tecla | Paso 1 · Buscar | Paso 2 · Confirmar |
|---|---|---|
| `↑` / `↓` | Elegir resultado | — |
| `Enter` | Continuar al paso 2 | Cargar stock |
| `Esc` | Cerrar modal | Volver al paso 1 |

## Reglas de foco (para implementar)

1. **Ventas:** el input de código es el "hogar" del foco. Vuelve ahí al: agregar un producto, cerrar F2/F10, aprobar, `Esc` desde el carrito, quitar la última línea.
2. **Captura de dígitos:** si el foco está en un elemento no editable de Ventas (fila, botón, nada) y llega un dígito, se redirige al input de código antes de procesarlo. Así un escaneo nunca se pierde.
3. **Modales:** foco al primer campo al abrir; focus trap; al cerrar vuelve al disparador (en Ventas: al input de código).
4. **Enter del scanner dentro de formularios** (código de barras en Producto, buscar en Cargar stock): no envía el formulario; pasa al siguiente campo o ejecuta la búsqueda.
5. **Tablas:** un único tab-stop por tabla; adentro se navega con flechas (patrón `role="grid"` con `aria-activedescendant`).
6. **Visibilidad:** `:focus-visible` con `focus-ring` 3px + offset 2px. En el header, `focus-ring-on-dark`. Nunca `outline: none` sin reemplazo.
7. El input de código muestra su estado: "Listo para escanear" (con foco) / "Hacé click acá o tocá Esc para escanear" (sin foco, warning).
