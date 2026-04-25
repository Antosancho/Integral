# Plan: Total del carrito + input de descuento/recargo

## Objetivo

Agregar al pie del carrito:
1. **Subtotal**: suma de todos los `lineTotal` de las filas.
2. **Input de descuento/recargo**: campo numérico (%) en la esquina derecha. Positivo = descuento. Negativo = recargo.
3. **Total final**: subtotal aplicando el porcentaje.

---

## Análisis del estado actual

- [renderer/src/Pages/Sells/CartList.tsx](renderer/src/Pages/Sells/CartList.tsx) — renderiza las filas del carrito. El total por fila ya existe con `lineTotal(line)`. El componente recibe `lines`, no conoce descuentos.
- [renderer/src/Pages/Sells/cartReducer.ts](renderer/src/Pages/Sells/cartReducer.ts) — `lineTotal(line)` ya existe y es la función que suma `unitPrice * quantity`.
- [renderer/src/Pages/Sells/Sells.tsx](renderer/src/Pages/Sells/Sells.tsx) — monta `CartList`, maneja el estado del carrito. Es el lugar correcto para mantener el estado del descuento (es un estado de la sesión de venta, no del carrito en sí).
- [renderer/src/Pages/Sells/Sells.css](renderer/src/Pages/Sells/Sells.css) — estilos actuales. El grid del carrito es `2fr 1fr 1fr 1fr auto`.
- [renderer/src/utils/format.ts](renderer/src/utils/format.ts) — ya existe `formatMoney`.

## Decisiones de diseño

1. El **estado del descuento** vive en `Sells.tsx` como `discountPct: number` (float, ej: `10` = 10%, `-5` = recargo 5%). Se inicializa en `0`.
2. El **subtotal** y el **total** se calculan en `Sells.tsx` (o pueden pasarse como props a `CartList`) — se opta por calcular en `Sells.tsx` y pasar como props a `CartList` para mantener `CartList` sin lógica de negocio extra.
3. El **input de descuento** vive dentro de `CartList` como control local (draft igual que los demás inputs) pero el valor confirmado se propaga al padre via una nueva prop `onDiscountChange`.
4. El pie del carrito (subtotal, descuento, total) se agrega como un bloque separado **debajo** del grid de filas, fuera del grid, para no romper el layout de columnas.
5. Si el carrito está vacío (`lines.length === 0`), el pie **no se muestra** (no tiene sentido mostrar $0 con descuento cuando no hay productos).
6. El `discountPct` admite decimales (ej: `2.5%`). Validación: debe ser un número finito. No tiene límite de rango (se puede aplicar 100% de descuento o 200% de recargo — es decisión del cajero).
7. El total final nunca puede ser negativo: `Math.max(0, subtotal * (1 - discountPct / 100))`.

## Archivos impactados

- [renderer/src/Pages/Sells/CartList.tsx](renderer/src/Pages/Sells/CartList.tsx) — agregar pie con subtotal/total y el input de descuento.
- [renderer/src/Pages/Sells/Sells.tsx](renderer/src/Pages/Sells/Sells.tsx) — agregar estado `discountPct`, pasar props nuevas a `CartList`.
- [renderer/src/Pages/Sells/Sells.css](renderer/src/Pages/Sells/Sells.css) — estilos del pie del carrito.
- [renderer/src/Pages/Sells/__tests__/CartList.test.tsx](renderer/src/Pages/Sells/__tests__/CartList.test.tsx) — agregar tests del pie (subtotal, total con descuento, input de descuento).

## Archivos que NO se tocan

- `cartReducer.ts` — `lineTotal` ya existe, no necesita cambios.
- `types.ts` — no cambia la estructura del carrito.
- `amount.ts`, `lineId.ts`, `BarcodeInput.tsx`, `SearchPopup.tsx`, `GeneralAmountPopup.tsx`.

---

## Principios para el modelo ejecutor

- Cambios **mínimos y acotados**: no refactorizar lo que ya funciona.
- Seguir el estilo ya presente: sin comentarios innecesarios, sin emojis, comillas simples, sin punto y coma.
- Correr `npm test` después de cada paso con cambios de lógica.
- No usar `any` en TypeScript.
- No hacer commit ni push.

---

## Pasos

### Paso 0 — Verificar estado inicial

0.1. Ejecutar desde `h:/anton/Integral/renderer`:
```
npm test
```
0.2. Confirmar que **todos los tests pasan** antes de empezar. Si algún test falla, reportar y detenerse.

---

