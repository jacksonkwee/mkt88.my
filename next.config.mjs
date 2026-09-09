/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: undefined,
  async redirects() {
    return [
      { source: "/4dresults", destination: "/", permanent: true },
      { source: "/4dresults/", destination: "/", permanent: true },
      { source: "/4d-results", destination: "/", permanent: true },
      { source: "/4d-results/", destination: "/", permanent: true },
    ];
  },
};
export default nextConfig;
