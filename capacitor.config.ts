import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.numa.app',
  appName: 'Numa',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    backgroundColor: '#000000'
  }
};

export default config;
