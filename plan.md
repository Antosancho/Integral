# Plan: Crear nuevo producto desde la pantalla Stock

## Contexto del trabajo
El backend IPC ya tiene `product:create`, `category:list`, `category:create`, `supplier:list`, `supplier:create` completamente implementados en `electron/ipcHandlers.ts` y `electron/ipcContract.ts`. No hay que tocar nada en `backend/` ni en `electron/`. Todo el trabajo es en el renderer.

**Campos del modelo Product y sus restricciones:**
- `name` — string, **obligatorio**
- `purchasePrice` — Decimal (IVA incluido), **obligatorio**, >= 0
- `salePrice` — Decimal (IVA incluido), **obligatorio**, >= 0
- `supplierId` — FK a Supplier, **obligatorio**
- `categoryId` — FK a Category, **obligatorio**
- `barcode` — BigInt único, **opcional** (si se ingresa: solo dígitos)
- `stock` — Int, **opcional** (default 0, debe ser entero >= 0)
- `minStock` — Int, **opcional** (default 0, debe ser entero >= 0)

**Archivos nuevos a crear:**
```
renderer/src/Pages/Stock/validateProductForm.ts
renderer/src/Pages/Stock/CategorySelector.tsx
renderer/src/Pages/Stock/SupplierSelector.tsx
renderer/src/Pages/Stock/CreateProductModal.tsx
renderer/src/Pages/Stock/CreateProductModal.css
renderer/src/Pages/Stock/__tests__/validateProductForm.test.ts
renderer/src/Pages/Stock/__tests__/CategorySelector.test.tsx
renderer/src/Pages/Stock/__tests__/SupplierSelector.test.tsx
renderer/src/Pages/Stock/__tests__/CreateProductModal.test.tsx
```

**Archivos existentes a modificar:**
```
renderer/src/Pages/Stock.tsx   — agregar botón y modal
renderer/src/Pages/Stock.css   — agregar estilos del botón
```

---

## Fase 1 — Lógica de validación pura

### Paso 1: Crear `renderer/src/Pages/Stock/validateProductForm.ts`

Exportar el tipo `ProductFormDraft` con todos los campos como strings (así se mapean directamente desde inputs HTML), excepto los IDs de relación que son number:
```ts
type ProductFormDraft = {
  name: string
  purchasePrice: string
  salePrice: string
  categoryId: number   // 0 = no seleccionado
  supplierId: number   // 0 = no seleccionado
  barcode: string      // vacío = no se carga
  stock: string        // vacío o "0"
  minStock: string     // vacío o "0"
}
```

Exportar el tipo `FormErrors` con las mismas claves, todas opcionales, tipo string:
```ts
type FormErrors = {
  name?: string
  purchasePrice?: string
  salePrice?: string
  categoryId?: string
  supplierId?: string
  barcode?: string
  stock?: string
  minStock?: string
}
```

Exportar la función auxiliar `normalizeDecimal(raw: string): string` que:
- Hace `.trim()`
- Reemplaza coma por punto (para soporte de es-AR)

Exportar la función principal `validateProductForm(draft: ProductFormDraft): FormErrors | null`:
- Si no hay errores: retornar `null`
- Si hay errores: retornar objeto `FormErrors` solo con las claves que fallaron

Reglas de validación por campo:
- `name`: `draft.name.trim()` → si vacío, error `"El nombre es obligatorio"`
- `purchasePrice`: llamar `normalizeDecimal` → si vacío, error `"El precio de compra es obligatorio"`. Luego parsear con `Number()`. Si `!Number.isFinite(n) || n < 0`, error `"Ingresá un precio válido (>= 0)"`
- `salePrice`: mismas reglas con mensajes equivalentes (reemplazar "compra" por "venta")
- `categoryId`: si es `0`, error `"Seleccioná una categoría"`
- `supplierId`: si es `0`, error `"Seleccioná un proveedor"`
- `barcode`: si el string tras `.trim()` NO está vacío Y NO matchea `/^\d+$/`, error `"El código de barras solo puede contener dígitos"`. Si tiene más de 20 caracteres, error `"Código de barras demasiado largo"`. (La unicidad la valida el backend.)
- `stock`: si el string tras `.trim()` NO está vacío → parsear con `Number()`. Si `!Number.isFinite(n) || !Number.isInteger(n) || n < 0`, error `"El stock debe ser un entero >= 0"`
- `minStock`: mismas reglas que stock con mensajes equivalentes

