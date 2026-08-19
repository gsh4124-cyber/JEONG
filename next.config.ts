import type { NextConfig } from "next";

const checkDistDir = process.env.JEONG_DIST_DIR?.trim();

const nextConfig: NextConfig = {
  devIndicators: false,
  reactStrictMode: true,
  ...(checkDistDir ? { distDir: checkDistDir } : {}),
};

export default nextConfig;
