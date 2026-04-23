import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ServiceWorkerRegister } from "./service-worker-register";

export const metadata: Metadata = {
  title: "BPHealth",
  description: "A simple personal blood pressure tracker for mobile use.",
  manifest: "/manifest.webmanifest",
  applicationName: "BPHealth",
  icons: [
    {
      rel: "icon",
      url: "/icon.svg",
      type: "image/svg+xml",
    },
    {
      rel: "apple-touch-icon",
      url: "/icon-maskable.svg",
      type: "image/svg+xml",
    },
  ],
  appleWebApp: {
    capable: true,
    title: "BPHealth",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0f14",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