Si no hubo ningún error, retornar `null`. Si hubo al menos uno, retornar el objeto con las claves erróneas.

---

### Paso 2: Crear `renderer/src/Pages/Stock/__tests__/validateProductForm.test.ts`

Importar `validateProductForm` y el tipo `ProductFormDraft` de `../validateProductForm`.

Definir un helper `validDraft(): ProductFormDraft` que retorna un draft completamente válido:
- `name: 'Producto Test'`
- `purchasePrice: '50'`
- `salePrice: '100'`
- `categoryId: 1`
- `supplierId: 1`
- `barcode: ''`
- `stock: '0'`
- `minStock: '0'`

Escribir los siguientes tests dentro de `describe('validateProductForm')`:

1. **Draft válido mínimo** — `validDraft()` → retorna `null`.
2. **Draft válido con barcode numérico** — barcode `"7790001234567"` → retorna `null`.
3. **name vacío** — `name: ''` → retorna objeto con `name` definido.
4. **name solo espacios** — `name: '   '` → retorna objeto con `name` definido.
5. **purchasePrice vacío** — `purchasePrice: ''` → retorna objeto con `purchasePrice` definido.
6. **purchasePrice texto** — `purchasePrice: 'abc'` → retorna objeto con `purchasePrice` definido.
7. **purchasePrice negativo** — `purchasePrice: '-5'` → retorna objeto con `purchasePrice` definido.
8. **purchasePrice con coma decimal** — `purchasePrice: '10,50'` → retorna `null` (coma es válida, se normaliza).
9. **purchasePrice = "0"** — retorna `null` (cero es precio válido).
10. **salePrice vacío** — retorna objeto con `salePrice` definido.
11. **categoryId = 0** — retorna objeto con `categoryId` definido.
12. **supplierId = 0** — retorna objeto con `supplierId` definido.
13. **barcode con letras** — `barcode: 'abc123'` → retorna objeto con `barcode` definido.
14. **barcode solo dígitos** — `barcode: '1234567890'` → retorna `null`.
15. **barcode demasiado largo** — 21 dígitos → retorna objeto con `barcode` definido.
16. **stock no entero** — `stock: '1.5'` → retorna objeto con `stock` definido.
17. **stock negativo** — `stock: '-1'` → retorna objeto con `stock` definido.
18. **stock vacío** — `stock: ''` → retorna `null` (es opcional).
19. **stock = "0"** — retorna `null`.
20. **minStock no entero** — `minStock: '2.7'` → retorna objeto con `minStock` definido.
21. **Múltiples errores simultáneos** — `name: ''` y `categoryId: 0` → el objeto retornado tiene tanto `name` como `categoryId` definidos.
22. **Solo los campos erróneos están en el objeto** — draft válido con solo `salePrice: ''` → el objeto retornado tiene `salePrice` definido pero NO tiene `name`, `purchasePrice`, etc.

---

## Fase 2 — Selector de Categoría

### Paso 3: Crear `renderer/src/Pages/Stock/CategorySelector.tsx`

Importar `useState`, `useEffect` de React y `CategoryFromApi` de `../../electron-api`.

Props:
```ts
type Props = {
  value: number           // categoryId seleccionado; 0 = sin selección
  onChange: (id: number) => void
  error?: string          // mensaje de error que viene del form padre
}
```

Estado interno:
- `categories: CategoryFromApi[]` — lista cargada
- `loading: boolean` — true mientras carga
- `loadError: string | null` — error al cargar
- `mode: 'select' | 'create'` — 'select' es el estado normal
- `newName: string` — valor del input de nombre nuevo
- `creating: boolean` — true mientras se llama al API de creación
- `createError: string | null` — error al crear

Al montar (`useEffect` con array vacío `[]`): llamar `window.api.listCategories()`. Si resuelve, guardar en `categories` y `loading = false`. Si rechaza, guardar mensaje en `loadError` y `loading = false`.

**Render en modo `'select'`:**
- Si `loading`: mostrar `<p>Cargando categorías...</p>`
- Si `loadError`: mostrar `<p>{loadError}</p>`
- Si no: mostrar un `<select>` con `aria-label="Categoría"` y con:
  - Primera opción: `value="0"` → `"-- Seleccioná una categoría --"` (marcar como `disabled` si `value === 0` para que no sea re-seleccionable)
  - Una `<option>` por cada categoría: `value={String(cat.id)}` → `cat.name`
  - Última opción: `value="-1"` → `"+ Nueva categoría..."`
