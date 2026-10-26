# Button

Botón de acción. Un solo **primary** por vista: la acción para la que existe la pantalla (Nuevo producto, Guardar, APROBAR VENTA).

## Variantes
| Clase | Uso |
|---|---|
| `ig-btn-primary` | Acción principal. `primary` + `ink-on-brand`. |
| `ig-btn-secondary` | Acciones de igual jerarquía (Cargar stock, Volver). Borde `border-control`. |
| `ig-btn-ghost` | Cancelar, acciones terciarias, ícono ✕ de fila. |
| `ig-btn-edit` | **Solo** "Editar" en la tabla de Stock. `edit` (#f59e0b) con `ink-on-edit` — nunca texto blanco (falla contraste). |
| `ig-btn-danger` | Eliminar producto (futuro), siempre con confirmación. |

Tamaños: `ig-btn-sm` 32px (dentro de filas), md 40px (default), `ig-btn-lg` 48px, `ig-btn-xl` 64px (solo APROBAR VENTA, ancho completo, Plus Jakarta 800 en mayúsculas).

## Reglas
- Verbo primero, sentence case: "Cargar stock", "Guardar producto". Excepción de marca: **APROBAR VENTA** en mayúsculas.
- Ícono lucide opcional a la izquierda, 18px. Botón solo-ícono lleva `aria-label`.
- Si tiene atajo, mostrar `Kbd` a la derecha del texto ("Buscar F2").
- Deshabilitado: fondo `surface-sunken`, texto `ink-disabled`, `cursor:not-allowed`, y **siempre** una explicación visible cerca (hint) de por qué.
- Foco: anillo `focus-ring` 3px + offset 2px; nunca se quita.

## Props (React)
`variant: "primary"|"secondary"|"ghost"|"edit"|"danger"` · `size: "sm"|"md"|"lg"|"xl"` · `icon?: LucideIcon` · `shortcut?: string` · `disabled?` · `onClick`.
