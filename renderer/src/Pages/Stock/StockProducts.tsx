import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CircleAlert,
  EllipsisVertical,
  History,
  ListFilter,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  TriangleAlert,
} from 'lucide-react'
import LotsList from '../../Components/LotsList/LotsList'
import type { ProductFromApi, StockMovementFromApi } from '../../electron-api'
import type { Navigate } from '../../navigation'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { InlineAlert } from '../../ui/InlineAlert'
import { MenuButton } from '../../ui/MenuButton'
import { openModalCount } from '../../ui/modalStack'
import { ShortcutBar } from '../../ui/ShortcutBar'
import { TableSkeleton } from '../../ui/TableSkeleton'
import { useToast } from '../../ui/Toast'
import { useDelayedFlag } from '../../ui/useDelayedFlag'
import { useFlash } from '../../ui/useFlash'
import { useRowNavigation } from '../../ui/useRowNavigation'
import { isEditableTarget, scrollIntoViewSafe } from '../../utils/dom'
import { formatInt, formatMoney } from '../../utils/format'
import { groupLotsByProduct } from '../../utils/lots'
import { stockTone } from '../../utils/stock'
import SearchPopup from '../Sells/SearchPopup'
import LoadStockModal from './LoadStockModal'
import ProductFormModal from './ProductFormModal'
import { filterProducts, sortProducts } from './productFilters'
import type { ProductSort, ProductSortKey } from './productFilters'

type Props = {
  /** Segmentado Productos | Movimientos que arma `StockPage`. */
  viewSwitcher: React.ReactNode
  navigate: Navigate
}

/** Qué modal está abierto (uno a la vez). */
type ModalState =
  | { kind: 'none' }
  | { kind: 'create'; initial?: { name?: string; barcode?: string } }
  | { kind: 'edit'; product: ProductFromApi }
  | { kind: 'load'; product?: ProductFromApi }
  | { kind: 'search' }

/** "1 producto" / "3 productos". */
const countLabel = (n: number): string => `${n} ${n === 1 ? 'producto' : 'productos'}`

/**
 * Stock › Productos: tabla de productos con filtros, orden, alertas de stock, edición y carga de stock.
 *
 * Teclado: la tabla es un único tab-stop (↑/↓/Home/End mueven la fila, Enter edita). Atajos de la vista:
 * F2 buscar (popup), Ctrl+N nuevo, Ctrl+L cargar stock, Ctrl+F buscador de la tabla; un dígito suelto
 * (un escaneo) lleva el foco al buscador para filtrar por código.
 */
