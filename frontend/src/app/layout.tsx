import type { Metadata } from "next";
import "./globals.css";
import { WebSocketProvider } from "@/context/WebSocketContext";

export const metadata: Metadata = {
  title: "Social Network",
  description: "Social Network application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <WebSocketProvider>{children}</WebSocketProvider>
      </body>
    </html>
  );
}