import type { Metadata } from "next";
import { AppProviders } from "@/components/AppProviders";
import "./globals.css";
import { Instrument_Sans } from "next/font/google";

const instrument_sans = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument_sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "My Store POS ERP",
  description: "Offline-first sanitary POS + mini ERP",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${instrument_sans.variable} font-sans`}>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
