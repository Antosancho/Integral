# AppHeader

Header fijo de 60px en `surface-header` (azul noche) con logo, navegación y, a la derecha, el widget de vencimientos.

## Anatomía (izq → der)
1. Logo horizontal fondo oscuro (`assets/Logos/factor-integral-horizontal-oscuro.png`), 34px de alto. Click → Stock.
2. Navegación `ig-nav`: **Stock · Ventas · Estadísticas** con ícono lucide (`package`, `shopping-cart`, `chart-column`). Activa = píldora blanca con texto `brand-night`; inactivas `ink-on-header-muted`.
3. Espaciador.
4. `ExpiryAlert` (solo si hay alertas). Reservar a su izquierda el lugar futuro del usuario/rol (admin / cajero).

## Reglas
- La app arranca en **Stock**. No hay Home.
- Atajos propuestos: `Ctrl+1` Stock, `Ctrl+2` Ventas, `Ctrl+3` Estadísticas.
- Si el carrito tiene ítems y se cambia de sección: el carrito se pierde (limitación aceptada). Recomendación: guardar el estado del carrito en un store global (Zustand/Context) para no perderlo; si no, mostrar confirmación "Tenés una venta en curso. ¿Salir igual?".
- Foco dentro del header usa `focus-ring-on-dark`.
