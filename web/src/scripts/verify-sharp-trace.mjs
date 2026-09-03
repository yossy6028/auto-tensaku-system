#!/usr/bin/env node
/**
 * ビルド後ガード: sharp を使う API ルートのトレース（.nft.json）に
 * @img/sharp-libvips-* の共有ライブラリ（libvips-cpp.so / .dylib）が含まれているか検査する。
 * 含まれていないと本番で sharp の import が ERR_DLOPEN_FAILED になり /api/ocr・/api/grade が 500 になる
 * （2026-09-03 に判明した障害の再発防止。vercel.json の buildCommand から実行）。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROUTES = ['ocr', 'grade'];
const LIB_PATTERN = /@img\/sharp-libvips-[^/]+\/lib\/libvips-cpp\./;
let failed = false;

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
  const hits = files.filter((f) => LIB_PATTERN.test(f));
  if (hits.length === 0) {
    console.error(`[verify-sharp-trace] ✗ /api/${route}: libvips 共有ライブラリがトレースに含まれていません（${files.length} files）`);
    failed = true;
  } else {
    console.log(`[verify-sharp-trace] ✓ /api/${route}: ${hits.join(', ')}`);
  }
}

if (failed) {
  console.error('[verify-sharp-trace] next.config.ts の outputFileTracingIncludes を確認してください。');
  process.exit(1);
}
