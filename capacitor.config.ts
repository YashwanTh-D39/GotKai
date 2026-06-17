import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gotkai.app',
  appName: 'GotKai',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    // After deploying to Vercel, set this to your production URL:
    // url: 'https://gotkai.vercel.app',
  },
};

export default config;
