# Bolsillo

App web adaptable para registrar ingresos y gastos, consultar su historial, crear metas de ahorro y programar recordatorios.

## Iniciar la app

1. Usa Node.js 20.19+ o 22.12+.
2. Ejecuta `npm install`.
3. Ejecuta `npm run dev`.

Sin configurar servicios, los datos se guardan en el navegador de este dispositivo. **Descargar respaldo JSON** genera una copia portable. **Guardar historial en PDF** abre el diálogo de impresión del navegador; ahí selecciona **Guardar como PDF**.

## Activar inicio de sesión y sincronización

La interfaz de acceso usa Clerk y la nube usa Convex. Para activarlos:

1. Crea una aplicación en Clerk, elige los métodos de acceso y activa la integración de Convex.
2. Crea o vincula un proyecto de Convex con `npx convex dev`.
3. En el panel de Clerk, copia la clave pública (`pk_test_...`) y la URL de Frontend API (`https://...clerk.accounts.dev`).
4. Copia `.env.example` a `.env` y añade los valores:

   ```env
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
   VITE_CONVEX_URL=https://...convex.cloud
   ```

5. Configura el emisor de Clerk en el entorno de Convex:

   ```bash
   npx convex env set CLERK_JWT_ISSUER_DOMAIN https://...clerk.accounts.dev
   ```

6. Ejecuta `npx convex dev` para desplegar `auth.config.ts`, el esquema y las funciones. En otra terminal ejecuta `npm run dev`.

Al iniciar sesión, Bolsillo sincroniza ingresos, gastos, metas y recordatorios entre dispositivos. Las funciones de Convex comprueban la identidad y guardan cada conjunto de datos bajo el usuario autenticado. Sin esas claves, la app sigue funcionando en modo local.

## PWA

Vite genera el manifiesto y el service worker. Para probar la versión instalable, ejecuta `npm run build` y `npm run preview`.
