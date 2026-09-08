import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8080",
        pathname: "/uploads/**",
      },
    ],
    // The backend is always localhost in this app's current single-host
    // setup, which next/image otherwise blocks as a potential SSRF target.
    dangerouslyAllowLocalIP: true,
  },
};

export default nextConfig;
