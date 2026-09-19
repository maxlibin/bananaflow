import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { DialogHost } from "../components/ui/dialog-host";
import { LocalCanvasHostProvider } from "../host/client";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Banana Flow",
  description: "Open-source visual AI canvas for image and video generation.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Script id="banana-theme-init" src="/banana-theme-init.js" strategy="beforeInteractive" />
        <LocalCanvasHostProvider>
          {children}
          <DialogHost />
        </LocalCanvasHostProvider>
      </body>
    </html>
  );
}
