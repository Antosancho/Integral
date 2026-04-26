import { useEffect, useMemo, useState } from "react"
import "./Stock.css"
import { formatMoney } from "../utils/format"
import CreateProductModal from './Stock/CreateProductModal'

type Product = Awaited<ReturnType<Window["api"]["listProducts"]>>[number]

type Column = {
  key: string
  label: string
  render: (product: Product) => string
}

export default function Stock() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const columns = useMemo<Column[]>(
    () => [
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
      }
    ],
    []
  )

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

  return (
    <>
      <div className="stock-actions">
        <button className="stock-actions__btn-new" onClick={() => setShowCreateModal(true)}>+ Nuevo producto</button>
      </div>
      <section className="stock-grid">
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

      <CreateProductModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false)
          setReloadKey((k) => k + 1)
        }}
      />
    </>
  )
}
