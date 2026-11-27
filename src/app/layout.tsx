import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChartMasters Terminal",
  description: "Professional market analysis workspace by ChartMasters",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
