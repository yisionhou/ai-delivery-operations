import type { Metadata } from "next";
import "./globals.css";
import "./reference.css";
import "./region-focus.css";
import "./incidents/incident-focus.css";
import "maplibre-gl/dist/maplibre-gl.css";

export const metadata: Metadata = {
  title: "AI Delivery Operations",
  description: "Spatial delivery operations and autonomous incident recovery for Singapore.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
