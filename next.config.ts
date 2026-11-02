import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Uploads go through server actions; keep in sync with MAX_UPLOAD_MB.
      bodySizeLimit: "60mb",
    },
  },
};

export default nextConfig;
