# ScreenSalesGeneral

Popup **Ítem general (F10)**, 440px, un único input de monto grande con foco.

- Enter agrega una fila **General** (cantidad 1, monto ingresado) y cierra; el foco vuelve al input de código. Cada confirmación crea una fila nueva.
- Monto > 0, coma o punto decimal. Inválido: error inline "Ingresá un monto mayor a 0" sin cerrar.
- F10 toggle; Esc cancela; excluyente con F2.
- Mientras haya líneas General: **APROBAR VENTA deshabilitado** + hint "Las líneas General aún no se pueden guardar" (`warning`, ícono info). Aunque el pago esté completo (el ejemplo muestra Vuelto positivo).
