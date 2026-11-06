import type { Metadata, Viewport } from "next";
import "./globals.css";
import SpaceBackground from "@/components/space/SpaceBackground";
import { WebSocketProvider } from "@/providers/WebSocketProvider";
import { Suspense } from "react";

const demo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const basePath = demo ? (process.env.NEXT_PUBLIC_BASE_PATH ?? "/Spacial-Network") : "";
// Include the deployment path once. Absolute image URLs below prevent Next's
// metadata URL composition from appending that path a second time.
const siteUrl = new URL(
  demo
    ? `https://hussainhht.github.io${basePath}/`
    : `${(process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")}/`,
);
const description = demo
  ? "Explore Spatial Network, an immersive social platform for connecting people, sharing ideas, and discovering communities. Interactive demo with fictional local data and no live backend."
  : "Spatial Network is an immersive social platform for connecting people, sharing ideas, discovering communities, and exploring a universe of conversations.";
const socialImage = {
  url: new URL("branding/spatial-network-og.jpg", siteUrl),
  width: 1200,
  height: 630,
  alt: "Spatial Network — Connect Beyond Boundaries. A blue planet encircled by a glowing orbit against a dark starfield.",
};

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: "Spatial Network",
    template: "%s | Spatial Network",
  },
  description,
  applicationName: "Spatial Network",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Spatial Network",
    title: "Spatial Network",
    description,
    url: siteUrl,
    images: [socialImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "Spatial Network",
    description,
    images: [socialImage],
  },
  // App Router serves these files. List SVG/Apple links explicitly because this
  // Next version omits inferred icons when an `icons` object is also supplied.
  icons: {
    icon: [{ url: `${basePath}/icon.svg`, type: "image/svg+xml", sizes: "any" }],
    shortcut: `${basePath}/favicon.ico`,
    apple: [{ url: `${basePath}/apple-icon.png`, type: "image/png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SpaceBackground />
        <WebSocketProvider><Suspense>{children}</Suspense></WebSocketProvider>
      </body>
    </html>
  );
}
