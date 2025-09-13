import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  turbopack: {
    root: "/Users/aaronnebbs/freelancer-dev/esbuild-analyser",
  },
};

export default nextConfig;
