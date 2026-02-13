/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { TrialEndedModal } from "@/components/TrialEndedModal";
import { FreeAccessBanner } from "@/components/FreeAccessBanner";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900">
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
                src="/logo-edushift.png"
                alt="EduShift"
                className="h-10 w-auto brightness-0 invert mr-3"
              />
            </div>

            <nav className="flex flex-wrap justify-center gap-6 text-sm">
              <Link
                href="/"
                className="hover:text-white transition-colors"
              >
                トップページ
              </Link>
              <Link
                href="/grading"
                className="hover:text-white transition-colors"
              >
                添削を始める
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
                本アプリケーションについて
              </Link>
            </nav>

            <p className="text-xs text-slate-400">
              © 2025 EduShift. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
