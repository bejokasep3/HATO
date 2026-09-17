import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Fix Prisma Client resolution with pnpm's symlinked node_modules
  outputFileTracingRoot: path.join(__dirname, "./"),

  // Allow CORS for mobile app (Expo Go) to access API routes
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, PATCH, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
};

export default nextConfig;
