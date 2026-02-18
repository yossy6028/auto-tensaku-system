import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-noto-sans-jp",
});

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://auto-tensaku-system.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: "Taskal AI — 国語記述問題の自動添削",
  description: "指導歴20年超のベテラン国語講師のノウハウとAIによる解析で、あなたの思考に寄り添うフィードバックを提供する自動添削システムです。",
  keywords: ["国語", "添削", "AI", "自動採点", "記述式", "受験", "教育"],
  authors: [{ name: "Taskal AI" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "自動添削システム",
  },
  openGraph: {
    title: "Taskal AI — 国語記述問題の自動添削",
    description: "指導歴20年超のベテラン国語講師のノウハウとAIによる解析で、あなたの思考に寄り添うフィードバックを提供します。",
    type: "website",
    locale: "ja_JP",
    siteName: "Taskal AI",
    images: [
      {
        url: "/ogp.png",
        width: 1200,
        height: 630,
        alt: "Taskal AI — 国語記述問題の自動添削システム",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Taskal AI — 国語記述問題の自動添削",
    description: "指導歴20年超のベテラン国語講師のノウハウとAIによる解析で、あなたの思考に寄り添うフィードバックを提供します。",
    images: ["/ogp.png"],
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  alternates: {
    canonical: '/',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${inter.variable} ${notoSansJP.variable} font-sans antialiased`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
