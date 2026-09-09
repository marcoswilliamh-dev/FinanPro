import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.moni.app',
  appName: 'Moni',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    backgroundColor: '#111111'
  }
};

export default config;
