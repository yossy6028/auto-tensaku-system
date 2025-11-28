import { fileURLToPath } from "url";
import type { NextConfig } from "next";
import path from "path";

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: dirname, // Turbopackのroot誤検出を防ぐ
  },
  
  // セキュリティヘッダー
  async headers() {
    return [
      {
        // すべてのルートに適用
        source: "/:path*",
        headers: [
          {
            // クリックジャッキング防止
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            // MIMEスニッフィング防止
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            // XSS保護（レガシーブラウザ向け）
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            // リファラー情報の制御
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            // ブラウザ機能へのアクセス制限
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
      {
        // APIルートに追加のセキュリティヘッダー
        source: "/api/:path*",
        headers: [
          {
            // キャッシュ制御（機密データをキャッシュしない）
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Expires",
            value: "0",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