### Paso 1 — Agregar prop `discountPct` y `onDiscountChange` a `CartList`

Archivo: [renderer/src/Pages/Sells/CartList.tsx](renderer/src/Pages/Sells/CartList.tsx)

**1.1.** Localizar el bloque `type Props` (líneas 3–11):
```tsx
type Props = {
  lines: CartLine[]
  onQuantityChange: (lineId: string, quantity: number) => void
  onUnitPriceChange: (lineId: string, unitPrice: string) => void
  onRemove: (lineId: string) => void
}
```

Reemplazarlo por:
```tsx
type Props = {
  lines: CartLine[]
  onQuantityChange: (lineId: string, quantity: number) => void
  onUnitPriceChange: (lineId: string, unitPrice: string) => void
  onRemove: (lineId: string) => void
  discountPct: number
  onDiscountChange: (pct: number) => void
}
```

**1.2.** Localizar la firma del componente (línea 13):
```tsx
export default function CartList({ lines, onQuantityChange, onUnitPriceChange, onRemove }: Props) {
```

Reemplazarla por:
```tsx
export default function CartList({ lines, onQuantityChange, onUnitPriceChange, onRemove, discountPct, onDiscountChange }: Props) {
```

**1.3.** Guardar. No correr tests todavía (el tipo en `Sells.tsx` todavía no pasa las props nuevas, el build va a fallar — se arregla en el paso 2).

---

### Paso 2 — Agregar estado `discountPct` en `Sells.tsx` y pasarlo a `CartList`

Archivo: [renderer/src/Pages/Sells/Sells.tsx](renderer/src/Pages/Sells/Sells.tsx)

**2.1.** Localizar la línea con los `useState` del componente (aprox. líneas 14–16):
```tsx
  const [popupOpen, setPopupOpen] = useState(false)
  const [generalPopupOpen, setGeneralPopupOpen] = useState(false)
  const [alert, setAlert] = useState<{ kind: AlertKind; text: string } | null>(null)
```

Agregar **debajo** de esas líneas:
```tsx
  const [discountPct, setDiscountPct] = useState(0)
```

**2.2.** Localizar el bloque `<CartList ... />` (aprox. líneas 133–138):
```tsx
      <CartList
        lines={cart.lines}
        onQuantityChange={(id, q) => dispatch({ type: 'SET_QUANTITY', lineId: id, quantity: q })}
        onUnitPriceChange={(id, p) => dispatch({ type: 'SET_UNIT_PRICE', lineId: id, unitPrice: p })}
        onRemove={(id) => dispatch({ type: 'REMOVE', lineId: id })}
      />
```

Reemplazarlo por:
```tsx
      <CartList
        lines={cart.lines}
        onQuantityChange={(id, q) => dispatch({ type: 'SET_QUANTITY', lineId: id, quantity: q })}
        onUnitPriceChange={(id, p) => dispatch({ type: 'SET_UNIT_PRICE', lineId: id, unitPrice: p })}
        onRemove={(id) => dispatch({ type: 'REMOVE', lineId: id })}
        discountPct={discountPct}
        onDiscountChange={setDiscountPct}
      />
```

**2.3.** Guardar.

**2.4.** Correr desde `h:/anton/Integral/renderer`:
```
npm run build
```
Debe compilar sin errores de TypeScript. Si hay errores, revisar los pasos 1 y 2.

---

### Paso 3 — Calcular subtotal y total en `CartList` y renderizar el pie

Archivo: [renderer/src/Pages/Sells/CartList.tsx](renderer/src/Pages/Sells/CartList.tsx)

**3.1.** Agregar el import de `lineTotal` si no está ya importado. La línea de imports actual en el archivo es:
```tsx
import { formatMoney } from '../../utils/format'
import { lineTotal } from './cartReducer'
import type { CartLine } from './types'
```
`lineTotal` ya está importado — no hay que cambiar nada en imports.

**3.2.** Localizar el bloque que maneja el caso vacío (aprox. línea 52):
```tsx
  if (lines.length === 0) {
    return <p className="cart-list__empty">Agregá productos con el lector o F2</p>
  }
```

Agregar **justo antes** de ese bloque (después de las funciones `commitUnitPrice` etc.) las siguientes variables:
```tsx
  const subtotal = lines.reduce((acc, line) => acc + lineTotal(line), 0)
  const discountFactor = 1 - discountPct / 100
  const total = Math.max(0, subtotal * discountFactor)
```

