# ScreenSalesSearch

Buscador emergente **F2** (820px) sobre Ventas.

- F2 abre/cierra (toggle). Esc o click fuera cierran. Excluyente con F10 (abrir uno cierra el otro).
- Un solo input busca por **nombre y código** a la vez:
  - solo dígitos → código **exacto**; el resultado se lista pero **Enter no agrega** (evita doble alta si el scanner dispara dentro). Se muestra el hint info del ejemplo y hay que hacer click en la fila.
  - texto → nombre parcial, sin distinguir mayúsculas ni tildes ("yerba" = "Yerba", "sereni" = "Serenísima"). Enter agrega la fila seleccionada.
- Tabla Código | Nombre | Stock con estados de stock (bajo/negativo); productos sin precio aparecen con badge "Sin precio" y al elegirlos se muestra el toast correspondiente.
- Al agregar: se cierra el popup y el foco vuelve al input de código. Alternativa propuesta: `Shift+Enter` agrega y deja el popup abierto para seguir buscando.
