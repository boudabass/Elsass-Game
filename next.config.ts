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
            // 'self' (pas 'none') : le jeu est servi dans une iframe de même
            // origine (game-shell.tsx). L'arcade n'est plus embarquée ailleurs.
            value: "frame-ancestors 'self';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;