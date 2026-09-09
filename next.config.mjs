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
};
export default nextConfig;
