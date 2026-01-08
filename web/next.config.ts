import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopackの日本語パス問題を回避
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
