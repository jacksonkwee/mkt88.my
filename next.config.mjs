/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: undefined,
  async redirects() {
    return [
      { source: "/4d-results", destination: "/4dresults", permanent: true },
      { source: "/4d-results/", destination: "/4dresults", permanent: true },
    ];
  },
  async headers() {
    return [
      // Android app downloads: force the browser to download the APK and treat
      // it as an Android package instead of rendering it as a text/binary file.
      {
        source: "/mkt88-4d-v1.7.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="mkt88-4d-v1.7.apk"' },
        ],
      },
      {
        source: "/mkt88-4d-v1.8.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="mkt88-4d-v1.8.apk"' },
        ],
      },
      {
        source: "/mkt88-4d-v1.9.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="mkt88-4d-v1.9.apk"' },
        ],
      },
      {
        source: "/mkt88-4d-v2.1.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="mkt88-4d-v2.1.apk"' },
        ],
      },
      {
        source: "/mkt88-4d-v2.2.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="mkt88-4d-v2.2.apk"' },
        ],
      },
      {
        source: "/mkt88-4d-v2.3.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="mkt88-4d-v2.3.apk"' },
        ],
      },
      {
        source: "/mkt88-4d-v2.4.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="mkt88-4d-v2.4.apk"' },
        ],
      },
      {
        source: "/mkt88-4d-v2.7.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="mkt88-4d-v2.7.apk"' },
        ],
      },
      {
        source: "/mkt88-4d-v2.8.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="mkt88-4d-v2.8.apk"' },
        ],
      },
      {
        source: "/mkt88-4d-v2.9.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="mkt88-4d-v2.9.apk"' },
        ],
      },
      {
        source: "/mkt88-4d-v2.10.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="mkt88-4d-v2.10.apk"' },
        ],
      },
      {
        source: "/mkt88-4d-v2.11.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="mkt88-4d-v2.11.apk"' },
        ],
      },
      {
        source: "/mkt88-4d-v2.19.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="mkt88-4d-v2.19.apk"' },
        ],
      },
      {
        // v2.21 is kept for older download links.
        source: "/mkt88-4d-v2.21.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="mkt88-4d-v2.21.apk"' },
        ],
      },
      {
        // Current build: carries exact-alarm support for lucky reminders.
        source: "/mkt88-4d-v2.26.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="mkt88-4d-v2.26.apk"' },
        ],
      },
      {
        // Current build: starts the WebView from a clean, cache-busted home page.
        source: "/mkt88-4d-v2.27.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="mkt88-4d-v2.27.apk"' },
        ],
      },
      {
        // Current build: keeps every mkt88.my navigation inside the App WebView.
        source: "/mkt88-4d-v2.28.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="mkt88-4d-v2.28.apk"' },
        ],
      },
      {
        // Current build: boot-time logo recovery and automatic WebView recovery.
        source: "/mkt88-4d-v2.29.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="mkt88-4d-v2.29.apk"' },
        ],
      },
      // Pages (and the phone app's WebView) must always revalidate, otherwise a
      // cached page shell can show an older draw for a long time.
      {
        source: "/:path*",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
      {
        source: "/",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
      // Hashed build assets never change - cache them hard.
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      // Local logo / picture assets.
      {
        source: "/sites/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
    ];
  },
};
export default nextConfig;
