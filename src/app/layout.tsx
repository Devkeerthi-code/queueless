import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { ServiceWorker } from "@/components/service-worker";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });

export const metadata: Metadata = {
  title: { default: "QueueLess", template: "%s · QueueLess" },
  description: "Pre-order from the college canteen, pick a 15-minute pickup slot and collect with a token instead of queueing.",
  applicationName: "QueueLess",
  appleWebApp: { capable: true, title: "QueueLess", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f3ec" },
    { media: "(prefers-color-scheme: dark)", color: "#131210" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={archivo.variable}>
      <body className="grain font-sans antialiased">
        {children}
        <Toaster />
        <ServiceWorker />
      </body>
    </html>
  );
}
