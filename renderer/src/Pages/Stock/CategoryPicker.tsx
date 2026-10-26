import { useEffect, useState } from 'react'
import type { CategoryFromApi } from '../../electron-api'
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
 * Selector de categoría con alta en el momento. Carga la lista con `window.api.listCategories()`
 * al montar y agrega a su lista local cada categoría que se crea.
 */
export default function CategoryPicker({ id, valueId, onChange, error, triggerRef }: Props) {
  const [categories, setCategories] = useState<CategoryFromApi[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await window.api.listCategories()
        if (!cancelled) setCategories(data)
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

  async function handleCreate(name: string) {
    const created = await window.api.createCategory({ name })
    setCategories((prev) => [...prev, created])
    return created
  }

  return (
    <EntityPicker
      id={id}
      label="Categoría"
      required
      entityName="categoría"
      items={categories}
      loading={loading}
      valueId={valueId}
      onChange={onChange}
      onCreate={handleCreate}
      error={error ?? (loadFailed ? 'No pudimos cargar las categorías.' : null)}
      triggerRef={triggerRef}
    />
  )
}
