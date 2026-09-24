import type { NextConfig } from "next";

const nextConfig: NextConfig = {

  allowedDevOrigins: [
    "pedometer-endpoint-bulk.ngrok-free.dev",
    "pedometer-endpoint-bulk.ngrok-free.app", 
    "localhost:3000"
  ],
};

export default nextConfig;
