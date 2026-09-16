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
      // Admin and API responses must never be shared.
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      // Pages are the slow part: every visit re-renders the whole result set
      // server side (~2s even warm). Let the CDN hold a short shared copy so
      // most visits skip the origin entirely. s-maxage only affects shared
      // caches, not the browser, and 30s is well inside the client's own 5s
      // refresh cycle, so no draw can go stale on screen because of this.
      {
        source: "/:path*",
        headers: [{ key: "Cache-Control", value: "public, s-maxage=30, stale-while-revalidate=60" }],
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
