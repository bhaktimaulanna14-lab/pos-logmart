import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: [
    "pedometer-endpoint-bulk.ngrok-free.dev",
    "pedometer-endpoint-bulk.ngrok-free.app", 
    "localhost:3000"
  ],
};

export default nextConfig;