- El `value` del select debe ser `String(props.value)` y el `onChange` debe:
  - Si el value resultante es `"-1"`: setear `mode = 'create'`, resetear `newName = ''` y `createError = null`
  - Si no: llamar `props.onChange(parseInt(e.target.value))`
- Si hay `error` (prop): mostrar `<p className="selector-error">{error}</p>` debajo del select

**Render en modo `'create'`:**
- `<input type="text" value={newName} onChange={...} placeholder="Nombre de la categoría" />`
- `<button onClick={handleCreate} disabled={creating}>Crear</button>`
- `<button onClick={handleCancelCreate}>Cancelar</button>`
- Si `createError`: mostrar `<p className="selector-error">{createError}</p>`

`handleCancelCreate`:
- Setear `mode = 'select'`
- Llamar `props.onChange(0)` para que el padre sepa que no hay selección

`handleCreate` (async):
1. Si `newName.trim()` está vacío: `createError = "El nombre es obligatorio"`, return
2. Setear `creating = true`, `createError = null`
3. Llamar `await window.api.createCategory({ name: newName.trim() })`
4. Agregar la nueva categoría al estado `categories` (inmutable: `[...categories, nuevaCategoria]`)
5. Llamar `props.onChange(nuevaCategoria.id)`
6. Setear `mode = 'select'`
7. Si falla: setear `createError = error.message`, `creating = false`

---

### Paso 4: Crear `renderer/src/Pages/Stock/__tests__/CategorySelector.test.tsx`

Importar `render`, `screen`, `waitFor` de `@testing-library/react` y `userEvent` de `@testing-library/user-event`. Importar `CategorySelector` de `../CategorySelector`.

En `beforeEach`:
```ts
;(window as unknown as { api: unknown }).api = {
  listCategories: vi.fn(),
  createCategory: vi.fn()
}
```

Definir `mockCategories: CategoryFromApi[]` con dos categorías: `[{ id: 1, name: 'Lácteos' }, { id: 2, name: 'Bebidas' }]`.

Tests dentro de `describe('CategorySelector')`:

1. **Muestra "Cargando categorías..." mientras la promesa no resolvió** — `listCategories` devuelve una promesa que no se resuelve; verificar que el texto de carga aparece.

2. **Muestra las categorías cargadas en el select** — `listCategories.mockResolvedValue(mockCategories)`; `await waitFor(() => screen.getByRole('combobox'))`; verificar que las opciones "Lácteos" y "Bebidas" están presentes.

3. **Seleccionar una categoría llama onChange con el id correcto** — `listCategories.mockResolvedValue(mockCategories)`; esperar que cargue; simular selección de la opción con value "2"; verificar que `onChange` fue llamado con `2`.

4. **Seleccionar "+ Nueva categoría..." cambia a modo create** — simular selección del value "-1"; verificar que aparece un `<input>` de texto.

5. **Cancelar en modo create vuelve al select y llama onChange(0)** — entrar a modo create; click en "Cancelar"; verificar que el select vuelve a aparecer y que `onChange` fue llamado con `0`.

6. **Crear con nombre vacío muestra error, no llama createCategory** — entrar a modo create; dejar input vacío; click en "Crear"; verificar que aparece mensaje de error y que `createCategory` NO fue llamado.

7. **Crear categoría exitosa llama onChange con el nuevo id y vuelve al select** — `createCategory.mockResolvedValue({ id: 99, name: 'Nueva Cat' })`; entrar a modo create; escribir "Nueva Cat"; click en "Crear"; `await waitFor(...)`; verificar que `onChange` fue llamado con `99` y que el select vuelve a ser visible.

8. **Error del API al crear muestra el createError** — `createCategory.mockRejectedValue(new Error('DB error'))`; entrar a modo create; escribir nombre; click en "Crear"; `await waitFor(...)`; verificar que aparece "DB error" en el DOM.

9. **Prop error se muestra debajo del select** — pasar `error="Seleccioná una categoría"` como prop; verificar que ese texto aparece en el DOM.

---

## Fase 3 — Selector de Proveedor

### Paso 5: Crear `renderer/src/Pages/Stock/SupplierSelector.tsx`

Mismo patrón que `CategorySelector` con estas diferencias:

