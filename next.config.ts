import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir:
    process.env.PANDA_MODE === "production" ? ".next-production" : ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
};

export default nextConfig;
