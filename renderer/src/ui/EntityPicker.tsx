import { useEffect, useMemo, useRef, useState } from 'react'
import { Building2, ChevronsUpDown, Plus, Search, Tag } from 'lucide-react'
import { Button } from './Button'
import { Field } from './Field'
import { foldText, includesFolded, splitMatch } from '../utils/text'

export type Entity = { id: number; name: string }

type EntityPickerProps = {
  id: string
  label: string
  required?: boolean
  /** Qué se está eligiendo; define los textos y el ícono de cada ítem. */
  entityName: 'categoría' | 'proveedor'
  items: Entity[]
  loading?: boolean
  /** Id seleccionado; 0 = sin selección. */
  valueId: number
  onChange: (id: number) => void
  /** Crea la entidad (la lista la actualiza quien llama) y devuelve la creada. */
  onCreate: (name: string, extra?: { phone?: string; notes?: string }) => Promise<Entity>
  /** Muestra Teléfono y Notas en el alta (proveedor). */
  withExtraFields?: boolean
  error?: string | null
  /** Ref al botón disparador (para llevar el foco al primer campo con error). */
  triggerRef?: React.Ref<HTMLButtonElement>
}

const TEXTS = {
  categoría: { placeholder: 'Elegí o creá una categoría', plural: 'categorías', newTitle: 'Nueva categoría' },
  proveedor: { placeholder: 'Elegí o creá un proveedor', plural: 'proveedores', newTitle: 'Nuevo proveedor' },
} as const

/**
 * Selector con alta en el momento (patrón "explorador de Windows"): se elige de la lista o se crea
 * una entidad nueva sin salir del formulario que lo contiene.
 *
 * Teclado: abre con click/Enter/Espacio/↓; ↑/↓ mueven la fila activa (el botón "Crear" es la última);
 * Enter elige o abre el alta; Esc vuelve a la lista o cierra devolviendo el foco al disparador.
 * Enter y Esc NUNCA se propagan: no deben enviar ni cerrar el formulario/modal que lo contiene.
 */