Props: igual pero para `supplierId` (el tipo y semántica es la misma).

Estado adicional para el formulario de creación:
- `newPhone: string` — opcional
- `newNotes: string` — opcional

En modo `'create'`, mostrar tres campos:
- Input `newName` — **obligatorio** (igual que en CategorySelector)
- Input `newPhone` — placeholder `"Teléfono (opcional)"`, `type="text"`
- Input `newNotes` — placeholder `"Notas (opcional)"`, `type="text"`

`handleCreate` al llamar al API:
```ts
await window.api.createSupplier({
  name: newName.trim(),
  phone: newPhone.trim() || null,
  notes: newNotes.trim() || null
})
```

El `<select>` en modo `'select'` debe tener `aria-label="Proveedor"` (en lugar de `"Categoría"`).

El resto es idéntico a `CategorySelector`.

---

### Paso 6: Crear `renderer/src/Pages/Stock/__tests__/SupplierSelector.test.tsx`

Misma estructura que `CategorySelector.test.tsx` mockeando `listSuppliers` y `createSupplier`.

`mockSuppliers`: `[{ id: 1, name: 'ProvA', phone: null, notes: null }, { id: 2, name: 'ProvB', phone: '1234', notes: null }]`.

Tests dentro de `describe('SupplierSelector')`:

1. **Muestra "Cargando..." mientras carga.**
2. **Muestra los proveedores cargados en el select.**
3. **Seleccionar un proveedor llama onChange con su id.**
4. **Seleccionar "+ Nuevo proveedor..." cambia a modo create.**
5. **Cancelar en modo create vuelve al select y llama onChange(0).**
6. **Crear con nombre vacío muestra error, no llama createSupplier.**
7. **Crear proveedor exitoso con solo nombre — phone y notes se envían como null** — `createSupplier.mockResolvedValue(...)`. Verificar que `createSupplier` fue llamado con `{ name: 'NuevoProv', phone: null, notes: null }`.
8. **Crear proveedor con todos los campos — phone y notes se envían correctamente** — escribir nombre, phone `"11-1234-5678"` y notes `"Mayorista"`. Verificar que `createSupplier` fue llamado con esos valores.
9. **Error del API al crear muestra createError.**
10. **Prop error se muestra debajo del select.**

---

## Fase 4 — Modal de creación de producto

### Paso 7: Crear `renderer/src/Pages/Stock/CreateProductModal.css`

Agregar los siguientes estilos (pueden coexistir con los de Sells porque usan clases distintas):

```css
.create-product-overlay {
  /* fondo oscuro, cubre toda la pantalla, z-index alto */
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.create-product-modal {
  background: white;
  border-radius: 8px;
  padding: 24px;
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.create-product-modal__title {
  margin: 0;
  font-size: 1.25rem;
}

.create-product-modal__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.create-product-modal__label {
  font-weight: 600;
  font-size: 0.875rem;
}

.create-product-modal__input {
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.95rem;
  width: 100%;
  box-sizing: border-box;
}

.create-product-modal__input--error {
  border-color: #ef4444;
}

.create-product-modal__field-error {
  color: #dc2626;
  font-size: 0.8rem;
}

.create-product-modal__api-error {
  color: #dc2626;
  font-weight: 600;
  font-size: 0.9rem;
  margin: 0;
}

.create-product-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}

.create-product-modal__btn-cancel {
  padding: 8px 16px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: white;
  cursor: pointer;
}

.create-product-modal__btn-submit {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: #3b82f6;
  color: white;
  cursor: pointer;
}

.create-product-modal__btn-submit:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}
```

---

### Paso 8: Crear `renderer/src/Pages/Stock/CreateProductModal.tsx`

**Imports necesarios:**
- `useState`, `useEffect` de `'react'`
- `type ProductFromApi` de `'../../electron-api'`
- `CategorySelector` de `'./CategorySelector'`
- `SupplierSelector` de `'./SupplierSelector'`
- `validateProductForm`, `normalizeDecimal`, tipos `ProductFormDraft`, `FormErrors` de `'./validateProductForm'`
- `'./CreateProductModal.css'`

**Props:**
```ts
type Props = {
  open: boolean
  onClose: () => void
  onSuccess: (product: ProductFromApi) => void
}
```

