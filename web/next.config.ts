import type { NextConfig } from "next";

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  // Turbopackの日本語パス問題を回避
  turbopack: {
    root: process.cwd(),
  },
  // sharp 0.35 系は entry が lib/index.js から dist/index.cjs に移り、@vercel/nft の sharp 特例
  // （"sharp/lib/index.js" 判定で @img/sharp-libvips-* を同梱する処理）が効かなくなった。
  // さらに Vercel 上では Next がサーバートレースから sharp/@img/sharp-libvips* を除外するため、
  // libvips-cpp.so が関数バンドルに入らず sharp の import 時点で ERR_DLOPEN_FAILED になる
  // （2026-09-03 判明: /api/ocr と /api/grade が 7/22 の sharp 0.35.3 更新以降 500）。
  // sharp を import するルートに libvips の共有ライブラリを明示的に同梱する。
  outputFileTracingIncludes: {
    '/api/ocr': ['./node_modules/@img/sharp-libvips-*/**/*'],
    '/api/grade': ['./node_modules/@img/sharp-libvips-*/**/*'],
  },
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
