# Guía de implementación (para la AI / dev)

Cómo llevar este sistema al proyecto real **Electron + React + TypeScript**. Seguir en orden.

## 1. Tokens y estilos

1. Copiar `tokens.css` (variables CSS + `@font-face`) y `components/bundle.css` (clases `ig-…`) a `src/renderer/styles/`. Importarlos una vez en el entry del renderer, `tokens.css` primero.
2. Copiar `fonts/*.woff2` a `src/renderer/assets/fonts/` y ajustar las rutas de `@font-face`. Las fuentes van **embebidas** (la app debe funcionar sin internet). Alternativa: paquetes `@fontsource/plus-jakarta-sans`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`.
3. Tema: atributo en `<html data-theme="light|dark">`. Guardar la elección en la configuración local; default `light`.
4. Nunca hardcodear colores: siempre `var(--token)`. Si se usa Tailwind, mapear `theme.extend.colors` a las variables (`primary: 'var(--primary)'`, etc.).
5. Utilidad `.num` en todo número (tabular-nums).

## 2. Íconos

`npm i lucide-react`. Tamaño 18 (`size={18}`), `strokeWidth={2}`. Mapa de íconos en el README. Reemplazar los glifos ⚠ y ✕ del código actual por `TriangleAlert` y `X`.

## 3. Componentes React a crear

| Componente | Base CSS | Notas clave |
|---|---|---|
| `Button` | `ig-btn` + variante + tamaño | `variant`, `size`, `icon`, `shortcut` |
| `Kbd`, `ShortcutBar` | `ig-kbd`, `ig-shortcuts` | |
| `TextField`, `AmountField`, `IntegerField`, `DateField`, `BarcodeField` | `ig-field`, `ig-input` | Texto libre + `inputMode`; parseo es-AR |
| `EntityPicker` | `ig-picker`, `ig-picker-pop` | `items`, `onCreate(name, extra)` |
| `DataTable` | `ig-table-wrap`, `ig-table` | Navegación por flechas, fila activa |
| `Badge` | `ig-badge-*` | |
| `Segmented` | `ig-seg` | |
| `AppHeader`, `ExpiryAlert` | `ig-header`, `ig-expiry` | |
| `Modal` | `ig-overlay`, `ig-modal` | Focus trap, retorno de foco, Esc |
| `Toaster`, `InlineAlert` | `ig-toast`, `ig-alert` | `aria-live="polite"`, 4–6 s |
| `EmptyState`, `Skeleton` | `ig-empty`, `ig-skel` | Skeleton con delay 300 ms |
| `BarcodeInput` | `ig-scan` | Hogar del foco en Ventas |
| `CartTable`, `EditableCell` | `ig-cart`, `ig-cell-edit` | Commit en Enter/blur, Esc descarta, inválido restaura |
| `PaymentPanel`, `ChangeIndicator` | `ig-pay`, `ig-change` | Sticky abajo |
| `StatCard`, `RankingList` | `ig-kpi`, `ig-rank` | |

Las props sugeridas están en `components/index.d.ts`.

## 4. Utilidades de formato (es-AR)

```ts
export const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
// ars.format(1234.5) → "$ 1.234,50"
export function parseDecimal(input: string): number | null {
  const s = input.trim().replace(/\s|\$/g, '');
  if (!s) return null;
  // "1.234,50" | "1234,50" | "1234.50" → 1234.5
  const norm = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}
export const pct = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
```
Formatear el monto **al salir** del input (blur), no mientras se tipea.

## 5. Lógica de Ventas (estado)

```ts
type Line = { id: string; productId: number | null; name: string; qty: number; unitPrice: number; listPrice?: number; stockWarning?: boolean; isGeneral?: boolean };
type Payments = Record<'efectivo'|'debito'|'credito'|'transferencia'|'otros', number>;
subtotal = Σ qty × unitPrice
total    = subtotal × (1 − descuento / 100)          // descuento ∈ [−200, 200]
pagado   = Σ payments
vuelto   = pagado − total                             // <0 falta · =0 exacto · >0 vuelto
puedeAprobar = lines.length > 0 && pagado >= total && !lines.some(l => l.isGeneral)
clickEtiqueta(m) → payments[m] += max(0, total − pagado)
```
Redondear a 2 decimales solo para mostrar y al guardar; comparar con tolerancia de 0,005.

Recomendación: mantener carrito, descuento y pagos en un store global (Zustand o Context) para que no se pierdan al cambiar de sección.

## 6. Checklist de aceptación

- [ ] Ninguna pantalla usa colores, tamaños o radios fuera de los tokens.
- [ ] Todo elemento interactivo muestra el anillo de foco al navegar con Tab.
- [ ] En Ventas se puede completar una venta entera sin tocar el mouse.
- [ ] Un escaneo con el foco fuera del input igual agrega el producto.
- [ ] Ningún input numérico tiene spinners; todos aceptan coma y punto.
- [ ] Los montos se ven `$ 1.234,50` y están alineados a la derecha con cifras tabulares.
- [ ] Las alertas de stock no impiden agregar; los toasts no roban el foco.
- [ ] APROBAR deshabilitado siempre muestra el motivo.
- [ ] Vuelto: los tres estados se distinguen por palabra e ícono, no solo color.
- [ ] Widget de vencimientos oculto si no hay alertas; "Recordame luego" vuelve al reabrir.
- [ ] Contraste verificado en tema Claro y Oscuro.
- [ ] Todas las vistas de datos tienen estado vacío, cargando y error.

## 7. Espacio reservado para el futuro

- **Roles:** a la izquierda del widget de vencimientos, chip de usuario (`ig-user`) con nombre y rol; acciones de admin (Eliminar, Anular) aparecen en menús ⋮ y en el detalle de Historial.
- **Fiado / cuenta corriente:** sexto medio de pago "CUENTA CORRIENTE" que pide elegir cliente con `EntityPicker`. La grilla de medios pasa a 6 columnas.
- **Ticket térmico:** botón "Imprimir" en el detalle de Historial y opción "Imprimir al aprobar" en configuración. Logo claro en el ticket.
- **Importar Excel/Sheets y Backup:** pantalla **Configuración** (ícono `settings` al extremo derecho del header) con secciones; no agregar más tabs principales.
