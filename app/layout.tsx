import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SA Auto Match — Find Your Vehicle Match",
  description:
    "Find a vehicle match, share your trade-in details, and request a visit. Fast, free, no obligation.",
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "SA Auto Match — Find Your Vehicle Match",
    description:
      "Find a vehicle match, share your trade-in details, and request a visit.",
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
