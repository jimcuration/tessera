import type { Metadata, Viewport } from "next";
import { BRAND, BRAND_TAGLINE } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: BRAND,
  description: BRAND_TAGLINE,
};

export const viewport: Viewport = {
  themeColor: "#0E0E0F",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
