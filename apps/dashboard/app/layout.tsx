import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/action-feedback";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LaporPak | Dashboard Laporan",
  description: "Dashboard administrasi laporan warga desa.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
