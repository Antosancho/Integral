# ScreenProductEdit

Modal **Editar producto**: mismo formulario pre-rellenado.

- Bajada del título = nombre actual del producto.
- **Stock** en solo lectura (`is-readonly`) con ayuda "Para modificar el stock usá «Cargar stock»". Opcional: link en la ayuda que abre Cargar stock con el producto en paso 2.
- Sin campo Vencimiento del lote.
- Ejemplo de error: código duplicado, mensaje con el nombre del producto que ya lo usa. El modal no se cierra.
- Botón primario: "Guardar cambios" (habilitado siempre; si no hubo cambios, solo cierra).
