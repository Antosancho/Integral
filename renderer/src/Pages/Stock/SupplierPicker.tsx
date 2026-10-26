import { useEffect, useState } from 'react'
import type { SupplierFromApi } from '../../electron-api'
import { EntityPicker } from '../../ui/EntityPicker'

type Props = {
  id: string
  valueId: number
  onChange: (id: number) => void
  /** Error de validación del formulario (tiene prioridad sobre el de carga). */
  error?: string | null
  triggerRef?: React.Ref<HTMLButtonElement>
}

/**
 * Selector de proveedor con alta en el momento (con teléfono y notas opcionales).
 * Carga la lista con `window.api.listSuppliers()` al montar y agrega a su lista local cada proveedor creado.
 */
export default function SupplierPicker({ id, valueId, onChange, error, triggerRef }: Props) {
  const [suppliers, setSuppliers] = useState<SupplierFromApi[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await window.api.listSuppliers()
        if (!cancelled) setSuppliers(data)
      } catch (e) {
        console.error(e)
        if (!cancelled) setLoadFailed(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleCreate(name: string, extra?: { phone?: string; notes?: string }) {
    const created = await window.api.createSupplier({
      name,
      phone: extra?.phone || null,
      notes: extra?.notes || null,
    })
    setSuppliers((prev) => [...prev, created])
    return created
  }

  return (
    <EntityPicker
      id={id}
      label="Proveedor"
      required
      entityName="proveedor"
      items={suppliers}
      loading={loading}
      valueId={valueId}
      onChange={onChange}
      onCreate={handleCreate}
      withExtraFields
      error={error ?? (loadFailed ? 'No pudimos cargar los proveedores.' : null)}
      triggerRef={triggerRef}
    />
  )
}
