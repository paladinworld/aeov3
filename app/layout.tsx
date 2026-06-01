import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Netic · AI Visibility Tracker",
  description: "Track how often AI assistants recommend your home-services company across ChatGPT and Gemini."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
