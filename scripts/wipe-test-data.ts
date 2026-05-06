/**
 * scripts/wipe-test-data.ts
 *
 * Borra todos los datos de negocio de la DB y resetea los contadores de
 * autoincrement. Útil para dejar la base limpia antes de la entrega al cliente.
 *
 * Modos de uso:
 *   npx ts-node scripts/wipe-test-data.ts --dry-run   → imprime contadores, NO borra nada
 *   npx ts-node scripts/wipe-test-data.ts --confirm   → borra todo en una transacción
 *
 * Si no se pasa ningún flag el script aborta con exit code 1.
 */

import prisma from "../backend/db/client"

// El orden importa: las FK con onDelete: Restrict obligan a borrar las tablas
// hijo antes que las padre. Ver restricciones en backend/prisma/schema.prisma.
const DELETE_ORDER = [
  "salePayment",
  "saleItem",
  "stockMovement",
  "sale",
  "product",
  "category",
  "supplier",
] as const

type PrismaTable = (typeof DELETE_ORDER)[number]

// Prisma no expone un tipo genérico para acceso dinámico a modelos, por lo que
// usamos unknown con un cast explícito en cada llamada.
type TableDelegate = { count(): Promise<number>; deleteMany(): Promise<{ count: number }> }

function parseArgs(): { dryRun: boolean; confirm: boolean } {
  const args = process.argv.slice(2)
  return {
    dryRun: args.includes("--dry-run"),
    confirm: args.includes("--confirm"),
  }
}

/** Devuelve el delegate de Prisma para el nombre de tabla dado. */
function tableDelegate(client: typeof prisma, table: PrismaTable): TableDelegate {
  return (client as unknown as Record<PrismaTable, TableDelegate>)[table]
}

async function printCounts(client: typeof prisma, label: string): Promise<void> {
  console.log(`\n--- Contadores ${label} ---`)
  for (const table of DELETE_ORDER) {
    const n = await tableDelegate(client, table).count()
    console.log(`  ${table}: ${n} filas`)
  }
}

async function main(): Promise<void> {
  const { dryRun, confirm } = parseArgs()

  // Ni --dry-run ni --confirm → abortar para evitar ejecución accidental
  if (!dryRun && !confirm) {
    console.error("Error: debés pasar --dry-run o --confirm para ejecutar el script.")
    console.error("  --dry-run  Muestra contadores sin borrar nada.")
    console.error("  --confirm  Borra todos los datos y resetea autoincrement.")
    process.exit(1)
  }

  // Mostrar la URL de la DB para que el operador pueda verificar antes de continuar
  console.log(`Operando sobre DATABASE_URL=${process.env.DATABASE_URL}`)

  await printCounts(prisma, "ANTES")

  if (dryRun) {
    console.log("\nDRY RUN — no se borró nada.")
    await prisma.$disconnect()
    process.exit(0)
  }

  // --- Borrado en transacción atómica ---
  // Todo dentro de una sola transacción para que si falla a la mitad no queden
  // datos parciales. El reset de autoincrement también va dentro.
  await prisma.$transaction(async (tx) => {
    const txClient = tx as unknown as Record<PrismaTable, TableDelegate>

    for (const table of DELETE_ORDER) {
      const result = await txClient[table].deleteMany()
      console.log(`Deleted ${result.count} from ${table}`)
    }

    // Resetear los contadores de autoincrement de SQLite.
    // La tabla sqlite_sequence solo existe si alguna vez se hizo un INSERT
    // en una tabla con AUTOINCREMENT. Si la DB estuvo siempre vacía, no existe
    // y el error se ignora de forma segura.
    try {
      await (tx as { $executeRawUnsafe(query: string): Promise<unknown> }).$executeRawUnsafe(
        "DELETE FROM sqlite_sequence"
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes("no such table: sqlite_sequence")) {
        // DB nunca tuvo datos con autoincrement: el reset es innecesario.
        console.log("sqlite_sequence no existe — autoincrement no estaba activado, se omite el reset.")
      } else {
        throw err
      }
    }
  })

  await printCounts(prisma, "DESPUÉS")

  console.log("\n✓ Wipe completo")
  console.log("✓ Todas las tablas en 0 filas")
  console.log("✓ Autoincrement reseteado")
  console.log("DB lista para entrega.")

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
