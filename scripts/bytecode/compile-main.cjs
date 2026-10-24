/**
 * scripts/bytecode/compile-main.cjs
 *
 * Compila el bundle del main (main.cjs) a bytecode de V8 (main.jsc) con bytenode.
 * Lo invoca el hook packageAfterPrune de forge.config.mts sobre la COPIA del
 * build que va al paquete (el .vite/ del proyecto no se toca).
 *
 * Uso: electron.exe compile-main.cjs <entrada.cjs> <salida.jsc>   (con ELECTRON_RUN_AS_NODE=1)
 *
 * ATENCIÓN — versión de Electron: compilar vía ELECTRON_RUN_AS_NODE solo es
 * válido hasta Electron 41. Desde Electron 42 (V8 ≥ 14.8) el bytecode generado
 * así hace abortar el main process (SIGTRAP) y hay que compilar dentro de un
 * main process real (`compileFile({ electronMain: true })`). Ver
 * node_modules/bytenode/README.md, "Known issues".
 */

// Se ejecuta con el binario de Electron del proyecto y ELECTRON_RUN_AS_NODE=1 (ver forge.config.mts).
// El bytecode de V8 solo es válido para la misma versión de Electron/V8 y la misma arquitectura.
const bytenode = require("bytenode")

const [input, output] = process.argv.slice(2)
if (!input || !output) {
  console.error("uso: compile-main.cjs <entrada.cjs> <salida.jsc>")
  process.exit(2)
}

Promise.resolve(bytenode.compileFile({ filename: input, output, compileAsModule: true }))
  .then(() => process.exit(0))
  .catch((error) => { console.error(error); process.exit(1) })
