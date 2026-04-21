import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/eseltokens',
  assetPrefix: '/eseltokens',
  trailingSlash: true,
  // eventuell temporär:
  // typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
