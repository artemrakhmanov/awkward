import type { Metadata } from "next";
import { Caveat, Geist_Mono, Instrument_Sans } from "next/font/google";
import { BASE_URL } from "@/lib/config";
import "./globals.css";

const body = Instrument_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Handwriting, for labels on the corkboard.
const hand = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: "Awkward",
  description: "Your agent finds the other human. A board behind any event, place, link or thing.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${mono.variable} ${hand.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
