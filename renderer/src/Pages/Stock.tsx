import { useEffect, useState } from "react"
import type { ReactNode } from 'react'
import "./Stock.css"
import LotsList from "../Components/LotsList/LotsList"
import type { StockMovementFromApi } from "../electron-api"
import { formatMoney } from "../utils/format"
import { groupLotsByProduct } from "../utils/lots"
import ProductFormModal from './Stock/ProductFormModal'
import LoadStockModal from './Stock/LoadStockModal'
import SearchPopup from './Sells/SearchPopup'

type Product = Awaited<ReturnType<Window["api"]["listProducts"]>>[number]

/** Definición de columna para la grilla de productos. */
type Column = {
  key: string
  label: string
  render: (product: Product) => ReactNode
}

export default function Stock() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showLoadStockModal, setShowLoadStockModal] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  /** Producto seleccionado para edición; null cuando no hay ninguno abierto. */
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  /** Controla el buscador que abre productos directamente en modo edicion. */
  const [showSearchPopup, setShowSearchPopup] = useState(false)
  /** Toggle visual para mostrar/ocultar los lotes vivos por producto. */
  const [showExpiryColumn, setShowExpiryColumn] = useState(false)
  const [lotsByProduct, setLotsByProduct] = useState<Map<number, StockMovementFromApi[]>>(new Map())

  const columns: Column[] = [
    { key: "name", label: "Producto", render: (p) => p.name },
    { key: "salePrice", label: "Precio", render: (p) => formatMoney(p.salePrice) },
    { key: "stock", label: "Stock", render: (p) => String(p.stock) },
    { key: "category", label: "Categoria", render: (p) => p.category.name },
    {
      key: "barcode",
      label: "Codigo de barras",
      render: (p) => (p.barcode === null ? "-" : p.barcode.toString())
    },
    {
      key: "advanced",
      label: "Informacion avanzada",
      render: (p) => `Min: ${p.minStock} | Prov: ${p.supplier.name}`
    },
    ...(showExpiryColumn
      ? [
          {
            key: "expiry",
            label: "Vencimientos",
            render: (p: Product) => <LotsList lots={lotsByProduct.get(p.id) ?? []} />
          }
        ]
      : []),
    {
      key: 'actions',
      label: 'Acciones',
      render: (p) => (
        <button
          className="stock-grid__btn-edit"
          onClick={(e) => { e.stopPropagation(); setEditingProduct(p) }}
        >
          Editar
        </button>
      )
    }
  ]

  useEffect(() => {
    let cancelled = false

    async function loadProducts() {
      setLoading(true)
      setError(null)

      try {
        const data = await window.api.listProducts({ take: 100 })
        if (!cancelled) setProducts(data)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error loading products")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadProducts()

    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // Carga lotes en lote solo cuando el usuario habilita la columna.
  useEffect(() => {
    let cancelled = false

    async function loadLots() {
      if (!showExpiryColumn || products.length === 0) {
        setLotsByProduct(new Map())
        return
      }

      try {
        const lots = await window.api.listLotsByProductIds(products.map((product) => product.id))
        if (!cancelled) setLotsByProduct(groupLotsByProduct(lots))
      } catch {
        if (!cancelled) setLotsByProduct(new Map())
      }
    }

    loadLots()

    return () => {
      cancelled = true
    }
  }, [showExpiryColumn, products, reloadKey])

  /** F2 alterna el buscador de productos dentro de la pantalla Stock. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        setShowSearchPopup(prev => !prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="stock-page">
      <div className="stock-actions">
        <button className="stock-actions__btn-new" onClick={() => setShowCreateModal(true)}>+ Nuevo producto</button>
        <button className="stock-actions__btn-load" onClick={() => setShowLoadStockModal(true)}>Cargar stock</button>
        <button className="stock-actions__btn-search" onClick={() => setShowSearchPopup(true)}>Buscar (F2)</button>
        <button
          className="stock-actions__btn-expiry"
          onClick={() => setShowExpiryColumn((show) => !show)}
        >
          {showExpiryColumn ? 'Ocultar vencimientos' : 'Mostrar vencimientos'}
        </button>
      </div>
      <div className="stock-scroll-wrapper">
        <section className={`stock-grid${showExpiryColumn ? ' stock-grid--with-expiry' : ''}`}>
        {columns.map((column) => (
          <div key={column.key} className="stock-grid__header">
            {column.label}
          </div>
        ))}

        {loading && <div className="stock-grid__status">Cargando productos...</div>}
        {!loading && error && <div className="stock-grid__status stock-grid__status--error">{error}</div>}
        {!loading && !error && products.length === 0 && (
          <div className="stock-grid__status">No hay productos cargados.</div>
        )}

        {!loading &&
          !error &&
          products.map((product) =>
            columns.map((column) => (
              <div key={`${product.id}-${column.key}`} className="stock-grid__cell">
                {column.render(product)}
              </div>
            ))
          )}
        </section>
        </div>

      {/* Modal de creación de producto */}
      <ProductFormModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false)
          setReloadKey((k) => k + 1)
        }}
      />

      {/* Modal de edición de producto — se abre al hacer clic en "Editar" */}
      <ProductFormModal
        open={!!editingProduct}
        product={editingProduct ?? undefined}
        onClose={() => setEditingProduct(null)}
        onSuccess={() => {
          setEditingProduct(null)
          setReloadKey((k) => k + 1)
        }}
      />

      <LoadStockModal
        open={showLoadStockModal}
        onClose={() => setShowLoadStockModal(false)}
        onSuccess={() => {
          setShowLoadStockModal(false)
          setReloadKey((k) => k + 1)
        }}
      />

      <SearchPopup
        open={showSearchPopup}
        onClose={() => setShowSearchPopup(false)}
        onSelect={(product) => {
          setShowSearchPopup(false)
          setEditingProduct(product)
        }}
        allowNumericEnter={true}
        showExpiry={true}
      />
    </div>
  )
}
