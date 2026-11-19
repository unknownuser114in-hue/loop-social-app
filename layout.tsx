import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Loop · A little closer, every day",
  description: "Follow your people, share everyday moments, and keep in touch on Loop.",
};
export const viewport: Viewport = { themeColor: "#131315", colorScheme: "dark" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
