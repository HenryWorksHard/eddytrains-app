import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.eddytrains.app',
  appName: 'EddyTrains',
  webDir: 'out',
  server: {
    // Load from live URL in production
    url: 'https://app.cmpdcollective.com',
    cleartext: false
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#000000'
  },
  android: {
    backgroundColor: '#000000'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#000000',
      showSpinner: false
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#000000'
    }
  }
};

export default config;
