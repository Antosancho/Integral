import { useEffect, useRef, useState } from 'react'
import { Clock, Pencil } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Segmented } from '../../ui/Segmented'
import { TimeField } from '../../ui/TimeField'
import { formatMinutesHM, parseTimeHM, timeFieldError } from '../../utils/time'
import { describeWindow, resolveHourFilter, type HourFilterMode, type TimeWindow } from './hourFilter'

const HOUR_OPTIONS: { value: HourFilterMode; label: string; icon?: typeof Clock }[] = [
  { value: 'all', label: 'Todo el día' },
  { value: 'workday', label: 'Jornada laboral' },
  { value: 'custom', label: 'Personalizado', icon: Clock }
]

export type HourFilterBarProps = {
  mode: HourFilterMode
  onModeChange: (mode: HourFilterMode) => void
  /** Jornada laboral vigente (ya guardada). */
  workday: TimeWindow
  /** Jornada nueva, ya validada. El padre la guarda en localStorage y la aplica. */
  onWorkdayChange: (w: TimeWindow) => void
  /** Horas de "Personalizado" como texto "HH:MM" (pueden estar incompletas). */
  customStart: string
  customEnd: string
  onCustomStartChange: (value: string) => void
  onCustomEndChange: (value: string) => void
}

/**
 * Fila "Horario" de Estadísticas: Todo el día | Jornada laboral | Personalizado.
 * - Jornada laboral: muestra la franja guardada y se edita en el lugar con "Cambiar jornada".
 *   Enter guarda, Esc cancela; al cerrar, el foco vuelve a "Cambiar jornada".
 * - Personalizado: "Desde hora" / "Hasta hora" (HH:MM). El padre decide cuándo consultar.
 */
export default function HourFilterBar({
  mode,
  onModeChange,
  workday,
  onWorkdayChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange
}: HourFilterBarProps) {
  const [editing, setEditing] = useState(false)
  const [draftStart, setDraftStart] = useState('')
  const [draftEnd, setDraftEnd] = useState('')
  const [errors, setErrors] = useState<{ start: string | null; end: string | null }>({ start: null, end: null })
  const startRef = useRef<HTMLInputElement>(null)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  /** true cuando el editor se cerró con Guardar / Cancelar / Enter / Esc: el foco vuelve al botón. */
  const returnFocus = useRef(false)

  useEffect(() => {
    if (editing) {
      startRef.current?.focus()
    } else if (returnFocus.current) {
      returnFocus.current = false
      editButtonRef.current?.focus()
    }
  }, [editing])

  // Cambiar de modo cierra el editor sin devolver el foco (queda en la pestaña elegida).
  const changeMode = (next: HourFilterMode) => {
    setEditing(false)
    onModeChange(next)
  }

  const openEditor = () => {
    setDraftStart(formatMinutesHM(workday.startMinute))
    setDraftEnd(formatMinutesHM(workday.endMinute))
    setErrors({ start: null, end: null })
    setEditing(true)
  }

  const closeEditor = () => {
    returnFocus.current = true
    setEditing(false)
  }

  const save = () => {
    const startMinute = parseTimeHM(draftStart)
    const endMinute = parseTimeHM(draftEnd)
    if (startMinute === null || endMinute === null) {
      setErrors({ start: timeFieldError(draftStart, true), end: timeFieldError(draftEnd, true) })
      return
    }
    onWorkdayChange({ startMinute, endMinute })
    closeEditor()
  }

  const onEditorKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      save()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeEditor()
    }
  }

  const custom = resolveHourFilter('custom', workday, customStart, customEnd)

  return (
    <div className="ig-filters stats-hours">
      <div className="ig-field">
        <span className="ig-label" aria-hidden="true">
          Horario
        </span>
        <Segmented<HourFilterMode> ariaLabel="Horario" options={HOUR_OPTIONS} value={mode} onChange={changeMode} />
      </div>

      {mode === 'workday' && !editing && (
        <>
          <span className="ig-help stats-hours-desc">{describeWindow(workday)}</span>
          <Button ref={editButtonRef} size="sm" variant="ghost" icon={Pencil} onClick={openEditor}>
            Cambiar jornada
          </Button>
        </>
      )}

      {mode === 'workday' && editing && (
        <>
          <TimeField
            id="stats-workday-start"
            label="Abre"
            className="stats-time"
            inputRef={startRef}
            value={draftStart}
            error={errors.start}
            onChange={(v) => {
              setDraftStart(v)
              setErrors((prev) => ({ ...prev, start: null }))
            }}
            onKeyDown={onEditorKeyDown}
          />
          <TimeField
            id="stats-workday-end"
            label="Cierra"
            className="stats-time"
            value={draftEnd}
            error={errors.end}
            onChange={(v) => {
              setDraftEnd(v)
              setErrors((prev) => ({ ...prev, end: null }))
            }}
            onKeyDown={onEditorKeyDown}
          />
          <Button size="sm" onClick={save}>
            Guardar jornada
          </Button>
          <Button size="sm" variant="ghost" onClick={closeEditor}>
            Cancelar
          </Button>
        </>
      )}

      {mode === 'custom' && (
        <>
          <TimeField
            id="stats-hour-from"
            label="Desde hora"
            className="stats-time"
            value={customStart}
            error={timeFieldError(customStart, false)}
            onChange={onCustomStartChange}
          />
          <TimeField
            id="stats-hour-to"
            label="Hasta hora"
            className="stats-time"
            value={customEnd}
            error={timeFieldError(customEnd, false)}
            onChange={onCustomEndChange}
          />
          <span className="ig-help stats-hours-desc">
            {custom.kind === 'window' ? describeWindow(custom.window) : 'Completá las dos horas para aplicar el filtro.'}
          </span>
        </>
      )}
    </div>
  )
}
