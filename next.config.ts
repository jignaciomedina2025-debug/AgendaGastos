import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Static site for Cloudflare Pages (no Node server required).
  output: "export",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default withPWA(nextConfig);
