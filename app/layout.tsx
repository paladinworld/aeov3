import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HVAC AI Visibility",
  description: "MVP audit workflow for HVAC AI search visibility."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
