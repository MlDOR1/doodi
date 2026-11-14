import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_ORIGIN ?? "http://localhost:3000"),
  openGraph: { siteName: "DOODI", type: "website", locale: "th_TH" },
  title: { default: "DOODI MOVIE REVIEW — รีวิวหนังจากคนดูจริง", template: "%s · DOODI" },
  description: "ดูดี (DOODI) ชุมชนรีวิวหนังภาษาไทย อ่านรีวิว เปรียบเทียบคะแนน และเก็บหนังที่อยากดูไว้ในรายการของคุณ",
};

export const viewport: Viewport = { themeColor: "#0a0506", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="flex min-h-dvh flex-col">
        <ToastProvider>
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </ToastProvider>
      </body>
    </html>
  );
}
