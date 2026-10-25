# ChangeIndicator

Bloque de **vuelto** debajo del TOTAL. Se recalcula en cada tecla. Los tres estados se distinguen por **palabra, ícono, color y borde** (no solo color).

| Pagado − Total | Estado | Etiqueta | Ícono | Tono |
|---|---|---|---|---|
| < 0 | `is-due` | Falta cubrir (monto en positivo) | `circle-alert` | danger |
| = 0 | `is-exact` | Pago exacto | `equal` | neutral |
| > 0 | `is-return` | Vuelto | `hand-coins` | success |

Monto en `amount-xl` (30px). Sin pagos cargados se muestra "Falta cubrir" con el total. `aria-live="polite"` anuncia el estado solo cuando cambia de categoría (no en cada tecla).
