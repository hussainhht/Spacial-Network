import type { NextConfig } from "next";

const backendOrigin =
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN || process.env.SITE_URL || "http://localhost:8080";
const backendUrl = new URL(backendOrigin);
const backendProtocol = backendUrl.protocol === "https:" ? "https" : "http";
const demo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  ...(demo ? {
    output: "export" as const,
    basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "/Spacial-Network",
    trailingSlash: true,
    env: { NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH ?? "/Spacial-Network" },
  } : { output: "standalone" as const }),
  images: {
    remotePatterns: [
      {
        protocol: backendProtocol,
        hostname: backendUrl.hostname,
        port: backendUrl.port,
        pathname: "/uploads/**",
      },
    ],
    // Only local development may optimize images from loopback addresses.
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
    unoptimized: demo || process.env.NEXT_IMAGE_UNOPTIMIZED === "true",
  },
};

export default nextConfig;
