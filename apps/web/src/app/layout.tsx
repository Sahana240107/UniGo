import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UniGo",
  description: "Daily commute ride sharing for college communities"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
