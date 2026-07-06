import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "My Store POS ERP",
  description: "Admin-only POS + mini ERP for sanitary business"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
