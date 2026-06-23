import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.codpromo.app',
  appName: 'CODpromo',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  ios: {
    backgroundColor: '#000000',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#000000',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
  },
};

export default config;
