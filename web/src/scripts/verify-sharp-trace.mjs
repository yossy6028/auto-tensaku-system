#!/usr/bin/env node
/**
 * ビルド後ガード: sharp を使う API ルートのトレース（.nft.json）に、
 * ビルド環境のプラットフォームに対応する sharp ネイティブアドオン（@img/sharp-<platform>-<arch>/lib/sharp-*.node）と
 * libvips 共有ライブラリ（@img/sharp-libvips-<platform>-<arch>/lib/libvips-cpp.so|.dylib）が含まれているか検査する。
 * 含まれていないと本番で sharp の import が ERR_DLOPEN_FAILED になり /api/ocr・/api/grade が 500 になる
 * （2026-09-03 に判明した障害の再発防止。vercel.json の buildCommand から実行）。
 * Vercel の関数ランタイムは linux-x64 (glibc) なので、linux では musl 版（linuxmusl-x64）を合格扱いにしない。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROUTES = ['ocr', 'grade'];
const platformTag = `${process.platform}-${process.arch}`; // 例: linux-x64 / darwin-arm64
const libExt = process.platform === 'darwin' ? 'dylib' : process.platform === 'win32' ? 'dll' : 'so';
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CHECKS = [
  {
    label: 'libvips 共有ライブラリ',
    pattern: new RegExp(`@img/sharp-libvips-${escape(platformTag)}/lib/libvips-cpp\\.(?:${libExt}|[\\d.]+\\.${libExt})`),
  },
  {
    label: 'sharp ネイティブアドオン',
    pattern: new RegExp(`@img/sharp-${escape(platformTag)}/lib/sharp-${escape(platformTag)}-[\\d.]+\\.node$`),
  },
];
let failed = false;

console.log(`[verify-sharp-trace] platform=${platformTag} (期待する共有ライブラリ拡張子: .${libExt})`);
for (const route of ROUTES) {
  const nftPath = resolve('.next/server/app/api', route, 'route.js.nft.json');
  let files;
  try {
    files = JSON.parse(readFileSync(nftPath, 'utf8')).files;
  } catch (error) {
    console.error(`[verify-sharp-trace] ✗ ${nftPath} を読めません: ${error.message}`);
    failed = true;
    continue;
  }
  for (const { label, pattern } of CHECKS) {
    const hits = files.filter((f) => pattern.test(f));
    if (hits.length === 0) {
      console.error(`[verify-sharp-trace] ✗ /api/${route}: ${label}（${pattern}）がトレースに含まれていません（${files.length} files）`);
      failed = true;
    } else {
      console.log(`[verify-sharp-trace] ✓ /api/${route}: ${label} → ${hits.join(', ')}`);
    }
  }
}

if (failed) {
  console.error('[verify-sharp-trace] next.config.ts の outputFileTracingIncludes と sharp の optionalDependencies を確認してください。');
  process.exit(1);
}
