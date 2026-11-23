import type { Metadata, Viewport } from "next";
import { Manrope, Unbounded } from "next/font/google";
import { CartProvider } from "@/components/cart";
import "./globals.css";

const unbounded = Unbounded({ variable: "--font-unbounded", subsets: ["latin"], weight: ["500", "600"] });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Atmosfera Cafe | Order ahead for pickup",
  description: "Order your coffee ahead and pick it up at Atmosfera Cafe.",
  icons: {
    icon: [{ url: "/brand/atmosfera-app-icon-32.png", sizes: "32x32" }],
    apple: [{ url: "/brand/atmosfera-app-icon-180.png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#2A1B3D",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${unbounded.variable} ${manrope.variable} min-h-dvh antialiased`}>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
