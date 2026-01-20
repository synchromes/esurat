import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

import { Montserrat } from "next/font/google"; // Close to Gotham

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"], // 300 is Light
})

export const metadata: Metadata = {
  title: "E-Surat Digital | TVRI Kalimantan Barat",
  description: "Sistem Manajemen Dokumen Digital TVRI Kalimantan Barat - Kelola surat dan dokumen secara digital dengan fitur approval workflow, QR code verification, dan tanda tangan digital.",
  keywords: ["e-surat", "dokumen digital", "tvri", "surat digital", "workflow"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${inter.variable} ${montserrat.variable} font-sans antialiased`} suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
