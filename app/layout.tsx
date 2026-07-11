import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SA Auto Match — What's Your Trade Worth?",
  description:
    "Find out what your trade-in is worth and get matched to a vehicle and payment that fits. Fast, free, no obligation.",
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "SA Auto Match — What's Your Trade Worth?",
    description:
      "Find out what your trade-in is worth and get matched to a vehicle and payment that fits.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0B0B0D",
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
