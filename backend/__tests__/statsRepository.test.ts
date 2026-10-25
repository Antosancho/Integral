/**
 * backend/__tests__/statsRepository.test.ts
 *
 * Repositorio de Estadísticas con y sin filtro horario (`intervals`).
 * DB temporal VACÍA creada desde las migraciones (helpers/testDb.ts): nunca toca dev.db.
 *
 * Fechas con `new Date(año, mes0, día, h, min)` = hora LOCAL de la PC, igual que el
 * renderer y que `getHours()` / `getDay()` del repositorio.
 * Octubre 2026: dom 18, lun 19, mar 20, mié 21.
 */

import type { Prisma, PrismaClient } from "@prisma/client"
import type { ElectronApi } from "../../electron/ipcContract"
import { createMigratedTestDb } from "./helpers/testDb"

type StatsModule = typeof import("../repositories/statsRepository")
type IntervalsModule = typeof import("../repositories/statsIntervals")

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

/** Compara por JSON (el repositorio devuelve strings y números). */
function assertEqual(actual: unknown, expected: unknown, message: string): void {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${message}\n  esperado: ${e}\n  obtenido: ${a}`)
}

async function assertRejects(fn: () => Promise<unknown>, includes: string, message: string): Promise<void> {
  try {
    await fn()
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error)
    assert(text.includes(includes), `${message}: el error "${text}" no incluye "${includes}"`)
    return
  }
  throw new Error(`${message}: se esperaba un error y no hubo`)
}

function logStep(step: string): void {
  console.log(`PASS: ${step}`)
}

/** Fecha local de octubre 2026. */
const at = (day: number, hour: number, minute: number) => new Date(2026, 9, day, hour, minute)
/** Días calendario completos de octubre 2026: [d1 00:00:00.000, d2 23:59:59.999]. */
const days = (d1: number, d2: number = d1) => ({
  from: new Date(2026, 9, d1, 0, 0, 0, 0),
  to: new Date(2026, 9, d2, 23, 59, 59, 999)
})

const DOM = days(18)
const LUN = days(19)
const MAR = days(20)
const LUN_MAR = days(19, 20)
// Intervalos [from, to) que armaría el renderer
const DOM_W = { from: at(18, 8, 0), to: at(19, 2, 0) } // jornada 08→02 del domingo
const LUN_W = { from: at(19, 8, 0), to: at(20, 2, 0) } // jornada 08→02 del lunes
const MAR_W = { from: at(20, 8, 0), to: at(21, 2, 0) } // jornada 08→02 del martes
const LUN_W2 = { from: at(19, 9, 0), to: at(19, 13, 0) } // franja 09→13 del lunes
const MAR_W2 = { from: at(20, 9, 0), to: at(20, 13, 0) } // franja 09→13 del martes
const LUN_W24 = { from: at(19, 8, 0), to: at(20, 8, 0) } // franja 08→08 (24 h) del lunes
const MAR_W24 = { from: at(20, 8, 0), to: at(21, 8, 0) } // franja 08→08 (24 h) del martes

/** "Producto:valor" para comparar rankings sin depender de ids. */
const topNames = (rows: { productName: string; value: string }[]) => rows.map((r) => `${r.productName}:${r.value}`)
const lowNames = (rows: { productName: string; totalQuantity: number }[]) =>
  rows.map((r) => `${r.productName}:${r.totalQuantity}`)
/** "label:saleCount:totalRevenue" */
const rowStr = (rows: { label: string; saleCount: number; totalRevenue: string }[]) =>
  rows.map((r) => `${r.label}:${r.saleCount}:${r.totalRevenue}`)

type Summary = { totalRevenue: string; saleCount: number; averageTicket: string; totalProfit: string }
const sum = (totalRevenue: string, saleCount: number, averageTicket: string, totalProfit: string): Summary => ({
  totalRevenue,
  saleCount,
  averageTicket,
  totalProfit
})

async function seed(prisma: PrismaClient): Promise<void> {
  const category = await prisma.category.create({ data: { name: "Stats test category" } })
  const supplier = await prisma.supplier.create({ data: { name: "Stats test supplier" } })
  const base = { categoryId: category.id, supplierId: supplier.id }
  // Orden de creación = orden de ids (Alfajor, Gaseosa, Sin ventas): importa para los empates.
  const alfajor = await prisma.product.create({ data: { ...base, name: "Alfajor", purchasePrice: "60", salePrice: "100" } })
  const gaseosa = await prisma.product.create({ data: { ...base, name: "Gaseosa", purchasePrice: "20", salePrice: "50" } })
  await prisma.product.create({ data: { ...base, name: "Sin ventas", purchasePrice: "10", salePrice: "20" } })

  type Item = Prisma.SaleItemUncheckedCreateWithoutSaleInput
  const A = (quantity: number): Item => ({ productId: alfajor.id, quantity, unitPrice: "100", purchasePriceSnapshot: "60" })
  const G = (quantity: number): Item => ({ productId: gaseosa.id, quantity, unitPrice: "50", purchasePriceSnapshot: "20" })
  const general: Item = { quantity: 1, unitPrice: "30" } // línea General (F10): sin producto ni costo

  const sales: { date: Date; total: string; items: Item[] }[] = [
    { date: at(18, 23, 30), total: "100", items: [A(1)] }, // S0 dom 23:30
    { date: at(19, 7, 59), total: "100", items: [A(1)] }, // S1 lun 07:59 (antes de abrir)
    { date: at(19, 8, 0), total: "200", items: [A(2)] }, // S2 lun 08:00 (justo al abrir)
    { date: at(19, 23, 59), total: "50", items: [G(1)] }, // S3 lun 23:59
    { date: at(20, 1, 0), total: "150", items: [G(3)] }, // S4 mar 01:00 (madrugada del lunes)
    { date: at(20, 1, 59), total: "100", items: [A(1)] }, // S5 mar 01:59
    { date: at(20, 2, 0), total: "50", items: [G(1)] }, // S6 mar 02:00 (justo al cerrar: afuera)
    { date: at(20, 8, 0), total: "130", items: [A(1), general] }, // S7 mar 08:00 (+ línea General)
    { date: at(20, 10, 0), total: "50", items: [G(1)] }, // S8 mar 10:00
    { date: at(21, 1, 30), total: "100", items: [G(2)] } // S9 mié 01:30 (madrugada del martes)
  ]
  for (const s of sales) {
    await prisma.sale.create({ data: { date: s.date, total: s.total, items: { create: s.items } } })
  }
}

async function testPureHelpers(lib: IntervalsModule): Promise<void> {
  const legacy = { date: { gte: LUN.from, lte: LUN.to } }
  assertEqual(lib.buildSaleDateWhere(LUN.from, LUN.to), legacy, "J1 sin intervals")
  assertEqual(lib.buildSaleDateWhere(LUN.from, LUN.to, []), legacy, "J1 intervals vacío")
  assertEqual(
    lib.buildSaleDateWhere(LUN.from, LUN.to, [MAR_W, LUN_W]),
    {
      date: { gte: LUN_W.from, lt: MAR_W.to },
      OR: [{ date: { gte: LUN_W.from, lt: LUN_W.to } }, { date: { gte: MAR_W.from, lt: MAR_W.to } }]
    },
    "J2 where con intervalos"
  )
  assertEqual(lib.normalizeStatsIntervals(undefined), [], "J3 undefined")
  assertEqual(lib.normalizeStatsIntervals(null), [], "J3 null")
  assertEqual(lib.normalizeStatsIntervals([]), [], "J3 []")
  const input = [MAR_W, LUN_W]
  assertEqual(lib.normalizeStatsIntervals(input), [LUN_W, MAR_W], "J3 ordena")
  assertEqual(input, [MAR_W, LUN_W], "J3 no muta la entrada")
  const sorted = [LUN_W, MAR_W]
  const cases: [Date, number][] = [
    [at(19, 8, 0), 0],
    [at(20, 1, 59), 0],
    [at(20, 2, 0), -1],
    [at(20, 5, 0), -1],
    [at(20, 8, 0), 1],
    [new Date(2026, 9, 21, 1, 59, 59, 999), 1],
    [at(21, 2, 0), -1],
    [at(19, 7, 59), -1]
  ]
  for (const [date, expected] of cases) {
    assert(lib.findIntervalIndex(sorted, date) === expected, `J4 findIntervalIndex(${date.toISOString()}) debía dar ${expected}`)
  }
  assert(lib.findIntervalIndex([], at(19, 8, 0)) === -1, "J4 lista vacía")
  assert(lib.MAX_STATS_INTERVALS === 400, "J5 MAX_STATS_INTERVALS")
  logStep("caso J: helpers puros")
}

async function testLegacy(stats: StatsModule): Promise<void> {
  // Caso A — lunes calendario, sin intervals: comportamiento de siempre (S1, S2, S3)
  assertEqual(await stats.getSalesSummary(LUN.from, LUN.to), sum("350", 3, "116.67", "150"), "A summary")
  assertEqual(rowStr(await stats.getSalesByHour(LUN.from, LUN.to)), ["07:1:100", "08:1:200", "23:1:50"], "A byHour")
  assertEqual(rowStr(await stats.getSalesByWeekday(LUN.from, LUN.to)), ["1:3:350"], "A byWeekday")
  assertEqual(topNames(await stats.getTopProductsByQuantity(LUN.from, LUN.to, 5)), ["Alfajor:3", "Gaseosa:1"], "A topQty")
  assertEqual(topNames(await stats.getTopProductsByRevenue(LUN.from, LUN.to, 5)), ["Alfajor:300", "Gaseosa:50"], "A topRev")
  assertEqual(lowNames(await stats.getLowRotationProducts(LUN.from, LUN.to, 10)), ["Sin ventas:0", "Gaseosa:1", "Alfajor:3"], "A lowRot")
  logStep("caso A: lunes calendario sin intervals")

  // Caso B — martes calendario: la venta del martes 01:00 cuenta para el martes
  assertEqual(await stats.getSalesSummary(MAR.from, MAR.to), sum("480", 5, "96", "230"), "B summary")
  assertEqual(rowStr(await stats.getSalesByHour(MAR.from, MAR.to)), ["01:2:250", "02:1:50", "08:1:130", "10:1:50"], "B byHour")
  assertEqual(rowStr(await stats.getSalesByWeekday(MAR.from, MAR.to)), ["2:5:480"], "B byWeekday")
  assertEqual(topNames(await stats.getTopProductsByQuantity(MAR.from, MAR.to, 5)), ["Gaseosa:5", "Alfajor:2"], "B topQty")
  assertEqual(topNames(await stats.getTopProductsByRevenue(MAR.from, MAR.to, 5)), ["Gaseosa:250", "Alfajor:200"], "B topRev")
  assertEqual(lowNames(await stats.getLowRotationProducts(MAR.from, MAR.to, 10)), ["Sin ventas:0", "Alfajor:2", "Gaseosa:5"], "B lowRot")
  logStep("caso B: martes calendario sin intervals")
}

async function testWithIntervals(stats: StatsModule): Promise<void> {
  // Último bloque del caso A: [] y undefined dan lo mismo que sin el argumento
  for (const extra of [[], undefined] as (undefined | [])[]) {
    assertEqual(await stats.getSalesSummary(LUN.from, LUN.to, extra), await stats.getSalesSummary(LUN.from, LUN.to), "A [] summary")
    assertEqual(await stats.getTopProductsByQuantity(LUN.from, LUN.to, 5, extra), await stats.getTopProductsByQuantity(LUN.from, LUN.to, 5), "A [] topQty")
    assertEqual(await stats.getTopProductsByRevenue(LUN.from, LUN.to, 5, extra), await stats.getTopProductsByRevenue(LUN.from, LUN.to, 5), "A [] topRev")
    assertEqual(await stats.getSalesByHour(LUN.from, LUN.to, extra), await stats.getSalesByHour(LUN.from, LUN.to), "A [] byHour")
    assertEqual(await stats.getSalesByWeekday(LUN.from, LUN.to, extra), await stats.getSalesByWeekday(LUN.from, LUN.to), "A [] byWeekday")
    assertEqual(await stats.getLowRotationProducts(LUN.from, LUN.to, 10, extra), await stats.getLowRotationProducts(LUN.from, LUN.to, 10), "A [] lowRot")
  }
  logStep("caso A: [] y undefined equivalen a sin intervals")

  type Intervals = { from: Date; to: Date }[]
  type Expected = {
    summary: Summary
    byHour: string[]
    byWeekday: string[]
    topQty: string[]
    topRev: string[]
    lowRot: string[]
  }
  async function check(name: string, range: { from: Date; to: Date }, intervals: Intervals, e: Expected, loose?: { topRev?: true; lowRot?: "F" | "H" }) {
    assertEqual(await stats.getSalesSummary(range.from, range.to, intervals), e.summary, `${name} summary`)
    assertEqual(rowStr(await stats.getSalesByHour(range.from, range.to, intervals)), e.byHour, `${name} byHour`)
    assertEqual(rowStr(await stats.getSalesByWeekday(range.from, range.to, intervals)), e.byWeekday, `${name} byWeekday`)
    assertEqual(topNames(await stats.getTopProductsByQuantity(range.from, range.to, 5, intervals)), e.topQty, `${name} topQty`)
    const topRev = topNames(await stats.getTopProductsByRevenue(range.from, range.to, 5, intervals))
    assertEqual(loose?.topRev ? [...topRev].sort() : topRev, e.topRev, `${name} topRev`)
    const low = lowNames(await stats.getLowRotationProducts(range.from, range.to, 10, intervals))
    if (loose?.lowRot === "F") {
      assertEqual([...low].sort(), ["Alfajor:0", "Gaseosa:1", "Sin ventas:0"], `${name} lowRot`)
      assertEqual(low[2], "Gaseosa:1", `${name} lowRot último`)
    } else if (loose?.lowRot === "H") {
      assertEqual([...low].sort(), ["Alfajor:1", "Gaseosa:0", "Sin ventas:0"], `${name} lowRot`)
      assertEqual(low[2], "Alfajor:1", `${name} lowRot último`)
    } else {
      assertEqual(low, e.lowRot, `${name} lowRot`)
    }
  }

  // C — lunes con jornada 08→02: S4 y S5 del martes cuentan como lunes
  await check("C", LUN, [LUN_W], {
    summary: sum("500", 4, "125", "240"),
    byHour: ["01:2:250", "08:1:200", "23:1:50"],
    byWeekday: ["1:4:500"],
    topQty: ["Gaseosa:4", "Alfajor:3"],
    topRev: ["Alfajor:300", "Gaseosa:200"],
    lowRot: ["Sin ventas:0", "Alfajor:3", "Gaseosa:4"]
  })
  logStep("caso C: lunes con jornada 08→02")

  // D — lunes y martes con jornada
  const expectedD: Expected = {
    summary: sum("780", 7, "111.43", "370"),
    byHour: ["01:3:350", "08:2:330", "10:1:50", "23:1:50"],
    byWeekday: ["1:4:500", "2:3:280"],
    topQty: ["Gaseosa:7", "Alfajor:4"],
    topRev: ["Alfajor:400", "Gaseosa:350"],
    lowRot: ["Sin ventas:0", "Alfajor:4", "Gaseosa:7"]
  }
  await check("D", LUN_MAR, [LUN_W, MAR_W], expectedD)
  logStep("caso D: lunes y martes con jornada")

  // E — intervalos desordenados
  await check("E", LUN_MAR, [MAR_W, LUN_W], expectedD)
  logStep("caso E: intervalos desordenados")

  // F — franja del mismo día 09→13
  await check(
    "F",
    LUN_MAR,
    [LUN_W2, MAR_W2],
    {
      summary: sum("50", 1, "50", "30"),
      byHour: ["10:1:50"],
      byWeekday: ["2:1:50"],
      topQty: ["Gaseosa:1"],
      topRev: ["Gaseosa:50"],
      lowRot: []
    },
    { lowRot: "F" }
  )
  logStep("caso F: franja del mismo día")

  // G — franja de 24 h 08→08 (S6 de las 02:00 entra al lunes; S7 de las 08:00 en punto es del martes)
  await check(
    "G",
    LUN_MAR,
    [LUN_W24, MAR_W24],
    {
      summary: sum("830", 8, "103.75", "400"),
      byHour: ["01:3:350", "02:1:50", "08:2:330", "10:1:50", "23:1:50"],
      byWeekday: ["1:5:550", "2:3:280"],
      topQty: ["Gaseosa:8", "Alfajor:4"],
      topRev: ["Alfajor:400", "Gaseosa:400"],
      lowRot: ["Sin ventas:0", "Alfajor:4", "Gaseosa:8"]
    },
    { topRev: true }
  )
  logStep("caso G: franja de 24 h")

  // H — domingo con jornada (domingo = "0")
  await check(
    "H",
    DOM,
    [DOM_W],
    {
      summary: sum("100", 1, "100", "40"),
      byHour: ["23:1:100"],
      byWeekday: ["0:1:100"],
      topQty: ["Alfajor:1"],
      topRev: ["Alfajor:100"],
      lowRot: []
    },
    { lowRot: "H" }
  )
  logStep("caso H: domingo con jornada")
}

async function testValidation(stats: StatsModule): Promise<void> {
  const bad = (value: unknown, includes: string, name: string) =>
    assertRejects(() => stats.getSalesSummary(LUN.from, LUN.to, value as never), includes, name)
  await bad([{ from: at(19, 8, 0), to: at(19, 8, 0) }], "intervals[0]", "I from == to")
  await bad([{ from: at(20, 2, 0), to: at(19, 8, 0) }], "intervals[0]", "I from > to")
  await bad([{ from: "2026-10-19", to: at(20, 2, 0) }], "intervals[0]", "I no es Date")
  await bad("x", "intervals debe ser un array", "I no es array")
  const many = (n: number) => Array.from({ length: n }, (_, i) => ({ from: new Date(2020, 0, 1 + i, 8), to: new Date(2020, 0, 2 + i, 2) }))
  await bad(many(401), "hasta 400", "I 401 intervalos")
  assertEqual((await stats.getSalesSummary(LUN.from, LUN.to, many(400))).saleCount, 0, "I 400 intervalos válidos")
  await assertRejects(() => stats.getSalesByWeekday(LUN.from, LUN.to, "x" as never), "intervals debe ser un array", "I weekday no es array")
  logStep("caso I: validación de intervals")
}

async function testIpc(api: ElectronApi, call: (channel: string, payload: unknown) => Promise<unknown>): Promise<void> {
  assertEqual((await api.getSalesSummary({ from: LUN.from, to: LUN.to })).saleCount, 3, "K sin intervals")
  const s = await api.getSalesSummary({ from: LUN.from, to: LUN.to, intervals: [LUN_W] })
  assertEqual([s.saleCount, s.totalRevenue], [4, "500"], "K con intervals")
  assertEqual(
    rowStr(await api.getSalesByWeekday({ from: LUN.from, to: LUN.to, intervals: [LUN_W] })),
    ["1:4:500"],
    "K byWeekday"
  )
  assertEqual(
    (await api.getSalesByHour({ from: LUN.from, to: LUN.to, intervals: [LUN_W] })).map((r) => r.label),
    ["01", "08", "23"],
    "K byHour"
  )
  assertEqual(
    topNames(await api.getTopProductsByQuantity({ from: LUN.from, to: LUN.to, limit: 1, intervals: [LUN_W] })),
    ["Gaseosa:4"],
    "K topQty"
  )
  assertEqual(
    topNames(await api.getTopProductsByRevenue({ from: LUN.from, to: LUN.to, limit: 5, intervals: [LUN_W] })),
    ["Alfajor:300", "Gaseosa:200"],
    "K topRev"
  )
  assertEqual(
    lowNames(await api.getLowRotationProducts({ from: LUN.from, to: LUN.to, limit: 10, intervals: [LUN_W] })),
    ["Sin ventas:0", "Alfajor:3", "Gaseosa:4"],
    "K lowRot"
  )
  try {
    await call("stats:getSummary", { from: LUN.from, to: LUN.to, intervals: "x" })
    throw new Error("K: se esperaba un rechazo")
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error)
    assert(text.startsWith("[stats:getSummary]"), `K: el mensaje "${text}" no empieza con [stats:getSummary]`)
  }
  logStep("caso K: puente IPC con intervals")
}

async function main() {
  // La DB se crea ANTES de los require(): el Prisma client singleton lee DATABASE_URL al
  // cargarse. Por eso los require son tardíos.
  const testDb = createMigratedTestDb("stats-repository")
  process.env.DATABASE_URL = testDb.databaseUrl

  const stats = require("../repositories/statsRepository") as StatsModule
  const intervalsLib = require("../repositories/statsIntervals") as IntervalsModule
  const { buildIpcHandlers, invokeIpcHandler } = require("../../electron/ipcHandlers") as typeof import("../../electron/ipcHandlers")
  const { buildElectronApi } = require("../../electron/ipcContract") as typeof import("../../electron/ipcContract")
  const prisma = (require("../db/client") as { default: PrismaClient }).default

  try {
    await seed(prisma)
    await testPureHelpers(intervalsLib)
    await testLegacy(stats)
    await testWithIntervals(stats)
    await testValidation(stats)
    const handlers = buildIpcHandlers()
    const call = (channel: string, payload: unknown) => invokeIpcHandler(handlers, channel, payload)
    await testIpc(buildElectronApi(call), call)
    console.log("PASS: statsRepository — todos los casos")
  } finally {
    // Desconectar antes de borrar: en Windows el archivo abierto da EBUSY.
    await prisma.$disconnect()
    testDb.cleanup()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