Nota: estas variables se calculan siempre, incluso si `lines` está vacío — está bien, simplemente van a ser `0`. El pie sólo se va a renderizar cuando `lines.length > 0` (ver paso 3.3).

**3.3.** Localizar el cierre del `return` del componente. El JSX actual termina en:
```tsx
    </div>
  )
}
```

Antes del `</div>` que cierra el `<div className="cart-list">`, hay que agregar el pie. El bloque que se debe agregar va **después del bloque del `.map()`** pero **dentro** del `<div className="cart-list">`.

Localizar el patrón exacto al final del return:
```tsx
      {lines.map(line => {
```
...y al final del map:
```tsx
      })}
    </div>
  )
}
```

Reemplazar el cierre del map y el div por:
```tsx
      })}

      <div className="cart-list__footer">
        <div className="cart-list__footer-row">
          <span className="cart-list__footer-label">Subtotal</span>
          <span className="cart-list__footer-value">{formatMoney(subtotal)}</span>
        </div>
        <div className="cart-list__footer-row">
          <span className="cart-list__footer-label">Descuento</span>
          <input
            className="cart-list__discount-input"
            type="number"
            step="0.01"
            value={discountPct}
            onChange={e => {
              const n = Number(e.target.value)
              if (Number.isFinite(n)) onDiscountChange(n)
            }}
          />
          <span className="cart-list__footer-pct">%</span>
        </div>
        <div className="cart-list__footer-row">
          <span className="cart-list__footer-label cart-list__footer-label--total">Total</span>
          <span className="cart-list__footer-value cart-list__footer-value--total">{formatMoney(total)}</span>
        </div>
      </div>
    </div>
  )
}
```

**3.4.** Guardar.

---

### Paso 4 — Agregar estilos del pie en `Sells.css`

Archivo: [renderer/src/Pages/Sells/Sells.css](renderer/src/Pages/Sells/Sells.css)

**4.1.** Al final del archivo, agregar:

```css
/* Cart footer (subtotal / descuento / total) */
.cart-list__footer {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 2px solid #dde5ee;
}

.cart-list__footer-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cart-list__footer-label {
  font-weight: 600;
  color: #374151;
  min-width: 90px;
  text-align: right;
}

.cart-list__footer-label--total {
  font-size: 1.05rem;
  color: #1e293b;
}

.cart-list__footer-value {
  min-width: 110px;
  text-align: right;
  color: #374151;
}

.cart-list__footer-value--total {
  font-size: 1.15rem;
  font-weight: 700;
  color: #1e293b;
}

.cart-list__discount-input {
  width: 70px;
  padding: 4px 6px;
  border: 1px solid #c0ccda;
  border-radius: 4px;
  font-size: 0.95rem;
  text-align: right;
}

.cart-list__footer-pct {
  color: #6b7280;
  font-size: 0.95rem;
}
```

**4.2.** Guardar.

---

### Paso 5 — Correr tests y build

**5.1.** Desde `h:/anton/Integral/renderer`:
```
npm test
```
Verificar que todos los tests previos siguen pasando (los nuevos tests se agregan en el paso 6).

**5.2.** Desde `h:/anton/Integral/renderer`:
```
npm run build
```
Verificar que no hay errores de tipos.

---

### Paso 6 — Escribir tests del pie: subtotal y total

Archivo: [renderer/src/Pages/Sells/__tests__/CartList.test.tsx](renderer/src/Pages/Sells/__tests__/CartList.test.tsx)

**6.1.** Actualizar la función auxiliar `renderCart` para incluir las nuevas props obligatorias. Localizar el bloque `renderCart` existente en el archivo:

```tsx
const renderCart = (lines: CartLine[], handlers: Partial<{
  onQuantityChange: (lineId: string, quantity: number) => void
  onUnitPriceChange: (lineId: string, unitPrice: string) => void
  onRemove: (lineId: string) => void
}> = {}) => {
  const onQuantityChange = handlers.onQuantityChange ?? vi.fn()
  const onUnitPriceChange = handlers.onUnitPriceChange ?? vi.fn()
  const onRemove = handlers.onRemove ?? vi.fn()
  const utils = render(
    <CartList
      lines={lines}
      onQuantityChange={onQuantityChange}
      onUnitPriceChange={onUnitPriceChange}
      onRemove={onRemove}
    />
  )
  return { ...utils, onQuantityChange, onUnitPriceChange, onRemove }
}
```