export default function StockProducts({ viewSwitcher, navigate }: Props) {
  const toast = useToast()

  // ── Datos ────────────────────────────────────────────────────────────────
  const [products, setProducts] = useState<ProductFromApi[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [lotsByProduct, setLotsByProduct] = useState<Map<number, StockMovementFromApi[]>>(new Map())

  // ── Vista ────────────────────────────────────────────────────────────────
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [onlyLow, setOnlyLow] = useState(false)
  const [showLots, setShowLots] = useState(false)
  const [sort, setSort] = useState<ProductSort>({ key: 'name', dir: 'asc' })
  const [activeId, setActiveId] = useState<number | null>(null)
  const [modal, setModal] = useState<ModalState>({ kind: 'none' })
  const [flashId, flash] = useFlash<number>()

  const searchRef = useRef<HTMLInputElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const reload = () => setReloadKey((k) => k + 1)
  const closeModal = () => setModal({ kind: 'none' })

  // ── Carga de productos ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(false)
      try {
        const data = await window.api.listProducts({ take: 5000 })
        if (!cancelled) setProducts(data)
      } catch (e) {
        console.error(e)
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // Lotes: solo se piden cuando el usuario enciende la columna Vencimientos.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!showLots || products.length === 0) {
        setLotsByProduct(new Map())
        return
      }
      try {
        const lots = await window.api.listLotsByProductIds(products.map((p) => p.id))
        if (!cancelled) setLotsByProduct(groupLotsByProduct(lots))
      } catch {
        if (!cancelled) setLotsByProduct(new Map())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showLots, products])

  // ── Derivados ────────────────────────────────────────────────────────────
  const categories = useMemo(() => {
    const byId = new Map<number, string>()
    for (const p of products) byId.set(p.category.id, p.category.name)
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
  }, [products])

  const visible = useMemo(
    () => sortProducts(filterProducts(products, { query, categoryId, onlyLow }), sort),
    [products, query, categoryId, onlyLow, sort],
  )

  const negatives = useMemo(() => products.filter((p) => stockTone(p) === 'negative'), [products])
  const lows = useMemo(() => products.filter((p) => stockTone(p) === 'low'), [products])
  const visibleNegatives = visible.filter((p) => stockTone(p) === 'negative').length
  const visibleLows = visible.filter((p) => stockTone(p) === 'low').length

  const showSkeleton = useDelayedFlag(loading && products.length === 0)
  const selectedCategoryName = categories.find((c) => c.id === categoryId)?.name

  // ── Acciones ─────────────────────────────────────────────────────────────
  const openCreate = (initial?: { name?: string; barcode?: string }) => setModal({ kind: 'create', initial })
  const openLoad = (product?: ProductFromApi) => setModal({ kind: 'load', product })
  const openEdit = (product: ProductFromApi) => setModal({ kind: 'edit', product })

  /** Guardado exitoso (alta, edición o carga): cierra, recarga y resalta la fila afectada. */
  function handleSaved(productId: number) {
    closeModal()
    reload()
    setActiveId(productId)
    flash(productId)
  }

  function toggleSort(key: ProductSortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  const onGridKeyDown = useRowNavigation({
    keys: visible.map((p) => p.id),
    activeKey: activeId,
    setActiveKey: setActiveId,
    onActivate: (id) => {
      const p = visible.find((x) => x.id === id)
      if (p) openEdit(p)
    },
    rowDomId: (id) => `stock-row-${id}`,
  })

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const q = query.trim()
    if (e.key === 'Enter' && /^\d+$/.test(q)) {
      // Escaneo: se selecciona la fila del código exacto.
      e.preventDefault()
      const found = products.find((p) => p.barcode?.toString() === q)
      if (found) {
        setActiveId(found.id)
        scrollIntoViewSafe(document.getElementById(`stock-row-${found.id}`))
      } else {
        toast.show({ tone: 'danger', title: 'Producto no encontrado', detail: `Código ${q}` })
      }
    } else if (e.key === 'ArrowDown') {
      // Del buscador a la tabla.
      e.preventDefault()
      gridRef.current?.focus()
      if (activeId === null && visible.length > 0) setActiveId(visible[0].id)
    } else if (e.key === 'Escape' && query !== '') {
      e.preventDefault()
      setQuery('')
    }
  }

  // Tras recargar, la fila activa se trae a la vista.
  useEffect(() => {
    if (activeId !== null) scrollIntoViewSafe(document.getElementById(`stock-row-${activeId}`))
  }, [products, activeId])

  // ── Atajos de la vista ───────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        // Con otro modal encima no se hace nada; con el propio buscador abierto, F2 lo cierra.
        if (openModalCount() > (modal.kind === 'search' ? 1 : 0)) return
        setModal((m) => (m.kind === 'search' ? { kind: 'none' } : { kind: 'search' }))
        return
      }
      if (openModalCount() > 0) return

      if (e.ctrlKey && !e.altKey && !e.metaKey) {
        const key = e.key.toLowerCase()
        if (key === 'n') {
          e.preventDefault()
          setModal({ kind: 'create' })
        } else if (key === 'l') {
          e.preventDefault()
          setModal({ kind: 'load' })
        } else if (key === 'f') {
          e.preventDefault()
          searchRef.current?.focus()
          searchRef.current?.select()
        }
        return
      }

      // Un dígito suelto es un escaneo: va al buscador para filtrar por código.
      if (/^\d$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey && !isEditableTarget(e.target)) {
        setQuery('')
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modal.kind])

  // ── Render ───────────────────────────────────────────────────────────────
  const sortArrow = (key: ProductSortKey) =>
    sort.key === key ? (
      sort.dir === 'asc' ? (
        <ArrowUp size={14} strokeWidth={2} aria-hidden="true" className="ig-icon" />
      ) : (
        <ArrowDown size={14} strokeWidth={2} aria-hidden="true" className="ig-icon" />
      )
    ) : null
  const ariaSort = (key: ProductSortKey): 'ascending' | 'descending' | 'none' =>
    sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'

  const columnCount = showLots ? 8 : 7
  const emptyBase = !loading && !error && products.length === 0

  return (
    <main className="ig-page">
      <div className="ig-page-head">
        <h1>Stock</h1>
        {viewSwitcher}
        <div className="ig-spacer" />
        <Button size="sm" variant="ghost" icon={Search} shortcut="F2" onClick={() => setModal({ kind: 'search' })}>
          Buscar
        </Button>
        <Button variant="secondary" icon={PackagePlus} onClick={() => openLoad()}>
          Cargar stock
        </Button>
        <Button variant="primary" icon={Plus} onClick={() => openCreate()}>
          Nuevo producto
        </Button>
      </div>

      <div className="ig-toolbar">
        <div className="ig-input-wrap" style={{ width: 380 }}>
          <Search className="ig-icon" size={18} aria-hidden="true" />
          <input
            ref={searchRef}
            className="ig-input"
            placeholder="Buscar por nombre o código (Ctrl+F)"
            aria-label="Buscar productos"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKeyDown}
          />
        </div>
        <MenuButton
          label="Filtrar por categoría"
          buttonText={`Categoría: ${selectedCategoryName ?? 'Todas'}`}
          icon={ListFilter}
          size="sm"
          items={[
            { id: 'all', label: 'Todas', checked: categoryId === null, onSelect: () => setCategoryId(null) },
            ...categories.map((c) => ({
              id: String(c.id),
              label: c.name,
              checked: categoryId === c.id,
              onSelect: () => setCategoryId(c.id),
            })),
          ]}
        />
        <Button size="sm" variant="secondary" icon={ArrowDown} aria-pressed={onlyLow} onClick={() => setOnlyLow((v) => !v)}>
          Solo stock bajo
        </Button>
        <Button size="sm" variant="secondary" icon={CalendarClock} aria-pressed={showLots} onClick={() => setShowLots((v) => !v)}>
          Vencimientos
        </Button>
        <div style={{ flex: 1 }} />
        <span className="ig-help">{countLabel(visible.length)}</span>
      </div>

      {negatives.length > 0 && (
        <InlineAlert
          tone="danger"
          title={
            negatives.length === 1
              ? 'Hay 1 producto con stock negativo'
              : `Hay ${negatives.length} productos con stock negativo`
          }
          action={
            <Button size="sm" icon={PackagePlus} onClick={() => openLoad(negatives[0])}>
              Cargar stock
            </Button>
          }
        >
          {negatives.length === 1
            ? `«${negatives[0].name}» tiene ${formatInt(negatives[0].stock)} unidades. Revisá las ventas o cargá stock.`
            : 'Revisá las ventas o cargá stock.'}
        </InlineAlert>
      )}

      {lows.length > 0 && !onlyLow && (
        <InlineAlert
          tone="warning"
          title={`${countLabel(lows.length)} por debajo del stock mínimo`}
          action={
            <Button size="sm" onClick={() => setOnlyLow(true)}>
              Filtrar
            </Button>
          }
        />
      )}

      {showSkeleton && <TableSkeleton rows={8} cols={4} label="Cargando productos…" />}

      {error && (
        <div className="ig-card">
          <EmptyState
            tone="danger"
            icon={CircleAlert}
            title="No pudimos leer los productos"
            description="Revisá que la base de datos esté disponible y probá de nuevo."
            action={
              <Button icon={RotateCcw} onClick={reload}>
                Reintentar
              </Button>
            }
          />
        </div>
      )}

      {emptyBase && (
        <div className="ig-card">
          <EmptyState
            icon={Package}
            title="Todavía no hay productos"
            description="Cargá el primero para empezar a vender."
            action={
              <Button variant="primary" icon={Plus} onClick={() => openCreate()}>
                Nuevo producto
              </Button>
            }
          />
        </div>
      )}

      {!error && products.length > 0 && (
        <div
          ref={gridRef}
          className="ig-table-wrap ig-grid"
          style={{ flex: 1, overflow: 'auto' }}
          tabIndex={0}
          role="grid"
          aria-label="Productos"
          aria-activedescendant={activeId !== null ? `stock-row-${activeId}` : undefined}
          onKeyDown={(e) => {
            // Las teclas de los botones de cada fila no deben mover la selección.
            if (e.target !== e.currentTarget) return
            onGridKeyDown(e)
          }}
        >
          <table className="ig-table">
            <thead>
              <tr>
                <th>Código de barras</th>
                <th aria-sort={ariaSort('name')}>
                  <button type="button" className="ig-th-sort" onClick={() => toggleSort('name')}>
                    Nombre {sortArrow('name')}
                  </button>
                </th>
                <th className="r" aria-sort={ariaSort('salePrice')}>
                  <button type="button" className="ig-th-sort" onClick={() => toggleSort('salePrice')}>
                    Precio {sortArrow('salePrice')}
                  </button>
                </th>
                <th className="r" aria-sort={ariaSort('stock')}>
                  <button type="button" className="ig-th-sort" onClick={() => toggleSort('stock')}>
                    Stock {sortArrow('stock')}
                  </button>
                </th>
                <th className="r">Stock mín.</th>
                <th>Categoría / Proveedor</th>
                {showLots && <th>Vencimientos</th>}
                <th className="actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={columnCount} className="c ig-muted">
                    {query.trim() !== '' ? `No encontramos «${query.trim()}»` : 'Ningún producto coincide con los filtros'}
                  </td>
                </tr>
              )}
              {visible.map((p) => {
                const tone = stockTone(p)
                const selected = activeId === p.id
                return (
                  // El teclado de la fila lo maneja el contenedor (role="grid"); la fila acepta click y doble click.
                  <tr
                    key={p.id}
                    id={`stock-row-${p.id}`}
                    className={[selected && 'is-selected', flashId === p.id && 'ig-row-flash'].filter(Boolean).join(' ') || undefined}
                    aria-selected={selected}
                    onClick={() => setActiveId(p.id)}
                    onDoubleClick={() => openEdit(p)}
                  >
                    <td className="code">{p.barcode === null ? '—' : p.barcode.toString()}</td>
                    <td className="name">{p.name}</td>
                    <td className="r">{formatMoney(p.salePrice)}</td>
                    {tone === 'negative' ? (
                      <td className="r is-negative">
                        <span className="ig-stock">
                          <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" className="ig-icon ig-icon-sm" />
                          {formatInt(p.stock)}
                        </span>
                      </td>
                    ) : tone === 'low' ? (
                      <td className="r is-low">
                        <span className="ig-stock">
                          <ArrowDown size={16} strokeWidth={2} aria-hidden="true" className="ig-icon ig-icon-sm" />
                          {formatInt(p.stock)}
                        </span>
                      </td>
                    ) : (
                      <td className="r">{formatInt(p.stock)}</td>
                    )}
                    <td className="r ig-muted">{formatInt(p.minStock)}</td>
                    <td>
                      {p.category.name}
                      <div className="ig-sub">{p.supplier.name}</div>
                    </td>
                    {showLots && (
                      <td>
                        <LotsList lots={lotsByProduct.get(p.id) ?? []} />
                      </td>
                    )}
                    <td className="actions">
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Button
                          variant="edit"
                          size="sm"
                          icon={Pencil}
                          aria-label={`Editar ${p.name}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            openEdit(p)
                          }}
                        >
                          Editar
                        </Button>
                        <MenuButton
                          iconOnly
                          icon={EllipsisVertical}
                          label={`Más acciones para ${p.name}`}
                          variant="ghost"
                          size="sm"
                          align="right"
                          items={[
                            {
                              id: 'movements',
                              label: 'Ver movimientos',
                              icon: History,
                              onSelect: () =>
                                navigate({ stockView: 'movements', movementsProduct: { id: p.id, name: p.name } }),
                            },
                            {
                              id: 'load',
                              label: 'Cargar stock de este producto',
                              icon: PackagePlus,
                              onSelect: () => openLoad(p),
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="ig-table-foot">
            <span>
              {countLabel(visible.length)}
              {visibleNegatives > 0 && (
                <>
                  {' · '}
                  <b style={{ color: 'var(--danger)' }}>{visibleNegatives} con stock negativo</b>
                </>
              )}
              {visibleLows > 0 && (
                <>
                  {' · '}
                  <b style={{ color: 'var(--warning)' }}>{visibleLows} con stock bajo</b>
                </>
              )}
            </span>
            <ShortcutBar
              items={[
                { keys: ['↑', '↓'], label: 'Moverse' },
                { keys: ['Enter'], label: 'Editar' },
                { keys: ['Ctrl', 'N'], label: 'Nuevo' },
                { keys: ['Ctrl', 'L'], label: 'Cargar stock' },
              ]}
            />
          </div>
        </div>
      )}

      <ProductFormModal
        open={modal.kind === 'create'}
        initialValues={modal.kind === 'create' ? modal.initial : undefined}
        onClose={closeModal}
        onSuccess={(p) => handleSaved(p.id)}
      />

      <ProductFormModal
        open={modal.kind === 'edit'}
        product={modal.kind === 'edit' ? modal.product : undefined}
        onClose={closeModal}
        onSuccess={(p) => handleSaved(p.id)}
      />

      <LoadStockModal
        open={modal.kind === 'load'}
        initialProduct={modal.kind === 'load' ? modal.product : undefined}
        onClose={closeModal}
        onSuccess={handleSaved}
        onRequestCreate={(q) => openCreate(/^\d+$/.test(q) ? { barcode: q } : { name: q })}
      />

      <SearchPopup
        open={modal.kind === 'search'}
        // SearchPopup llama onSelect y después onClose: el cierre no debe pisar el modal de edición que abre onSelect.
        onClose={() => setModal((m) => (m.kind === 'search' ? { kind: 'none' } : m))}
        onSelect={(product) => openEdit(product)}
        allowNumericEnter
        showExpiry
      />
    </main>
  )
}
