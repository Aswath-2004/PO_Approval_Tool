import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PO Approval Tool",
  description: "MEP Purchase Order Analysis",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
