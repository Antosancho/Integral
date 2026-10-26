# Picker

Selector de entidad con **alta en el momento** (patrón "explorador de Windows"): elegir de la lista o crear uno nuevo sin salir del formulario del producto.

## Flujo
1. El campo se ve como un botón con valor (`ig-picker`). Enter, Espacio, ↓ o click → abre el popover anclado debajo (`ig-picker-pop`, 420px).
2. El foco va al buscador interno; filtra en vivo y resalta la coincidencia en **negrita**.
3. ↑/↓ mueven `is-active`; Enter elige y cierra; Esc cierra sin cambios y devuelve el foco al campo.
4. Último ítem fijo: **"+ Crear «texto buscado»"** (`ig-picker-create`). Al activarlo se despliega in situ `ig-picker-new` con el nombre precargado (Proveedor suma Teléfono y Notas, opcionales).
5. "Crear y elegir" guarda, selecciona y cierra. Si el nombre ya existe: error inline "Ya existe «X». Elegilo de la lista."

## Reglas
- Sin coincidencias: la lista muestra "No hay categorías con «x»" y el botón crear queda activo (`is-active`) para que Enter cree directamente.
- Cada ítem de proveedor muestra metadato (cantidad de productos) en `ink-subtle`.
- El popover no es un modal: no oscurece; se cierra con click fuera.
