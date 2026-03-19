import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/dashboard/shared/Providers";

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
  title: "Polo — Autonomous Yields on Yo",
  description:
    "Polo scans USDC yields across Base, Ethereum — then moves your capital to the highest-earning Aave V3 pool automatically via LI.FI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark bg-background">
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans antialiased overflow-x-hidden`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
