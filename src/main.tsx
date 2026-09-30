import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider } from './features/store';
import { App } from './ui/App';
import { UIProvider } from './ui/shell';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('No se encuentra el contenedor de la aplicación.');

createRoot(root).render(
  <StrictMode>
    <AppProvider>
      <UIProvider>
        <App />
      </UIProvider>
    </AppProvider>
  </StrictMode>,
);
