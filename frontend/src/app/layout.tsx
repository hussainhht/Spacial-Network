import type { Metadata, Viewport } from "next";
import "./globals.css";
import SpaceBackground from "@/components/space/SpaceBackground";
import { WebSocketProvider } from "@/providers/WebSocketProvider";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Social Network",
  description: "Social Network application",
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
