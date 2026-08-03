import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // CRITIQUE pour une image Docker légère
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;