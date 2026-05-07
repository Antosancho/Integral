import { useEffect, useState } from 'react'
import type { CategoryFromApi } from '../../electron-api'

type Props = {
  value: number
  onChange: (id: number) => void
  error?: string
}

export default function CategorySelector({ value, onChange, error }: Props) {
  const [categories, setCategories] = useState<CategoryFromApi[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [mode, setMode] = useState<'select' | 'create'>('select')
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const data = await window.api.listCategories()
        if (!cancelled) setCategories(data)
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  function handleCancelCreate() {
    setMode('select')
    setNewName('')
    setCreateError(null)
    onChange(0)
  }

  async function handleCreate() {
    if (newName.trim() === '') {
      setCreateError('El nombre es obligatorio')
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      const created = await window.api.createCategory({ name: newName.trim() })
      setCategories((c) => [...c, created])
      onChange(created.id)
      setMode('select')
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : String(e))
      setCreating(false)
    }
  }

  if (mode === 'select') {
    if (loading) return <p>Cargando categorías...</p>
    if (loadError) return <p>{loadError}</p>

    return (
      <div>
        <select
          aria-label="Categoría"
          value={String(value)}
          onChange={(e) => {
            const v = e.target.value
            if (v === '-1') {
              setMode('create')
              setNewName('')
              setCreateError(null)
            } else {
              onChange(parseInt(v))
            }
          }}
        >
          <option value="0">-- Seleccioná una categoría --</option>
          {categories.map((cat) => (
            <option key={cat.id} value={String(cat.id)}>
              {cat.name}
            </option>
          ))}
          <option value="-1">+ Nueva categoría...</option>
        </select>
        {error && <p className="selector-error">{error}</p>}
      </div>
    )
  }

  // mode === 'create'
  return (
    <div>
      <input
        type="text"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        placeholder="Nombre de la categoría"
      />
      <button onClick={handleCreate} disabled={creating}>
        Crear
      </button>
      <button onClick={handleCancelCreate}>Cancelar</button>
      {createError && <p className="selector-error">{createError}</p>}
    </div>
  )
}
