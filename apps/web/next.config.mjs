/** @type {import('next').NextConfig} */
const nextConfig = {
  // Compile the workspace packages (shipped as TypeScript source) on the fly.
  transpilePackages: ["@offerben/core", "@offerben/db"],
  eslint: {
    // Keep `next build` from failing on lint; we still type-check.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
