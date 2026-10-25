# ScreenStats

**Estadísticas** (planificada). Lectura, no operación: densidad media, todo en una pantalla con scroll.

## Estructura
1. Cabecera: título · texto del período actual y del comparado · selector **Hoy | Esta semana | Este mes | Personalizado** (default Este mes). Personalizado abre un popover con Desde/Hasta y atajos ("Últimos 7 días", "Mes pasado").
2. 4 KPI (`StatCard`): Ventas totales · Cantidad de ventas · Ticket promedio · Ganancia total — cada uno con % vs. período anterior equivalente (mismo largo de días: 1–24 oct vs. 1–24 sep).
3. Grilla 2×2: Más vendidos (top 5, unidades) · Más facturan (top 5, monto) · Cuándo se vende más (tabs **Por hora / Por día de semana**, barra horizontal con el pico en `chart-1`) · Menor rotación (top 10, productos sin ventas primero con "Nunca").

## Reglas
- Ganancia = ventas − costo (precio de compra vigente al vender). Si faltan precios de compra: nota "Hay 3 productos sin precio de compra; la ganancia puede ser menor" (`warning`).
- Click en un producto de los rankings → Stock › Movimientos filtrado.
- Cargando: skeletons por tarjeta. Sin ventas en el período: estado vacío en cada tarjeta, KPIs en "—".
- Futuro: gráfico de línea diario de ventas sobre los KPIs (usar `chart-1` actual vs `chart-3` período anterior).
