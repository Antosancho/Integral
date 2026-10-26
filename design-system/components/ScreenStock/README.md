# ScreenStock

Pantalla inicial de la app. Lista de productos de solo lectura con acciones.

## Estructura
1. Header (Stock activo).
2. Cabecera de página: título "Stock" · segmentado **Productos | Movimientos** · a la derecha **Cargar stock** (secondary) y **+ Nuevo producto** (primary).
3. Toolbar: buscador (nombre o código, debounce 250 ms, `Ctrl+F` enfoca) · filtro Categoría · toggle "Solo stock bajo" · contador.
4. Alerta inline de stock negativo (solo si existe ≥1). Su botón abre Cargar stock con ese producto preseleccionado (paso 2).
5. Tabla (7 columnas) con scroll propio, header sticky. Pie con totales.

## Interacciones
- Doble click o Enter en fila → Editar producto. Botón Editar (amarillo) igual.
- Menú ⋮ por fila: **Ver movimientos** · **Cargar stock de este producto** · Eliminar (futuro, admin).
- Escanear un código estando en Stock (sin foco en un input) → filtra la tabla por ese código y selecciona la fila.
- Orden por defecto: Nombre A–Z. Click en encabezado ordena (flecha ↑/↓ en el `th`).
- Atajos propuestos: `Ctrl+N` Nuevo producto · `Ctrl+L` Cargar stock · `Ctrl+F` Buscar.