**Función `emptyDraft(): ProductFormDraft`** (fuera del componente, para poder reutilizarla):
```ts
function emptyDraft(): ProductFormDraft {
  return { name: '', purchasePrice: '', salePrice: '', categoryId: 0, supplierId: 0, barcode: '', stock: '0', minStock: '0' }
}
```

**Estado del componente:**
- `draft, setDraft` — inicializado con `emptyDraft()`
- `errors, setErrors` — tipo `FormErrors | null`, inicial `null`
- `submitting, setSubmitting` — tipo `boolean`, inicial `false`
- `apiError, setApiError` — tipo `string | null`, inicial `null`

**Reset al cerrar** — `useEffect` con `[open]`:
- Cuando `open` cambia a `false` (o sea, cuando `!open`): resetear `draft`, `errors`, `submitting`, `apiError` a sus valores iniciales.

**Listener de Escape** — `useEffect` con `[open, submitting]`:
- Si `!open`: no hacer nada (return vacío).
- Definir handler: `if (e.key === 'Escape' && !submitting) onClose()`.
- `document.addEventListener('keydown', handler)`.
- Cleanup: `document.removeEventListener('keydown', handler)`.

**Helper `updateField(field: keyof ProductFormDraft, value: string | number)`** — actualiza el draft y limpia el error de ese campo:
```ts
setDraft(d => ({ ...d, [field]: value }))
setErrors(e => e ? { ...e, [field]: undefined } : null)
```

**`handleSubmit` (async):**
1. `const errs = validateProductForm(draft)` — si no es null: `setErrors(errs)`, return.
2. Construir payload:
   - `name`: `draft.name.trim()`
   - `purchasePrice`: `normalizeDecimal(draft.purchasePrice)`
   - `salePrice`: `normalizeDecimal(draft.salePrice)`
   - `categoryId`: `draft.categoryId`
   - `supplierId`: `draft.supplierId`
   - `barcode`: `draft.barcode.trim() || null`
   - `stock`: `draft.stock.trim() === '' ? 0 : Number(draft.stock)`
   - `minStock`: `draft.minStock.trim() === '' ? 0 : Number(draft.minStock)`
3. `setSubmitting(true)`, `setApiError(null)`.
4. `try { const product = await window.api.createProduct(payload); onSuccess(product) }`
5. `catch (e) { setApiError(e instanceof Error ? e.message : 'Error al crear el producto'); setSubmitting(false) }`

**Render:**
- Si `!open`: `return null`

Estructura JSX:
```
<div className="create-product-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
  <div className="create-product-modal">
    <h2 className="create-product-modal__title">Nuevo producto</h2>

    [Campo Nombre]
    [Campo Precio de compra]
    [Campo Precio de venta]

    <div className="create-product-modal__field">
      <label className="create-product-modal__label">Categoría *</label>
      <CategorySelector value={draft.categoryId} onChange={id => updateField('categoryId', id)} error={errors?.categoryId} />
    </div>

    <div className="create-product-modal__field">
      <label className="create-product-modal__label">Proveedor *</label>
      <SupplierSelector value={draft.supplierId} onChange={id => updateField('supplierId', id)} error={errors?.supplierId} />
    </div>

    [Campo Código de barras — opcional]
    [Campo Stock inicial]
    [Campo Stock mínimo]

    {apiError && <p className="create-product-modal__api-error">{apiError}</p>}

    <div className="create-product-modal__actions">
      <button className="create-product-modal__btn-cancel" onClick={onClose} disabled={submitting}>Cancelar</button>
      <button className="create-product-modal__btn-submit" onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Creando...' : 'Crear producto'}
      </button>
    </div>
  </div>
</div>
```

Para cada campo de texto (nombre, precios, barcode, stock, minStock), la estructura es:
```tsx
<div className="create-product-modal__field">
  <label className="create-product-modal__label">{LABEL} {requerido ? '*' : '(opcional)'}</label>
  <input
    type="text"
    inputMode={para precios y stock: "decimal" o "numeric"}
    className={`create-product-modal__input${errors?.campo ? ' create-product-modal__input--error' : ''}`}
    value={draft.campo}
    onChange={e => updateField('campo', e.target.value)}
    placeholder={según campo}
  />
  {errors?.campo && <p className="create-product-modal__field-error">{errors.campo}</p>}
</div>
```

---

### Paso 9: Crear `renderer/src/Pages/Stock/__tests__/CreateProductModal.test.tsx`

