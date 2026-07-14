import type { Metadata } from "next";
import "./globals.css";
import { Instrument_Sans } from "next/font/google";

const instrument_sans = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument_sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Faiz Traders",
  description: "Admin-only POS + mini ERP for sanitary business"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={instrument_sans.variable}>
      <body>{children}</body>
    </html>
  );
}
