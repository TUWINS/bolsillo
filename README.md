# Bolsillo

App web adaptable para registrar ingresos y gastos, consultar el historial, crear metas de ahorro y programar recordatorios.

## Desarrollo local

Requiere Node.js 20.19+ o 22.12+.

```bash
npm install
npx convex dev
```



Activa la integración Convex en tu aplicación Clerk de desarrollo y configura su Frontend API URL como emisor del despliegue de desarrollo:




Sin credenciales, la app funciona en modo local y guarda datos en el navegador. Puedes descargar una copia JSON o imprimir el historial y guardarlo como PDF.

## Publicar

### Convex de producción

1. En Clerk, configura la instancia de producción, activa la integración Convex y copia su Frontend API URL y Publishable key (`pk_live_...`). Usa la misma instancia en Convex y en el frontend.
2. Configura el emisor y despliega desde la raíz del proyecto:

   Confirma el despliegue con `Y` si la CLI lo pregunta. Anota la URL de producción que termina en `.convex.cloud`.

### Web en Vercel

1. Importa el repositorio `TUWINS/bolsillo` en Vercel. `vercel.json`

