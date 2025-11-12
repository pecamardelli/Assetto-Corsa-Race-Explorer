import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Race Explorer - Assetto Corsa Statistics",
  description: "View and analyze your Assetto Corsa race results and statistics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="bg-zinc-900 border-b border-zinc-800">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-6 hover:opacity-90 transition-opacity">
              <Image
                src="/assetto_corsa_logo.png"
                alt="Assetto Corsa"
                width={280}
                height={70}
                priority
                className="h-16 w-auto"
              />
              <div className="flex flex-col">
                <h1 className="text-3xl font-bold text-white tracking-tight">Race Explorer</h1>
                <p className="text-base text-zinc-400">Assetto Corsa Statistics</p>
              </div>
            </Link>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
