import { ConvexClient } from 'convex/browser';
import { anyApi } from 'convex/server';

export const financeApi = anyApi.finance;
export type ClerkSession = {
  isSignedIn: boolean;
  user?: { id?: string; primaryEmailAddress?: { emailAddress: string } | null; username?: string | null } | null;
  session?: { getToken: (options: { template: string }) => Promise<string | null> } | null;
  addListener: (callback: () => void) => () => void;
  mountSignIn: (element: HTMLDivElement) => void;
  unmountSignIn: (element: HTMLDivElement) => void;
  signOut: () => Promise<void>;
  load: (options: { ui: { ClerkUI: unknown } }) => Promise<void>;
};
export type CloudSession = { clerk: ClerkSession; convex: ConvexClient };

type ClerkWindow = Window & {
  Clerk?: ClerkSession;
  __internal_ClerkUICtor?: unknown;
};

function loadScript(src: string, publishableKey?: string): Promise<void> {
  if ([...document.scripts].some(script => script.src === src)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    if (publishableKey) script.dataset.clerkPublishableKey = publishableKey;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar el formulario seguro de inicio de sesión.'));
    document.head.append(script);
  });
}

export async function createCloudSession(): Promise<CloudSession | null> {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  const convexUrl = import.meta.env.VITE_CONVEX_URL;
  if (!publishableKey || !convexUrl) return null;

  const encodedDomain = publishableKey.split('_')[2];
  if (!encodedDomain) throw new Error('La clave pública de Clerk no tiene un formato válido.');
  const clerkDomain = atob(encodedDomain).slice(0, -1);
  const global = window as ClerkWindow;
  await loadScript(`https://${clerkDomain}/npm/@clerk/ui@1/dist/ui.browser.js`);
  await loadScript(`https://${clerkDomain}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`, publishableKey);
  const ui = global.__internal_ClerkUICtor;
  if (!ui) throw new Error('Clerk no cargó su interfaz de acceso.');
  if (!global.Clerk) throw new Error('Clerk no pudo iniciar en este navegador.');
  const clerk = global.Clerk;
  await clerk.load({ ui: { ClerkUI: ui } });

  const convex = new ConvexClient(convexUrl);
  convex.setAuth(async () => clerk.session?.getToken({ template: 'convex' }) ?? null);
  return { clerk, convex };
}
