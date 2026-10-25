# StatCard

Tarjeta de indicador para Estadísticas: rótulo con ícono (`label`, `ink-muted`), valor en `amount-xl`, variación vs. período anterior equivalente.

- Variación: flecha `trending-up`/`trending-down` + signo + porcentaje con coma (`+12,4 %`) en `success` / `danger`; sin cambio "0,0 %" en `ink-muted` con `minus`. Siempre con el período comparado en palabras ("vs. septiembre", "vs. ayer", "vs. semana anterior").
- Sin datos del período anterior: "Sin datos para comparar" en `ink-subtle`.
- Montos grandes no se abrevian (el dueño quiere el número exacto); si no entra, bajar a `amount-lg`.
- Orden fijo: Ventas totales · Cantidad de ventas · Ticket promedio · Ganancia total.
