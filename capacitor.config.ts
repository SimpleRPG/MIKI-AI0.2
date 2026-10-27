import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.miki.ai',
  appName: 'Miki AI',
  // `dist` retains the Termux Node server bundle; APK sync selects a sanitized web-only bundle.
  webDir: process.env.MIKI_CAPACITOR_WEB_DIR || 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
};

export default config;
