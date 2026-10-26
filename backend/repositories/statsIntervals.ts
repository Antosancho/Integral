/**
 * backend/repositories/statsIntervals.ts
 *
 * Filtro horario de Estadísticas: intervalos semiabiertos [from, to) en hora local.
 * El renderer arma un intervalo por día ancla del período (renderer/src/Pages/Stats/hourFilter.ts
 * › buildIntervals) y los manda en `intervals`. Módulo puro: no importa el Prisma client.
 */

import type { Prisma } from "@prisma/client"

/** Intervalo semiabierto [from, to) en hora local. */
export type StatsInterval = { from: Date; to: Date }

/**
 * Payload de los 6 canales stats:*.
 * - Sin `intervals` (o vacío): rango [from, to] de siempre (días calendario).
 * - Con `intervals`: solo cuentan las ventas con from <= date < to de algún intervalo;
 *   `from`/`to` se ignoran para filtrar.
 */
export type StatsRangeInput = { from: Date; to: Date; intervals?: StatsInterval[] }

/** Tope técnico por consulta. La UI corta antes: 366 días (MAX_FILTERED_DAYS del renderer). */
export const MAX_STATS_INTERVALS = 400

/**
 * Valida `intervals` y devuelve una COPIA ordenada por `from` (no muta la entrada).
 * undefined / null / [] → [] (sin filtro horario).
 * @throws Error si no es un array, si supera MAX_STATS_INTERVALS, si un elemento no tiene
 *   `from` y `to` de tipo Date válidos, o si `from >= to`.
 */
export function normalizeStatsIntervals(intervals: unknown): StatsInterval[] {
  if (intervals === undefined || intervals === null) return []
  if (!Array.isArray(intervals)) throw new Error("intervals debe ser un array")
  if (intervals.length > MAX_STATS_INTERVALS) {
    throw new Error(`intervals admite hasta ${MAX_STATS_INTERVALS} intervalos (llegaron ${intervals.length})`)
  }
  const out = intervals.map((item: unknown, i: number): StatsInterval => {
    const from = (item as { from?: unknown } | null)?.from
    const to = (item as { to?: unknown } | null)?.to
    if (
      !(from instanceof Date) || Number.isNaN(from.getTime()) ||
      !(to instanceof Date) || Number.isNaN(to.getTime())
    ) {
      throw new Error(`intervals[${i}] necesita from y to de tipo Date`)
    }
    if (from.getTime() >= to.getTime()) {
      throw new Error(`intervals[${i}]: from tiene que ser anterior a to`)
    }
    return { from, to }
  })
  return out.sort((a, b) => a.from.getTime() - b.from.getTime())
}

/**
 * `where` de Sale.date para las consultas de Estadísticas.
 * - Sin intervalos: `{ date: { gte: from, lte: to } }` (IDÉNTICO al de siempre).
 * - Con intervalos: rango envolvente + OR de los intervalos. El rango envolvente es OBLIGATORIO:
 *   deja que SQLite use el índice de Sale.date y evalúe el OR solo sobre esas filas (sin él, las
 *   consultas sobre SaleItem recorren toda la tabla).
 * Sirve para `prisma.sale.*` (`where: saleWhere`) y como filtro de relación en `prisma.saleItem.*`
 * (`where: { sale: saleWhere, ... }`).
 */
export function buildSaleDateWhere(from: Date, to: Date, intervals?: StatsInterval[]): Prisma.SaleWhereInput {
  const list = normalizeStatsIntervals(intervals)
  if (list.length === 0) return { date: { gte: from, lte: to } }
  let outerTo = list[0].to
  for (const interval of list) {
    if (interval.to.getTime() > outerTo.getTime()) outerTo = interval.to
  }
  return {
    date: { gte: list[0].from, lt: outerTo },
    OR: list.map((interval) => ({ date: { gte: interval.from, lt: interval.to } }))
  }
}

/**
 * Índice del intervalo que contiene `date` (from <= date < to), o -1.
 * `sorted` tiene que venir ordenado por `from` y sin solapamientos (salida de normalizeStatsIntervals).
 * Búsqueda binaria: O(log n).
 */
export function findIntervalIndex(sorted: StatsInterval[], date: Date): number {
  const t = date.getTime()
  let lo = 0
  let hi = sorted.length - 1
  let candidate = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid].from.getTime() <= t) {
      candidate = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  if (candidate === -1) return -1
  return t < sorted[candidate].to.getTime() ? candidate : -1
}
