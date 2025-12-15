/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { TrialEndedModal } from "@/components/TrialEndedModal";
import { FreeAccessBanner } from "@/components/FreeAccessBanner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-noto-sans-jp",
});

export const metadata: Metadata = {
  title: "中学・高校受験記述問題自動添削システム",
  description: "指導歴20年超のベテラン国語講師のノウハウとAIによる解析で、あなたの思考に寄り添うフィードバックを提供する自動添削システムです。",
  keywords: ["国語", "添削", "AI", "自動採点", "記述式", "受験", "教育"],
  authors: [{ name: "EduShift" }],
  openGraph: {
    title: "中学・高校受験記述問題自動添削システム",
    description: "指導歴20年超のベテラン国語講師のノウハウとAIによる解析で、あなたの思考に寄り添うフィードバックを提供します。",
    type: "website",
    locale: "ja_JP",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${inter.variable} ${notoSansJP.variable} font-sans antialiased flex flex-col min-h-screen bg-slate-50 text-slate-900`}>
        <AuthProvider>
          <FreeAccessBanner />
          <TrialEndedModal />
          <div className="flex-grow">
            {children}
          </div>

          {/* Footer */}
          <footer className="bg-slate-800 text-slate-300 py-8 mt-auto">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center">
                  <img
                    src="/logo.jpg"
                    alt="EduShift Logo"
                    className="w-8 h-8 rounded-lg mr-3"
                  />
                  <span className="font-bold text-white">EduShift</span>
                </div>

                <nav className="flex flex-wrap justify-center gap-6 text-sm">
                  <Link
                    href="/"
                    className="hover:text-white transition-colors"
                  >
                    トップページ
                  </Link>
                  <Link
                    href="/pricing"
                    className="hover:text-white transition-colors"
                  >
                    料金プラン
                  </Link>
                  <Link
                    href="/privacy"
                    className="hover:text-white transition-colors"
                  >
                    本アプリケーションについて（プライバシーポリシー他）
                  </Link>
                </nav>

                <p className="text-xs text-slate-400">
                  © 2025 EduShift. All rights reserved.
                </p>
              </div>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
