# Bolsillo

App web adaptable para registrar ingresos y gastos, consultar el historial, crear metas de ahorro y programar recordatorios.

## Desarrollo local

Requiere Node.js 20.19+ o 22.12+.

```bash
npm install
npx convex dev
```

En otra terminal, crea `.env.local` en la raíz con los valores de desarrollo:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_tu_clave_de_clerk
VITE_CONVEX_URL=https://tu-deployment.convex.cloud
```

Activa la integración Convex en tu aplicación Clerk de desarrollo y configura su Frontend API URL como emisor del despliegue de desarrollo:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN "https://tu-instancia.clerk.accounts.dev"
```

En una tercera terminal ejecuta `npm run dev` y abre la URL que muestra Vite. `.env.local` no se sube a Git.

Sin credenciales, la app funciona en modo local y guarda datos en el navegador. Puedes descargar una copia JSON o imprimir el historial y guardarlo como PDF.

## Publicar

### Convex de producción

1. En Clerk, configura la instancia de producción, activa la integración Convex y copia su Frontend API URL y Publishable key (`pk_live_...`). Usa la misma instancia en Convex y en el frontend.
2. Configura el emisor y despliega desde la raíz del proyecto:

   ```bash
   npx convex env set --prod CLERK_JWT_ISSUER_DOMAIN "URL_FRONTEND_API_DE_CLERK_PRODUCCIÓN"
   npx convex deploy
   ```

   Confirma el despliegue con `Y` si la CLI lo pregunta. Anota la URL de producción que termina en `.convex.cloud`.

### Web en Vercel

1. Importa el repositorio `TUWINS/bolsillo` en Vercel. `vercel.json` ya define instalación (`npm ci`), compilación (`npm run build`) y salida (`dist`).
2. En **Project → Settings → Environment Variables**, agrega para **Production**:

   ```env
   VITE_CLERK_PUBLISHABLE_KEY=pk_live_tu_clave_de_clerk
   VITE_CONVEX_URL=https://tu-deployment-de-produccion.convex.cloud
   ```

3. Guarda y vuelve a desplegar. Autoriza el dominio asignado por Vercel en Clerk si el panel lo solicita.

Vercel no lee `.env` ni `.env.local`; las variables de producción se agregan en su panel. No publiques claves secretas. Los cambios posteriores en `main` generan un despliegue nuevo cuando el repositorio está conectado.
