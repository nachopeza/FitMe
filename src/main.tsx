import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider } from './features/store';
import { App } from './ui/App';
import { UIProvider } from './ui/shell';
import { Rescate, recargarAlActualizar } from './ui/recovery';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('No se encuentra el contenedor de la aplicación.');

// Si el service worker nuevo se hace cargo de esta pestaña, recargar: una
// página vieja con un servidor nuevo es lo que deja la app en blanco.
recargarAlActualizar();

createRoot(root).render(
  <StrictMode>
    <Rescate>
      <AppProvider>
        <UIProvider>
          <App />
        </UIProvider>
      </AppProvider>
    </Rescate>
  </StrictMode>,
);
