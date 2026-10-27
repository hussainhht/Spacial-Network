import type { NextConfig } from "next";

const backendOrigin =
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN ?? "http://localhost:8080";
const backendUrl = new URL(backendOrigin);
const backendProtocol = backendUrl.protocol === "https:" ? "https" : "http";
const demo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const nextConfig: NextConfig = {
  ...(demo ? {
    output: "export" as const,
    basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "/Spacial-Network",
    trailingSlash: true,
    env: { NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH ?? "/Spacial-Network" },
  } : {}),
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
    unoptimized: demo || process.env.NEXT_IMAGE_UNOPTIMIZED === "true",
  },
};

export default nextConfig;
