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
      // Pages (and the phone app's WebView) must always revalidate, otherwise a
      // cached page shell can show an older draw for a long time.
      {
        source: "/:path*",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
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