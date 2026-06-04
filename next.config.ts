import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['*.devtunnels.ms', 'localhost:3000', 'fixture-predicciones-mundial.vercel.app']
    }
  }
};

export default nextConfig;