Importar `render`, `screen`, `waitFor` de `@testing-library/react`, `userEvent` de `@testing-library/user-event`, `CreateProductModal` de `../CreateProductModal`.

**`beforeEach`** — setear `window.api` con todos los mocks necesarios:
```ts
;(window as unknown as { api: unknown }).api = {
  listCategories: vi.fn().mockResolvedValue([{ id: 1, name: 'CatTest' }]),
  listSuppliers: vi.fn().mockResolvedValue([{ id: 1, name: 'ProvTest', phone: null, notes: null }]),
  createProduct: vi.fn(),
  createCategory: vi.fn(),
  createSupplier: vi.fn()
}
```

**Helper `renderModal(props?)`** — renderiza el modal con `open=true` y props por defecto (onClose y onSuccess como `vi.fn()`). Retorna `{ onClose, onSuccess }` para poder hacer assertions.

**Helper `mockProduct(): ProductFromApi`** — objeto mínimo válido de ProductFromApi para usar como valor de retorno del mock de `createProduct`.

**Helper `fillMinimumValidForm(user)`** (async) — llena el formulario con valores válidos mínimos:
1. Escribir `"Producto Test"` en el input de nombre.
2. Escribir `"50"` en el input de precio de compra.
3. Escribir `"80"` en el input de precio de venta.
4. `await waitFor(() => screen.getAllByRole('combobox'))` — esperar que carguen los selects.
5. Seleccionar la categoría con id 1 usando `screen.getByRole('combobox', { name: /categoría/i })`.
6. Seleccionar el proveedor con id 1 usando `screen.getByRole('combobox', { name: /proveedor/i })`.

Tests dentro de `describe('CreateProductModal')`:

1. **open=false no renderiza nada** — `render(<CreateProductModal open={false} .../>)`; `expect(screen.queryByRole('heading')).toBeNull()`.

2. **open=true renderiza el título** — `await waitFor(() => screen.getByRole('heading', { name: 'Nuevo producto' }))`.

3. **Submit con name vacío muestra error y no llama createProduct** — `userEvent.setup()`; rellenar form sin el nombre; click en "Crear producto"; verificar que aparece el mensaje de error de nombre; verificar que `createProduct` no fue llamado.

4. **Submit con categoryId = 0 muestra error de categoría** — no seleccionar categoría; click en submit; verificar que el mensaje de error de categoría aparece en el DOM.

5. **Submit con supplierId = 0 muestra error de proveedor** — no seleccionar proveedor; click en submit; verificar error de proveedor.

6. **Submit con barcode no numérico muestra error de barcode** — escribir `"abc123"` en el campo de barcode; completar el resto del form; click en submit; verificar error de barcode.

7. **Submit completo válido (sin barcode) llama createProduct con payload correcto** —
   - `createProduct.mockResolvedValue(mockProduct())`
   - Llamar a `fillMinimumValidForm(user)`
   - Click en "Crear producto"
   - `await waitFor(() => expect(createProduct).toHaveBeenCalledWith({ name: 'Producto Test', purchasePrice: '50', salePrice: '80', categoryId: 1, supplierId: 1, barcode: null, stock: 0, minStock: 0 }))`
   - Verificar que `onSuccess` fue llamado
   - Verificar que `onClose` **no** fue llamado (el cierre lo maneja el padre via `onSuccess`)

8. **Precio con coma decimal se normaliza a punto** —
   - `createProduct.mockResolvedValue(mockProduct())`
   - Completar form con `purchasePrice = "10,50"`
   - Verificar que `createProduct` fue llamado con `purchasePrice: "10.50"`

9. **Submit con stock y minStock no vacíos — se pasan como enteros** —
   - Escribir "5" en stock y "2" en minStock
   - Completar el resto del form
   - `createProduct.mockResolvedValue(mockProduct())`
   - Verificar que `createProduct` fue llamado con `stock: 5` y `minStock: 2`

10. **Error del API (ej. barcode duplicado) muestra apiError sin cerrar el modal** —
    - `createProduct.mockRejectedValue(new Error('Unique constraint failed'))`
    - Completar form válido y submit
    - `await waitFor(() => screen.getByText('Unique constraint failed'))`
    - Verificar que el modal sigue abierto (el heading sigue visible)
    - Verificar que `onClose` NO fue llamado

11. **Botón Cancelar llama onClose sin llamar createProduct** —
    - Encontrar el botón "Cancelar" y hacer click
    - Verificar que `onClose` fue llamado y `createProduct` no

