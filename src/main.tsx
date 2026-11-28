import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {AppErrorBoundary} from './components/AppErrorBoundary';
import './index.css';
import { setupNativeStatusBar } from './nativeStatusBar';
import { setupNativeBackButton } from './nativeBackButton';

void setupNativeStatusBar();
void setupNativeBackButton();

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
