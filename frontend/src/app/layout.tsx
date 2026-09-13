import type { Metadata, Viewport } from "next";
import "./globals.css";
import SpaceBackground from "@/components/space/SpaceBackground";
import { WebSocketProvider } from "@/providers/WebSocketProvider";
import { PlanetPreferenceProvider } from "@/features/planet-preference/context/PlanetPreferenceProvider";

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
        <PlanetPreferenceProvider>
          <WebSocketProvider>{children}</WebSocketProvider>
        </PlanetPreferenceProvider>
      </body>
    </html>
  );
}