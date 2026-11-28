import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cesur.borsapatronu',
  appName: 'Borsa Patronu',
  webDir: 'dist',
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: '#121c44',
      style: 'DARK'
    }
  }
};

export default config;