12. **Escape llama onClose cuando no está submitting** —
    - Disparar evento keydown Escape en el document
    - Verificar que `onClose` fue llamado

13. **Botón muestra "Creando..." mientras submitting** —
    - `createProduct` devuelve una promesa que nunca se resuelve: `vi.fn().mockReturnValue(new Promise(() => {}))`
    - Completar form y click en "Crear producto"
    - Verificar que el botón ahora dice "Creando..." y tiene `disabled`

14. **Al reabrir el modal, el formulario arranca limpio** —
    - `const { rerender } = render(<CreateProductModal open={true} .../>)`
    - Escribir algo en el nombre
    - `rerender(<CreateProductModal open={false} .../>`
    - `rerender(<CreateProductModal open={true} .../>`
    - Verificar que el input de nombre está vacío

---

## Fase 5 — Integración en Stock.tsx

### Paso 10: Modificar `renderer/src/Pages/Stock.tsx`

**Agregar el import al inicio del archivo:**
```ts
import CreateProductModal from './Stock/CreateProductModal'
```

**Agregar estado en el cuerpo del componente** (junto a los otros `useState`):
```ts
const [showCreateModal, setShowCreateModal] = useState(false)
const [reloadKey, setReloadKey] = useState(0)
```

**Agregar `reloadKey` como dependencia del `useEffect` existente** que carga los productos:
- El `useEffect` actual tiene `[]` como dependencias. Cambiarlo a `[reloadKey]`.
- Esto hace que cada vez que `reloadKey` incremente, la lista se recargue automáticamente.
- No cambiar la lógica interna del useEffect — solo agregar `reloadKey` al array de dependencias.

**Agregar la barra de acciones en el JSX**, justo antes de la apertura del `<section className="stock-grid">`:
```tsx
<div className="stock-actions">
  <button className="stock-actions__btn-new" onClick={() => setShowCreateModal(true)}>
    + Nuevo producto
  </button>
</div>
```

**Agregar el modal al final del JSX**, como último elemento dentro del fragmento o div contenedor (mismo nivel que `<div className="stock-actions">` y `<section className="stock-grid">`):
```tsx
<CreateProductModal
  open={showCreateModal}
  onClose={() => setShowCreateModal(false)}
  onSuccess={() => {
    setShowCreateModal(false)
    setReloadKey(k => k + 1)
  }}
/>
```

**Nota:** si el componente `Stock` actualmente retorna directamente el `<section>`, envolverlo en un fragmento `<>...</>` o un `<div>` para poder incluir los dos elementos adicionales.

---

### Paso 11: Modificar `renderer/src/Pages/Stock.css`

Agregar al final del archivo los estilos para la barra de acciones:

```css
.stock-actions {
  display: flex;
  justify-content: flex-end;
  padding: 8px 12px;
}

.stock-actions__btn-new {
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
}

.stock-actions__btn-new:hover {
  background: #2563eb;
}
```

---

## Checklist de verificación final

Después de implementar todos los pasos, verificar en orden:

- [ ] Todos los tests pasan: correr `npm test` (o `npx vitest`) en el directorio `renderer/`.
- [ ] TypeScript no tiene errores: correr `npx tsc --noEmit` en `renderer/`.
- [ ] La app arranca sin errores en consola.
- [ ] La pantalla Stock muestra el botón "+ Nuevo producto" en el extremo derecho.
- [ ] Click en el botón abre el modal con el título "Nuevo producto".
- [ ] El modal carga categorías y proveedores en sus selects respectivos.
- [ ] Intentar hacer submit con campos requeridos vacíos muestra errores inline debajo de cada campo.
- [ ] Con todos los campos válidos, submit crea el producto exitosamente.
- [ ] Después de crear, la lista de la tabla se actualiza mostrando el nuevo producto.
- [ ] El modal se cierra y, si se vuelve a abrir, el formulario está limpio.
- [ ] Escape cierra el modal.
- [ ] Click en el overlay oscuro cierra el modal.
- [ ] Dentro del modal, crear una nueva categoría funciona y la auto-selecciona.
- [ ] Dentro del modal, crear un nuevo proveedor funciona y lo auto-selecciona.
- [ ] Barcode con letras muestra error sin llegar al API.
- [ ] Si el backend rechaza (ej. barcode duplicado), el error se muestra dentro del modal sin cerrarlo.
