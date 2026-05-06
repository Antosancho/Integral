# Guía de instalación y uso — Sistema Integral

## Requisitos previos

- **Node.js 18 o superior** instalado en la máquina.
  Verificar con: `node --version`
- **Git** (solo si se actualiza el repo desde el origen).

---

## Primera instalación

```bash
# 1. Instalar dependencias (también genera el cliente de Prisma automáticamente)
npm install

# 2. Arrancar el sistema
npm run dev
```

---

## Arrancar el sistema (uso diario)

```bash
npm run dev
```

---

## Actualizar el sistema (cuando se recibe una versión nueva)

```bash
git pull
npm install
npm run prisma:deploy   # aplica migraciones de DB pendientes
npm run dev
```

> **Importante:** nunca omitir `npm run prisma:deploy` después de un `git pull`.
> Si hay migraciones pendientes y no se aplican, el sistema puede fallar al iniciar.

---

## Copia de seguridad de la base de datos

La base de datos vive en `backend/prisma/dev.db`.
Se recomienda copiar este archivo periódicamente (por ejemplo, al final de cada día de trabajo).
No existe un mecanismo de backup automático en esta versión.

---

## Limitaciones conocidas de esta versión

1. **Sin instalador**: el sistema corre con `npm run dev`. Requiere Node.js 18+ instalado.
2. **Sin backups automáticos**: la DB vive en `backend/prisma/dev.db`. Recomendar al
   cliente copiar este archivo periódicamente. Si se corrompe, no hay recovery.
3. **Sin migraciones automáticas en arranque**: si se actualiza el repo, hay que correr
   `npm run prisma:deploy` manualmente.
4. **Sin auth / multiusuario**: cualquiera con acceso a la PC puede operar como cajero.
5. **DevTools accesibles**: Ctrl+Shift+I abre el inspector. El cliente puede ver el
   código del renderer. Aceptado dado que igual recibe el repo completo.
6. **Sin cancelación de ventas**: una venta confirmada no se puede anular desde la UI.
   Si hay que corregir, se hace con `npm run prisma:studio` (manual).
7. **Stock puede ir negativo**: por diseño (alerta visible pero no bloquea). Cliente
   debe entender que es comportamiento esperado.
8. **El campo `purchasePriceSnapshot` puede ser null** en SaleItems creados antes de la
   migración `add_purchase_price_snapshot` — afecta cálculo de ganancia en Stats si se
   importan ventas viejas (en este momento N/A porque la DB se entrega vacía).
