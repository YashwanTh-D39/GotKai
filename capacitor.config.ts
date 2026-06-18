import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gotkai.app',
  appName: 'GotKai',
  webDir: 'out',
  server: {
    androidScheme: 'https',
       url: 'https://got-kai.vercel.app',
  },
};

export default config;
