import type { NextConfig } from "next";

const backendOrigin =
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN ?? "http://localhost:8080";
const backendUrl = new URL(backendOrigin);
const backendProtocol = backendUrl.protocol === "https:" ? "https" : "http";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: backendProtocol,
        hostname: backendUrl.hostname,
        port: backendUrl.port,
        pathname: "/uploads/**",
      },
    ],
    // The backend is always localhost in this app's current single-host
    // setup, which next/image otherwise blocks as a potential SSRF target.
    dangerouslyAllowLocalIP: true,
    unoptimized: process.env.NEXT_IMAGE_UNOPTIMIZED === "true",
  },
};

export default nextConfig;
