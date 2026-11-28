import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cesur.borsapatronu',
  appName: 'Borsa Patronu',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: '#1e293b',
      style: 'DARK'
    }
  }
};

export default config;
