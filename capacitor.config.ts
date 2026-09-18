import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.maxupgrader.game',
  appName: 'MAX Upgrader',
  webDir: 'dist',
  android: {
    backgroundColor: '#111214',
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
}

export default config
