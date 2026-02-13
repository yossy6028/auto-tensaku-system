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

export const metadata: Metadata = {
  title: "EduShift AI — 国語記述問題の自動添削",
  description: "指導歴20年超のベテラン国語講師のノウハウとAIによる解析で、あなたの思考に寄り添うフィードバックを提供する自動添削システムです。",
  keywords: ["国語", "添削", "AI", "自動採点", "記述式", "受験", "教育"],
  authors: [{ name: "EduShift" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "自動添削システム",
  },
  openGraph: {
    title: "EduShift AI — 国語記述問題の自動添削",
    description: "指導歴20年超のベテラン国語講師のノウハウとAIによる解析で、あなたの思考に寄り添うフィードバックを提供します。",
    type: "website",
    locale: "ja_JP",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
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
