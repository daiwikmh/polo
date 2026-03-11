import type { Metadata } from "next";
import {
  IBM_Plex_Sans,
  IBM_Plex_Mono,
  Bebas_Neue,
  Space_Grotesk,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";
import Providers from "@/components/dashboard/shared/Providers";
import { SmoothScroll } from "@/components/landing/SmoothScroll";

const ibmPlexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-sans",
});
const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
});
const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
});
const spaceGrotesk = Space_Grotesk({
  variable: "--font-dashboard-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-dashboard-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "BRAHMA — Autonomous Cross-Chain Yield Agent",
  description:
    "brahma scans USDC yields across Base, Arbitrum, Optimism, and Polygon — then moves your capital to the highest-earning Aave V3 pool automatically via LI.FI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark bg-background">
      <body
        className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} ${bebasNeue.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans antialiased overflow-x-hidden`}
      >
        <div className="noise-overlay" aria-hidden="true" />
        <Providers>
          <SmoothScroll>{children}</SmoothScroll>
        </Providers>
      </body>
    </html>
  );
}
