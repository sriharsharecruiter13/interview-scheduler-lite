import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Exec Scheduling Assistant",
  description: "Internal tool for TACs and EAs to coordinate executive interview availability",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">
        {children}
      </body>
    </html>
  );
}