Reemplazarlo por:
```tsx
const renderCart = (lines: CartLine[], handlers: Partial<{
  onQuantityChange: (lineId: string, quantity: number) => void
  onUnitPriceChange: (lineId: string, unitPrice: string) => void
  onRemove: (lineId: string) => void
  onDiscountChange: (pct: number) => void
}> = {}, discountPct = 0) => {
  const onQuantityChange = handlers.onQuantityChange ?? vi.fn()
  const onUnitPriceChange = handlers.onUnitPriceChange ?? vi.fn()
  const onRemove = handlers.onRemove ?? vi.fn()
  const onDiscountChange = handlers.onDiscountChange ?? vi.fn()
  const utils = render(
    <CartList
      lines={lines}
      onQuantityChange={onQuantityChange}
      onUnitPriceChange={onUnitPriceChange}
      onRemove={onRemove}
      discountPct={discountPct}
      onDiscountChange={onDiscountChange}
    />
  )
  return { ...utils, onQuantityChange, onUnitPriceChange, onRemove, onDiscountChange }
}
```

**6.2.** Al final del archivo, agregar el siguiente bloque de tests:

```tsx
describe('CartList — pie de carrito: subtotal y total', () => {
  it('muestra el subtotal correcto con una línea', () => {
    // 2 unidades * $150 = $300
    renderCart([productLine(1, 2, '150')])
    expect(screen.getByText('Subtotal')).toBeInTheDocument()
    // formatMoney formatea en ARS — buscamos el valor formateado
    // lineTotal = 2 * 150 = 300
    expect(screen.getByText(/300/)).toBeInTheDocument()
  })

  it('muestra el subtotal correcto con múltiples líneas', () => {
    // línea 1: 1 * 100 = 100; línea 2: 3 * 50 = 150; total = 250
    renderCart([productLine(1, 1, '100'), productLine(2, 3, '50')])
    expect(screen.getByText(/250/)).toBeInTheDocument()
  })

  it('sin descuento (0%), Total == Subtotal', () => {
    renderCart([productLine(1, 1, '200')], {}, 0)
    const values = screen.getAllByText(/200/)
    // tanto subtotal como total muestran 200
    expect(values.length).toBeGreaterThanOrEqual(2)
  })

  it('con 10% de descuento, Total = Subtotal * 0.9', () => {
    // subtotal = 1 * 1000 = 1000; total = 1000 * 0.9 = 900
    renderCart([productLine(1, 1, '1000')], {}, 10)
    expect(screen.getByText(/900/)).toBeInTheDocument()
    expect(screen.getByText(/1000/)).toBeInTheDocument()
  })

  it('con recargo negativo (-20%), Total = Subtotal * 1.2', () => {
    // subtotal = 1 * 500 = 500; total = 500 * 1.2 = 600
    renderCart([productLine(1, 1, '500')], {}, -20)
    expect(screen.getByText(/600/)).toBeInTheDocument()
    expect(screen.getByText(/500/)).toBeInTheDocument()
  })

  it('el total nunca baja de 0 aunque el descuento supere el 100%', () => {
    // subtotal = 100; descuento = 200% → total = max(0, 100 * (1-2)) = 0
    renderCart([productLine(1, 1, '100')], {}, 200)
    expect(screen.getByText('Total')).toBeInTheDocument()
    // total = 0, formateado como $0 o $ 0
    expect(screen.getByText(/\$\s*0/)).toBeInTheDocument()
  })

  it('el pie no se muestra cuando el carrito está vacío', () => {
    renderCart([])
    expect(screen.queryByText('Subtotal')).not.toBeInTheDocument()
    expect(screen.queryByText('Total')).not.toBeInTheDocument()
  })
})
```

**6.3.** Guardar. Ejecutar:
```
npm test
```
Todos los tests del nuevo bloque deben pasar. Si alguno falla, revisar el cálculo en el paso 3.

---

### Paso 7 — Escribir tests del input de descuento

Seguir en el mismo archivo: [renderer/src/Pages/Sells/__tests__/CartList.test.tsx](renderer/src/Pages/Sells/__tests__/CartList.test.tsx)

**7.1.** Al final del archivo, agregar:

