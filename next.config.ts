import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.56.1"],
  images: {
    // Allow unoptimized local images from public folder
    unoptimized: true,
  },
};

export default nextConfig;
