import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mkt88.app",
  appName: "MKT 4D",
  webDir: "www",
  server: {
    url: "https://www.mkt88.my",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