```tsx
describe('CartList — input de descuento', () => {
  it('el input muestra el valor de discountPct recibido por prop', () => {
    renderCart([productLine(1, 1, '100')], {}, 15)
    const input = screen.getByRole('spinbutton', { name: /descuento/i }) as HTMLInputElement
    expect(input.value).toBe('15')
  })

  it('cambiar el input a un número válido llama onDiscountChange con ese número', () => {
    const onDiscountChange = vi.fn()
    renderCart([productLine(1, 1, '100')], { onDiscountChange }, 0)
    const input = screen.getByRole('spinbutton', { name: /descuento/i }) as HTMLInputElement
    fireEvent.change(input, { target: { value: '25' } })
    expect(onDiscountChange).toHaveBeenCalledWith(25)
  })

  it('cambiar el input a un número negativo llama onDiscountChange con ese número negativo', () => {
    const onDiscountChange = vi.fn()
    renderCart([productLine(1, 1, '100')], { onDiscountChange }, 0)
    const input = screen.getByRole('spinbutton', { name: /descuento/i }) as HTMLInputElement
    fireEvent.change(input, { target: { value: '-10' } })
    expect(onDiscountChange).toHaveBeenCalledWith(-10)
  })

  it('cambiar el input a NaN (texto inválido) NO llama onDiscountChange', () => {
    const onDiscountChange = vi.fn()
    renderCart([productLine(1, 1, '100')], { onDiscountChange }, 0)
    const input = screen.getByRole('spinbutton', { name: /descuento/i }) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'abc' } })
    expect(onDiscountChange).not.toHaveBeenCalled()
  })
})
```

**Nota importante sobre el test que usa `{ name: /descuento/i }`:** Para que el selector por accesibilidad funcione, el input de descuento debe tener un `aria-label` o estar asociado a un `<label>`. En el paso 3.3 el JSX no incluyó `aria-label` — hay que corregirlo.

**7.2.** Corregir el input de descuento en [renderer/src/Pages/Sells/CartList.tsx](renderer/src/Pages/Sells/CartList.tsx).

Localizar el input de descuento (agregado en el paso 3.3):
```tsx
          <input
            className="cart-list__discount-input"
            type="number"
            step="0.01"
            value={discountPct}
            onChange={e => {
              const n = Number(e.target.value)
              if (Number.isFinite(n)) onDiscountChange(n)
            }}
          />
```

Reemplazarlo por:
```tsx
          <input
            className="cart-list__discount-input"
            type="number"
            step="0.01"
            aria-label="Descuento"
            value={discountPct}
            onChange={e => {
              const n = Number(e.target.value)
              if (Number.isFinite(n)) onDiscountChange(n)
            }}
          />
```

**7.3.** Guardar y ejecutar:
```
npm test
```
Todos los tests deben pasar.

---

### Paso 8 — Verificación final

**8.1.** Desde `h:/anton/Integral/renderer`:
```
npm test
npm run build
```
Ambos deben terminar sin errores.

**8.2.** Revisar el diff:
```
git status
git diff renderer/src/Pages/Sells/CartList.tsx
git diff renderer/src/Pages/Sells/Sells.tsx
git diff renderer/src/Pages/Sells/Sells.css
```

Archivos que este cambio debe tocar:
- Modified: `renderer/src/Pages/Sells/CartList.tsx`
- Modified: `renderer/src/Pages/Sells/Sells.tsx`
- Modified: `renderer/src/Pages/Sells/Sells.css`
- Modified: `renderer/src/Pages/Sells/__tests__/CartList.test.tsx`

---

### Paso 9 — Smoke test manual (si el ejecutor tiene acceso al entorno)

Desde la raíz del proyecto (`h:/anton/Integral`):
```
npm run dev
```

Pasos a reproducir:
1. Ir a la pestaña **Sells**.
2. Agregar 2 productos distintos con cantidades y precios distintos.
3. Verificar que el **Subtotal** muestra la suma correcta de todas las filas.
4. Sin descuento, verificar que el **Total** es igual al Subtotal.
5. Escribir `10` en el input de **Descuento** → verificar que el Total se actualiza a Subtotal × 0.9.
6. Escribir `-20` → verificar que el Total se actualiza a Subtotal × 1.2 (recargo).
7. Escribir `0` → verificar que Total = Subtotal.
8. Verificar que el pie está alineado a la derecha del carrito.
9. Vaciar el carrito (eliminar todos los productos) → verificar que el pie desaparece y aparece el mensaje "Agregá productos con el lector o F2".
10. Agregar un ítem General (F10) y verificar que también suma al Subtotal.

---

## Fuera de scope (NO hacer)

- No modificar el `cartReducer.ts`.
- No guardar el descuento en estado persistente (se resetea al navegar, coherente con la política del carrito).
- No agregar botones de "aplicar" — el descuento se aplica en tiempo real al cambiar el input.
- No bloquear valores extremos del descuento (> 100%) — es decisión del cajero.
- No hacer commit ni push.
