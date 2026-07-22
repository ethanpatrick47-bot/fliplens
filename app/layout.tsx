import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlipLens | Marketplace intelligence",
  description: "Understand any marketplace listing instantly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
