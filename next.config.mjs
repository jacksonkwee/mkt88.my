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
