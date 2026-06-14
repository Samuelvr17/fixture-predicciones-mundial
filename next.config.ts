import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.11'],
  experimental: {
    serverActions: {
      allowedOrigins: ['*.devtunnels.ms', 'localhost:3000', 'fixture-predicciones-mundial.vercel.app']
    }
  }
};

export default nextConfig;
