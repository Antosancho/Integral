# Reporte de bugs — Pantalla de Ventas

**Fecha:** 2026-04-25
**Rama:** main
**Archivos afectados:** `renderer/src/index.css`, `renderer/src/App.tsx`, `renderer/src/Pages/Sells/Sells.css`, `renderer/src/Pages/Sells/CartList.tsx`, `renderer/src/Pages/Sells/payments.ts`

---

## Bug 1 — El panel de pagos no queda fijo en la parte inferior

### Descripción
El `PaymentPanel` debería estar anclado al pie de la pantalla en todo momento, independientemente de cuántos productos haya en el carrito. En su estado actual, cuando el carrito está vacío, el panel de pagos sube y no queda pegado al fondo.

### Causa raíz
Dos problemas encadenados:

**1a)** En `renderer/src/index.css`, `#root` comparte regla con `html` y `body`:
```css
html, body, #root {
  height: 100%;
}
```
`#root` no tiene `display: flex`, por lo que no puede actuar como contenedor flex column. Sus hijos no pueden usar `flex: 1 1 auto` para distribuirse correctamente en la altura disponible.

**1b)** En `renderer/src/Pages/Sells/CartList.tsx` (líneas 52–54), cuando el carrito está vacío el componente hace un early return devolviendo un `<p>`:
```tsx
if (lines.length === 0) {
  return <p className="cart-list__empty">Agregá productos con el lector o F2</p>
}
```
Este `<p>` no tiene la clase `.cart-list` ni la propiedad `flex: 1 1 auto`. Como resultado, no ocupa el espacio disponible entre el input de barcode y el `PaymentPanel`, y el panel sube en lugar de quedar pegado al fondo.

---

## Bug 2 — El scrollbar aparece en toda la página en vez de solo en la lista de productos

### Descripción
Al agregar más productos de los que entran en pantalla, aparece un scrollbar que abarca toda la página (incluyendo el header y el panel de pagos). El scroll debería ocurrir únicamente dentro de la zona de la lista de productos.

### Causa raíz
La misma que el Bug 1a: `#root` no es un flex container, por lo que `section.sells` usa `height: 100%` que se resuelve como el 100% de `#root` (equivalente a `100vh`) **sin descontar la altura del header**. Esto hace que la sección Sells desborde el viewport, generando scroll en toda la página.

El CSS de `.cart-list` ya tiene `overflow-y: auto` y `flex: 1 1 auto` correctamente definidos. El problema es estructural: la jerarquía flex no está bien encadenada desde `#root` hasta `.cart-list`, por lo que el scroll interno nunca se activa.

---

## Bug 3 — La función de vuelto no muestra valores negativos (déficit)

### Descripción
Cuando la suma de los medios de pago es menor al total de la venta, el campo VUELTO muestra `$0` en lugar de mostrar el déficit como valor negativo. Por ejemplo: total `$10.000`, efectivo ingresado `$5.000` → VUELTO debería mostrar `-$5.000`, pero muestra `$0`.

Consecuencia secundaria: el botón **APROBAR VENTA** queda deshabilitado cuando el cliente paga con un billete mayor al total (caso normal en caja), porque la función `paymentsCoverTotal` exige coincidencia exacta (`±0.01`) y rechaza el exceso.

### Causa raíz
En `renderer/src/Pages/Sells/payments.ts`, la función `changeAmount` clampea el resultado a `0` cuando es negativo:

```ts
// líneas 51–55
export function changeAmount(state: PaymentsDraft, total: number): number {
  const sum = sumPayments(state)
  const change = sum - total
  return change > 0 ? change : 0   // ← clampeo incorrecto
}
```

Adicionalmente, `paymentsCoverTotal` (línea 63) usa `Math.abs`, lo que impide aprobar una venta cuando el cliente paga de más:

```ts
export function paymentsCoverTotal(state: PaymentsDraft, total: number): boolean {
  return Math.abs(sumPayments(state) - total) <= PAYMENT_EPSILON  // ← rechaza el exceso
}
```

---

## Solución planificada

Detallada en `plan.md`. Resumen:

| Bug | Archivos a modificar | Cambio |
|-----|---------------------|--------|
| 1 y 2 | `index.css`, `App.css`, `App.tsx`, `Sells.css`, `CartList.tsx` | Encadenar correctamente la jerarquía flex desde `#root` hasta `.cart-list`; siempre renderizar `<div class="cart-list">` |
| 3 | `payments.ts` | `changeAmount` retorna valor con signo; `paymentsCoverTotal` acepta `Σpagos ≥ total − 0.01` |