export function EntityPicker({
  id,
  label,
  required,
  entityName,
  items,
  loading,
  valueId,
  onChange,
  onCreate,
  withExtraFields,
  error,
  triggerRef,
}: EntityPickerProps) {
  const texts = TEXTS[entityName]
  const ItemIcon = entityName === 'categoría' ? Tag : Building2

  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'list' | 'new'>('list')
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const innerTriggerRef = useRef<HTMLButtonElement | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const setTriggerRef = (el: HTMLButtonElement | null) => {
    innerTriggerRef.current = el
    if (typeof triggerRef === 'function') triggerRef(el)
    else if (triggerRef) (triggerRef as React.RefObject<HTMLButtonElement | null>).current = el
  }

  const selected = items.find((i) => i.id === valueId)
  const filtered = useMemo(() => items.filter((i) => includesFolded(i.name, query)), [items, query])
  const canCreate = query.trim() !== ''
  /** Cantidad de filas navegables: los ítems más el botón "Crear" (si corresponde). */
  const rowCount = filtered.length + (canCreate ? 1 : 0)

  // Foco al abrir (buscador) y al pasar a/volver del alta.
  useEffect(() => {
    if (!open) return
    if (mode === 'list') searchRef.current?.focus()
    else nameRef.current?.focus()
  }, [open, mode])

  // Click afuera cierra.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) closePopover(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function openPopover() {
    setQuery('')
    setActiveIndex(0)
    setMode('list')
    setCreateError(null)
    setOpen(true)
  }

  function closePopover(returnFocus: boolean) {
    setOpen(false)
    setMode('list')
    setCreateError(null)
    if (returnFocus) innerTriggerRef.current?.focus()
  }

  function choose(entity: Entity) {
    onChange(entity.id)
    closePopover(true)
  }

  function startCreate() {
    setNewName(query.trim())
    setNewPhone('')
    setNewNotes('')
    setCreateError(null)
    setMode('new')
  }

  async function submitCreate() {
    if (creating) return
    const name = newName.trim()
    if (name === '') {
      setCreateError('Ingresá un nombre.')
      return
    }
    const duplicate = items.find((i) => foldText(i.name.trim()) === foldText(name))
    if (duplicate) {
      setCreateError(`Ya existe «${duplicate.name}». Elegilo de la lista.`)
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      const extra = withExtraFields ? { phone: newPhone.trim() || undefined, notes: newNotes.trim() || undefined } : undefined
      const created = await onCreate(name, extra)
      onChange(created.id)
      closePopover(true)
    } catch (e) {
      console.error(e)
      setCreateError('No se pudo crear. Probá de nuevo.')
    } finally {
      setCreating(false)
    }
  }

  /** Teclado del popover. Enter/Esc se consumen siempre (no deben llegar al formulario de afuera). */
  function onPopoverKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      if (mode === 'new') setMode('list')
      else closePopover(true)
      return
    }
    if (e.key === 'Enter') {
      e.stopPropagation()
      e.preventDefault()
      if (mode === 'new') {
        void submitCreate()
      } else if (activeIndex < filtered.length) {
        choose(filtered[activeIndex])
      } else if (canCreate) {
        startCreate()
      }
      return
    }
    if (mode !== 'list' || rowCount === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, rowCount - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    }
  }

  const describedBy = error ? `${id}-error` : undefined

  return (
    <Field label={label} htmlFor={id} required={required} error={error}>
      <div className="ig-anchor" ref={wrapperRef}>
        <button
          id={id}
          ref={setTriggerRef}
          type="button"
          className="ig-picker"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          style={error ? { borderColor: 'var(--danger-border)', background: 'var(--danger-soft)' } : undefined}
          onClick={() => (open ? closePopover(false) : openPopover())}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && !open) {
              e.preventDefault()
              openPopover()
            }
          }}
        >
          {selected ? <span>{selected.name}</span> : <span className="placeholder">{texts.placeholder}</span>}
          <ChevronsUpDown size={16} strokeWidth={2} aria-hidden="true" className="ig-icon ig-icon-sm" />
        </button>

        {open && (
          <div className="ig-picker-pop" role="dialog" aria-label={`Elegir ${entityName}`} onKeyDown={onPopoverKeyDown}>
            {mode === 'list' ? (
              <>
                <div className="ig-pop-search">
                  <div className="ig-input-wrap">
                    <Search size={18} strokeWidth={2} aria-hidden="true" className="ig-icon" />
                    <input
                      ref={searchRef}
                      className="ig-input"
                      aria-label={`Buscar ${entityName}`}
                      placeholder={`Buscar ${entityName}`}
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value)
                        setActiveIndex(0)
                      }}
                    />
                  </div>
                </div>
                <ul className="ig-picker-list" role="listbox" aria-label={texts.plural}>
                  {loading && <li aria-disabled="true">Cargando…</li>}
                  {!loading && filtered.length === 0 && (
                    <li aria-disabled="true" className="ig-muted" style={{ cursor: 'default' }}>
                      {canCreate ? `No hay ${texts.plural} con «${query.trim()}»` : `Todavía no hay ${texts.plural}`}
                    </li>
                  )}
                  {filtered.map((item, i) => (
                    <li
                      key={item.id}
                      role="option"
                      aria-selected={item.id === valueId}
                      className={i === activeIndex ? 'is-active' : undefined}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => choose(item)}
                    >
                      <ItemIcon size={16} strokeWidth={2} aria-hidden="true" className="ig-icon ig-icon-sm" />
                      <span>
                        {splitMatch(item.name, query).map((part, k) => (part.match ? <b key={k}>{part.text}</b> : part.text))}
                      </span>
                    </li>
                  ))}
                </ul>
                {canCreate && (
                  <button
                    type="button"
                    className={`ig-picker-create${activeIndex === filtered.length ? ' is-active' : ''}`}
                    onMouseEnter={() => setActiveIndex(filtered.length)}
                    onClick={startCreate}
                  >
                    <Plus size={16} strokeWidth={2} aria-hidden="true" className="ig-icon ig-icon-sm" />
                    Crear «{query.trim()}»
                  </button>
                )}
              </>
            ) : (
              <div className="ig-picker-new">
                <div className="ig-overline">{texts.newTitle}</div>
                <Field label="Nombre" htmlFor={`${id}-new-name`} required error={createError}>
                  <input
                    id={`${id}-new-name`}
                    ref={nameRef}
                    className={createError ? 'ig-input is-error' : 'ig-input'}
                    value={newName}
                    aria-invalid={!!createError}
                    onChange={(e) => {
                      setNewName(e.target.value)
                      setCreateError(null)
                    }}
                  />
                </Field>
                {withExtraFields && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Teléfono" htmlFor={`${id}-new-phone`}>
                      <input
                        id={`${id}-new-phone`}
                        className="ig-input"
                        placeholder="Opcional"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                      />
                    </Field>
                    <Field label="Notas" htmlFor={`${id}-new-notes`}>
                      <input
                        id={`${id}-new-notes`}
                        className="ig-input"
                        placeholder="Opcional"
                        value={newNotes}
                        onChange={(e) => setNewNotes(e.target.value)}
                      />
                    </Field>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Button variant="ghost" size="sm" onClick={() => setMode('list')}>
                    Cancelar
                  </Button>
                  <Button variant="primary" size="sm" disabled={creating} onClick={() => void submitCreate()}>
                    Crear y elegir
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Field>
  )
}
