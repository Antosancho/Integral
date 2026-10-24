# Instalación de Integral

Guía para instalar Integral en la computadora del negocio.

## Requisitos

- Windows 10 u 11 de 64 bits.
- No hace falta instalar Node, Git ni ningún otro programa.

## Instalación nueva

1. Ejecutar `Integral-x.y.z Setup.exe` (por ejemplo `Integral-1.0.0 Setup.exe`).
2. Windows puede mostrar un aviso azul de **SmartScreen** ("Windows protegió su PC" / "editor desconocido"). Es normal: el instalador todavía no está firmado. Hacer clic en **"Más información"** y después en **"Ejecutar de todas formas"**.
3. La instalación no pide permisos de administrador y abre Integral sola al terminar. Deja un acceso directo "Integral" en el escritorio y en el menú Inicio.
4. La primera vez que se abre, Integral muestra la **licencia de uso**. Hay que leerla y elegir **"Acepto"** para seguir. Si se elige "No acepto", la aplicación se cierra (y la va a volver a pedir la próxima vez que se abra).

## Migración desde la versión anterior (la que se abría con `npm run dev`)

Si el negocio ya usaba Integral desde el código fuente, los datos están en el archivo `backend\prisma\dev.db` de la carpeta del proyecto. Para pasarlos a la versión instalada, seguir estos pasos **en este orden**:

1. **Cerrar** la versión vieja (cerrar la ventana de Integral y la terminal donde corría `npm run dev`).
2. Hacer una **copia de seguridad** de `backend\prisma\dev.db` en un pendrive o en la nube. No saltear este paso.
3. Crear la carpeta `%APPDATA%\Integral`: pegar `%APPDATA%` en la barra de direcciones del Explorador de archivos, apretar Enter y crear ahí una carpeta llamada `Integral` (si ya existe, usar esa).
4. Copiar `dev.db` dentro de `%APPDATA%\Integral` y **renombrar la copia** a `integral.db`.
   - Si al lado de `dev.db` hay un archivo `dev.db-journal`, la versión vieja no se cerró bien: volver al paso 1.
5. Recién ahora **ejecutar el instalador**. Al abrir, Integral actualiza la base de datos si hace falta y deja un respaldo automático al lado (`integral.db.backup-<fecha>`).
6. Verificar que aparezcan los productos y las ventas de siempre.

**Si ya se instaló antes de copiar los datos:** cerrar Integral, reemplazar `%APPDATA%\Integral\integral.db` por la copia renombrada de `dev.db` y volver a abrir Integral.

## Dónde están los datos

- Todos los datos del negocio están en un solo archivo: `%APPDATA%\Integral\integral.db`.
- **Copia de seguridad manual:** cerrar Integral y copiar ese archivo a un pendrive o a la nube. Conviene hacerlo seguido.

## Actualizar a una versión nueva

Ejecutar el `Setup.exe` de la versión nueva con Integral cerrado. Los datos se conservan. Si la versión nueva necesita cambiar la base de datos, lo hace sola al abrir y deja antes un respaldo (`integral.db.backup-<fecha>`).

## Desinstalar

Desde Configuración → Aplicaciones → Aplicaciones instaladas → Integral → Desinstalar.
Desinstalar **no borra los datos**: `%APPDATA%\Integral\integral.db` queda donde estaba. Si se vuelve a instalar, Integral los encuentra de nuevo.

## Si aparece "Error en la base de datos" al iniciar

- **No borrar nada.**
- En `%APPDATA%\Integral` buscar el archivo `integral.db.backup-…` más reciente (la fecha está en el nombre: año, mes, día, hora).
- Con Integral cerrado, renombrar el `integral.db` actual (por ejemplo a `integral.db.con-error`) y renombrar ese backup a `integral.db`. Volver a abrir Integral.
- Si el problema sigue, o el mensaje dice que la base fue actualizada por una versión más nueva, contactar a soporte y no tocar los archivos.
