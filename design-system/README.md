Sistema de diseño de **Integral**, la app de escritorio de stock y ventas de **Factor Integral** (Windows, ventana única, Electron + React). Cubre identidad, tokens, componentes, todas las pantallas y los flujos de uso. Las secciones de **Guía** (flujos, teclado, copy, implementación) completan este documento.

## Principios

1. **La caja no espera.** En Ventas el foco vive en el input de código de barras. Ninguna acción exige mouse; ninguna alerta frena una venta.
2. **Informar, no bloquear.** Stock insuficiente, stock negativo y vencimientos se avisan con color + ícono + palabra; la única barrera es APROBAR VENTA cuando falta pagar o hay líneas General.
3. **Números primero.** Montos en IBM Plex Sans con cifras tabulares, alineados a la derecha, formato `$ 1.234,50`. El TOTAL y el vuelto son lo más grande de la pantalla.
4. **El foco siempre se ve.** Anillo `focus-ring` de 3px con 2px de separación, en todos los elementos, en ambos temas.
5. **Enseñar en contexto.** Cada atajo aparece al lado de lo que hace (`Kbd`).

## Voz y contenido

- Español rioplatense, voseo, tono directo y amable: "Escaneá un producto", "Cargá stock", "Recordame luego", "Ya lo saqué".
- Sentence case en botones y títulos ("Nuevo producto", "Cargar stock"). Única excepción: **APROBAR VENTA** y los rótulos de medios de pago (EFECTIVO, DÉBITO, CRÉDITO, TRANSFERENCIA, OTROS), en mayúsculas como en la lámina de marca.
- Errores: qué pasó + qué hacer. "Ese código ya lo usa «Leche entera…». Usá otro o dejalo vacío." Nunca "Error 23505" ni "Valor inválido".
- Nombres de producto entre comillas latinas «…» dentro de mensajes.
- Sin emojis. Los glifos ⚠ y ✕ del brief se implementan con íconos lucide (`triangle-alert`, `x`).
- Moneda `es-AR`: `$ 1.234,50` (signo, espacio, punto de miles, coma decimal). Negativos con signo menos tipográfico `−`. Porcentajes `12,4 %`. Fechas `24/10/2026`, horas `18:42`.

## Color

Paleta de marca: `brand-night` #0a1826 (azul noche), `brand-navy` #0f2d4a (azul marino, color principal), `brand-accent` #2f6ba8 (azul acento), `brand-mist` #f1f3f4 (gris claro) y `brand-white`. La interfaz no usa estos tokens directo: usa los **semánticos**, que resuelven cada tema.

