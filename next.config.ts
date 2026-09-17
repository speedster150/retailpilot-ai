import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/sales/pos',
        destination: '/sales',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
