# Alert

Mensajes **no bloqueantes**. Nunca interrumpen la venta ni roban el foco.

## Alert inline (`ig-alert`)
Banner dentro de la pantalla, sobre la tabla. Para situaciones persistentes: stock negativo, stock bajo, línea General. Tono `danger` / `warning` / `info` / `success`, ícono + título `body-strong` + detalle en `ink` + acción opcional (sm secondary).

## Toast (`ig-toast`)
Aviso efímero arriba a la derecha del área de contenido (debajo del header), `z-popover`, máx. 3 apilados, el más nuevo arriba.
- Dura **4 s** (6 s si tiene detalle), pausa con hover; `role="status"` (`aria-live="polite"`).
- **No** toma foco: el cajero sigue escaneando.
- Repetido (mismo mensaje y producto) → reinicia el tiempo y muestra "×2" en vez de apilar.

| Situación | Mensaje | Detalle | Tono | ¿Agrega? |
|---|---|---|---|---|
| Código inexistente | Producto no encontrado | Código escaneado | danger | No |
| Stock insuficiente | Sin stock suficiente | «Producto» se agregó igual | warning | Sí |
| Sin precio | El producto no tiene un precio cargado | «Producto» — no se agregó | danger | No |

No hay toast de éxito al aprobar venta (flujo silencioso).
