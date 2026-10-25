# States

Estados de pantalla completos. Todas las vistas de datos implementan los tres.

- **Vacío** (`ig-empty`): ícono en cuadro `primary-soft`, título `title-md`, una frase que dice qué hacer, y la acción primaria. Copys: Stock "Todavía no hay productos"; Carrito "Escaneá un producto para empezar"; Historial "No hay ventas en este período"; Búsqueda "No encontramos «x»".
- **Cargando**: skeleton (`ig-skel`) con la forma de la tabla; aparece recién a los 300 ms (si carga antes, no parpadea). Nunca spinners de página completa.
- **Error**: ícono en `danger-soft`, qué pasó en lenguaje simple + botón "Reintentar". Sin códigos técnicos en pantalla (van al log).
- Búsqueda sin resultados dentro de tablas: fila única centrada en `ink-muted`.
