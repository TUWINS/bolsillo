import { render } from 'solid-js/web';
import App from './App';
import { createCloudSession } from './cloud';
import './styles.css';

async function startApp() {
  let cloud = null;
  let cloudError: string | null = null;
  try {
    cloud = await createCloudSession();
  } catch (error) {
    cloudError = error instanceof Error ? error.message : 'No se pudo iniciar el acceso con cuenta.';
  }
  render(() => <App cloud={cloud} cloudError={cloudError}/>, document.getElementById('root')!);
}

void startApp();
