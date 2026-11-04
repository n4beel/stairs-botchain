import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import WrongNetworkBar from "@/components/botchain/WrongNetworkBar";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-barlow-condensed",
});

export const metadata: Metadata = {
  title: "Stairs — Limited Editions on a Staircase",
  description: "Each copy costs more than the last. Sell back any time.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${barlow.variable} ${barlowCondensed.variable}`}>
      <body className="min-h-screen flex flex-col font-sans">
        <Providers>
          <WrongNetworkBar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
