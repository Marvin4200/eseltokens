import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  allowedDevOrigins: ['192.168.2.177'],
  // eventuell temporär:
  // typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