- **Superficies:** ventana en `bg`; tarjetas, tablas, modales e inputs en `surface`; encabezados de tabla y pies de modal en `surface-sunken`; header en `surface-header` (azul noche en ambos temas — es la firma de la marca).
- **Texto:** `ink` principal, `ink-muted` labels y secundarios, `ink-subtle` placeholders y metadatos; sobre azules siempre `ink-on-brand`.
- **Acción:** `primary` (azul marino en claro, azul acento en oscuro) para el botón principal. Un solo primario por vista.
- **Estados:** `danger` (falta cubrir, stock negativo, vencidos), `warning` (stock bajo, merma, hints), `success` (vuelto, reposición, subas), `info` (precio modificado, avisos). Cada uno con su fondo `-soft`. **El color nunca va solo**: siempre ícono y palabra.
- **Editar** (`edit` #f59e0b) es el único amarillo: solo el botón Editar de Stock, con texto `ink-on-edit` (nunca blanco).
- **Widget de vencimientos:** blanco con borde rojo en ambos temas (`expiry-bg`, `expiry-border`, `expiry-ink`).
- Tema **Claro** por defecto (locales con mucha luz). Tema **Oscuro** opcional (turno noche). Todos los pares de texto cumplen 4.5:1 y bordes de controles y foco 3:1 en ambos temas.

## Tipografía

- **Plus Jakarta Sans** (700/800) — títulos, navegación, rótulos `overline`, botón APROBAR VENTA. Estilos: `title-xl` (título de pantalla), `title-lg` (modal), `title-md` (tarjeta), `nav`, `overline`.
- **IBM Plex Sans** (400–700) — todo el texto y **todos los números**. Estilos: `body-lg` (carrito), `body` (tablas), `body-strong`, `label`, `caption`, `button`, `kbd`; números `amount-xxl` (TOTAL 44px), `amount-xl` (vuelto, KPI), `amount-lg` (subtotal, medios de pago), `amount`.
- **IBM Plex Mono** (400) — códigos de barras (`barcode`). Adición intencional: facilita leer y comparar dígitos.
- Siempre `font-variant-numeric: tabular-nums` en montos y cantidades (clase `num`).
- Tamaño base 15px: la app se usa a distancia de brazo, de pie, todo el día.

## Espaciado, forma y profundidad

- Escala de 4px: `space-1` 4 · `space-2` 8 · `space-3` 12 · `space-4` 16 · `space-5` 20 · `space-6` 24 · `space-8` 32 · `space-12` 48. Contenido de pantalla con padding `space-6`.
- Radios: `radius-sm` 6 (inputs, chips), `radius-md` 10 (botones, popovers), `radius-lg` 16 (tarjetas, modales, eco del ícono redondeado de la marca), `radius-pill` (badges, tabs del header, widget de vencimientos).
- Alturas: `control-sm` 32 (en filas), `control-md` 40, `control-lg` 48 (código de barras, pagos), `control-xl` 64 (APROBAR VENTA); filas `row-height` 48; header `header-height` 60.
- Sombras suaves y pocas: `shadow-sm` tarjetas, `shadow-md` popovers, `shadow-lg` modales, `shadow-panel` el panel de pago (hacia arriba). Bordes `border` de 1px para separar; nada de gradientes.

## Movimiento

Rápido y funcional, nunca decorativo: hover/estado 120 ms; modales 160 ms `ease-out` (velo en fade, ventana sube 8px); fila agregada al carrito resaltada en `surface-selected` 600 ms y se desvanece; filas que se van, colapso 150 ms. Con `prefers-reduced-motion` solo fades.

## Iconografía

- **Lucide** (`lucide-react`), trazo 2, 18px (16px en filas y badges, 22px en el input de código). Color heredado del texto.
- Mapa: Stock `package` · Ventas `shopping-cart` · Estadísticas `chart-column` · Nuevo `plus` · Cargar stock `package-plus` · Editar `pencil` · Quitar `x` · Más `ellipsis-vertical` · Buscar `search` · Código `scan-barcode` · Alerta `triangle-alert` · Stock bajo `arrow-down` · Error `circle-alert` · General `receipt` · Efectivo `banknote` · Débito/Crédito `credit-card` · Transferencia `arrow-left-right` · Otros `wallet` · Vuelto `hand-coins` · Exacto `equal` · Subas `trending-up` · Bajas `trending-down` · Proveedor `building-2` · Selector `chevrons-up-down`.

## Logo

- En el header: `factor-integral-horizontal-oscuro.png` sobre `surface-header`, 30px de alto, a la izquierda. Ícono cuadrado para el .ico de la app e instalador.
- Los archivos son recortes del tablero de marca; reemplazar por los SVG originales. Nunca redibujar la "∫".

## Layout

- Ventana mínima 1280×720; diseño de referencia 1366×768 y escala hasta 1920×1080 (contenido fluido, sin ancho máximo en tablas; formularios en modales de ancho fijo).
- Estructura fija: header 60px + página con padding 24px. En Ventas, el panel de pago es sticky abajo y el carrito scrollea.
- Navegación por secciones sin sub-rutas; las sub-vistas (Productos/Movimientos, Nueva venta/Historial) son segmentados dentro de la pantalla.

## Componentes y pantallas

Componentes en `components/` con su guía y preview: Button, Kbd, Input, BarcodeInput, Picker, Table, Badge, Segmented, AppHeader, ExpiryAlert, Modal, Alert (inline y toast), States, Cart, ChangeIndicator, PaymentPanel, StatCard, Ranking.
Pantallas completas (grupo **Pantallas**): ScreenStock, ScreenStockMovements, ScreenProductNew, ScreenProductEdit, ScreenLoadStock, ScreenSales, ScreenSalesSearch (F2), ScreenSalesGeneral (F10), ScreenSalesHistory, ScreenStats, ScreenExpiry.
Las clases CSS (`ig-…`) están en `components/bundle.css`; las props sugeridas para React en `components/index.d.ts`.
