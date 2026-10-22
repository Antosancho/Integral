/**
 * backend/__tests__/helpers/useIsolatedDb.ts
 *
 * Módulo de **efecto secundario** (mismo patrón que `electron/setupEnv.ts`).
 * Se importa como **primer import** de los scripts de integración
 * (`backend/test.ts`, `backend/testIpcBridge.ts`):
 *
 *   import "./__tests__/helpers/useIsolatedDb"
 *
 * Al evaluarse crea una DB temporal desde migraciones y deja `DATABASE_URL`
 * apuntando a ella **antes** de que cualquier otro import cargue el Prisma
 * client singleton (`backend/db/client`). Si otro import se evaluara antes,
 * Prisma quedaría conectado a `dev.db`; `integration-isolation.test.ts`
 * detecta ese error.
 */

import { createMigratedTestDb } from "./testDb"

// Pisa DATABASE_URL a propósito: los tests de integración NUNCA deben tocar dev.db.
const testDb = createMigratedTestDb("integration")
process.env.DATABASE_URL = testDb.databaseUrl

// Guarda defensiva: si por algún cambio futuro la URL no apunta a una DB de
// test, cortamos acá en lugar de arriesgar escribir sobre datos reales.
if (!process.env.DATABASE_URL.includes("/test-")) {
  throw new Error(
    `useIsolatedDb: DATABASE_URL no apunta a una DB de test (${process.env.DATABASE_URL})`
  )
}

// Al terminar el proceso (éxito o error) se borra la DB temporal.
// Los handlers de "exit" solo admiten código sincrónico; cleanup() lo es.
process.on("exit", () => testDb.cleanup())
