// Globals que inyecta @electron-forge/plugin-vite en el build del main.
// - MAIN_WINDOW_VITE_DEV_SERVER_URL: URL del dev server en `npm start`; undefined en el paquete.
// - MAIN_WINDOW_VITE_NAME: nombre del renderer ("main_window"), para armar la ruta del index.html en el paquete.
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined
declare const MAIN_WINDOW_VITE_NAME: string

// electron-squirrel-startup no trae tipos: vale true cuando Squirrel lanzó la app
// para un evento de instalación/actualización/desinstalación (hay que salir enseguida).
declare module "electron-squirrel-startup" {
  const started: boolean
  export default started
}
