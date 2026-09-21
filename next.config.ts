import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root to this project so parent
  // directories (e.g. OneDrive / home) lockfiles are ignored.
  turbopack: { root: process.cwd() },
};

export default nextConfig;
