import React, { useEffect, useState } from 'react'
import type { SupplierFromApi } from '../../electron-api'

type Props = {
  value: number
  onChange: (id: number) => void
  error?: string
}

export default function SupplierSelector({ value, onChange, error }: Props) {
  const [suppliers, setSuppliers] = useState<SupplierFromApi[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [mode, setMode] = useState<'select' | 'create'>('select')
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const data = await window.api.listSuppliers()
        if (!cancelled) setSuppliers(data)
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
    setNewPhone('')
    setNewNotes('')
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
      const created = await window.api.createSupplier({
        name: newName.trim(),
        phone: newPhone.trim() || null,
        notes: newNotes.trim() || null
      })
      setSuppliers((s) => [...s, created])
      onChange(created.id)
      setMode('select')
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : String(e))
      setCreating(false)
    }
  }

  if (mode === 'select') {
    if (loading) return <p>Cargando proveedores...</p>
    if (loadError) return <p>{loadError}</p>

    return (
      <div>
        <select
          aria-label="Proveedor"
          value={String(value)}
          onChange={(e) => {
            const v = e.target.value
            if (v === '-1') {
              setMode('create')
              setNewName('')
              setNewPhone('')
              setNewNotes('')
              setCreateError(null)
            } else {
              onChange(parseInt(v))
            }
          }}
        >
          <option value="0">-- Seleccioná un proveedor --</option>
          {suppliers.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.name}
            </option>
          ))}
          <option value="-1">+ Nuevo proveedor...</option>
        </select>
        {error && <p className="selector-error">{error}</p>}
      </div>
    )
  }

  return (
    <div>
      <input
        type="text"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        placeholder="Nombre"
      />
      <input
        type="text"
        value={newPhone}
        onChange={(e) => setNewPhone(e.target.value)}
        placeholder="Teléfono (opcional)"
      />
      <input
        type="text"
        value={newNotes}
        onChange={(e) => setNewNotes(e.target.value)}
        placeholder="Notas (opcional)"
      />
      <button onClick={handleCreate} disabled={creating}>
        Crear
      </button>
      <button onClick={handleCancelCreate}>Cancelar</button>
      {createError && <p className="selector-error">{createError}</p>}
    </div>
  )
}
