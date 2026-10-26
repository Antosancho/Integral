# Modal

Ventana sobre la pantalla actual, con velo `overlay`. Anchos: `modal-sm` 440 (General F10), `modal-md` 640 (Producto, Cargar stock), `modal-lg` 820 (Buscador F2, Lotes).

## Anatomía
- **Cabecera**: título `title-lg`, bajada opcional, botón ✕ (ghost).
- **Cuerpo**: scroll propio si excede 84vh.
- **Pie** (`surface-sunken`): atajos a la izquierda; botones a la derecha (terciario → primario, el primario último).

## Comportamiento
- Al abrir: foco al primer campo (o al buscador). Foco atrapado dentro (focus trap). Al cerrar: el foco vuelve a quien lo abrió (en Ventas, **siempre** al input de código).
- `Esc` cierra/cancela (en pasos: vuelve al paso anterior). `Enter` confirma desde cualquier campo de una línea; `Ctrl+Enter` confirma formularios largos.
- Click en el velo cierra **solo** popups de búsqueda y General; los formularios con datos no se cierran por click fuera (evita perder lo tipeado).
- Entrada: fade del velo 120 ms + modal sube 8px y aparece en 160 ms (`ease-out`). Con `prefers-reduced-motion`: sin desplazamiento.
