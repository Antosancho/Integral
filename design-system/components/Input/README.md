# Input

Campo de texto con label arriba. Todos los numéricos son **texto libre** (sin spinners) y se validan al confirmar.

## Anatomía
`ig-field` > `ig-label` (+ `<span class="req">*</span>` si es obligatorio) > `ig-input` > `ig-help` o `ig-error`.

## Tipos
| Tipo | Clase / atributos | Reglas |
|---|---|---|
| Texto | `ig-input` | — |
| Monto | `ig-input ig-input-amount` + prefijo `$` (`ig-input-wrap` + `ig-prefix`), `inputmode="decimal"` | Acepta `,` y `.`; al salir se formatea `4.890,00`. Alineado a la derecha, tabular. |
| Entero | `ig-input ig-input-amount`, `inputmode="numeric"` | Stock, cantidades. |
| Código | `ig-input` con `font-family: var(--font-mono)` | Solo dígitos, máx. 20. |
| Fecha | `ig-input`, placeholder `DD/MM/AAAA` | Autoinserta `/` al tipear; valida día/mes. |
| Búsqueda | `ig-input-wrap` + ícono `search` | Debounce 250 ms. |

## Estados
default · hover (`ink-muted` en borde) · **foco** (borde + anillo `focus-ring` 3px) · error (`is-error`: borde `danger-border`, fondo `danger-soft`, mensaje `ig-error` con ícono) · solo lectura (`is-readonly`: fondo `surface-sunken`, borde punteado, ayuda debajo) · deshabilitado.

## Reglas
- El error aparece debajo del campo, en el modal, **sin cerrarlo**. Al corregir, desaparece en el momento.
- Mensajes de error dicen qué hacer: "Ingresá un precio mayor o igual a 0", no "Valor inválido".
- `type="number"` está prohibido (spinners y comportamiento raro con coma): usar `type="text"` + `inputmode`.
