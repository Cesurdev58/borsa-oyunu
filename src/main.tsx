import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {AppErrorBoundary} from './components/AppErrorBoundary';
import './index.css';
import { setNativeStatusBarTheme, setupNativeStatusBar } from './nativeStatusBar';
import { setupNativeBackButton } from './nativeBackButton';
import { applyTheme } from './components/game/ui/theme';
import { UISettingsStore } from './state/uiSettingsStore';

// Kayıtlı temayı ilk çizimden önce uygula (açılışta renk sıçraması olmasın)
const startTheme = applyTheme(UISettingsStore.loadSettings().theme);
void setupNativeStatusBar().then(() => setNativeStatusBarTheme(startTheme));
void setupNativeBackButton();

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
