# EduShift AI - Design System Rules

> Figma → Code 実装ガイド。Figma MCP (Model Context Protocol) 経由でデザインをコードに変換する際の参照ドキュメント。

---

## 1. Token Definitions（デザイントークン）

### 定義場所
- **CSS変数**: `web/src/app/globals.css` — `:root` で定義
- **Tailwind テーマ**: 同ファイルの `@theme inline` ブロックで Tailwind クラス化

### カラートークン

#### 現行パレット
```css
:root {
  --background: #ffffff;
  --foreground: #171717;
  --es-teal: #2DB3A0;      /* Primary — CTA、アクセント */
  --es-blue: #1565C0;      /* Secondary — 特長、ハイライト */
  --es-dark-blue: #0D47A1; /* Tertiary — Hero背景、深い要素 */
}
```

#### 確定パレット（2026-02-13 確定）

> Figma Variables に `brand/`, `surface/`, `text/`, `accent/` の階層で登録

```
Brand Colors:
  brand/teal:            #2DB3A0  — Primary CTA, アクセント
  brand/teal-dark:       #249688  — CTA ホバー ★NEW
  brand/teal-light:      #E6F7F5  — Tealアクセント背景 ★NEW
  brand/blue:            #1565C0  — Secondary, 特長
  brand/blue-light:      #E3F2FD  — Blueアクセント背景 ★NEW
  brand/dark-blue:       #0D47A1  — Hero背景, 深い要素
  brand/dark-blue-light: #E8EAF6  — Dark Blueアクセント背景 ★NEW

Accent Colors:
  accent/amber:          #F59E0B  — バッジ, 星評価, 注目要素 ★NEW
  accent/amber-light:    #FEF3C7  — ハイライト背景 ★NEW
  accent/amber-dark:     #D97706  — バッジテキスト ★NEW

Surface Colors:
  surface/white:         #FFFFFF  — カード, ベース背景
  surface/light:         #F8FAFC  — ライトセクション背景 (slate-50)
  surface/teal:          #F0FDFA  — ティール系セクション背景 ★NEW
  surface/dark:          #0F172A  — ダークセクション (slate-900)
  surface/deep-navy:     #0A1628  — Hero/CTA 深い背景 ★NEW

Text Colors:
  text/on-light:           #171717  — ライト背景の見出し
  text/on-light-secondary: #475569  — ライト背景の本文 (slate-600)
  text/on-dark:            #FFFFFF  — ダーク背景の見出し
  text/on-dark-secondary:  #CBD5E1  — ダーク背景の本文 (slate-300)
  text/on-dark-tertiary:   #94A3B8  — 補助テキスト (slate-400)

Semantic Colors:
  Success:     #10B981 (emerald-500)
  Warning:     #F59E0B (amber-500)
  Error:       #EF4444 (red-500)
  Info:        #3B82F6 (blue-500)
```

#### デザイン決定事項
- **SolutionSection**: Before=グレー系(#F1F5F9/#64748B) / After=Teal系(#E6F7F5/#2DB3A0) — ブランド統一重視
- **ProblemSection**: アイコン背景をブランドカラーに統一 (Teal Light / Blue Light / Dark Blue Light)
- **セクション背景リズム**: 明暗を整理（提案版を採用）

### タイポグラフィトークン

#### フォントファミリー
```
定義場所: web/src/app/layout.tsx

Sans (EN): Inter — variable: --font-inter
Sans (JP): Noto Sans JP — variable: --font-noto-sans-jp
  Weights: 400 (Regular), 500 (Medium), 700 (Bold), 900 (Black)

Figmaでの指定:
  英文: Inter
  和文: Noto Sans JP
  コード: Geist Mono (CSS変数 --font-geist-mono で参照あり)
```

#### タイプスケール（Figma定義推奨）
```
Display:   text-7xl (4.5rem/72px) — Hero見出し（lg以上）
H1:        text-5xl (3rem/48px)   — セクション見出し（sm以上）
H2:        text-4xl (2.25rem/36px) — セクション見出し（モバイル）
H3:        text-xl (1.25rem/20px) — カードタイトル
Body-L:    text-lg (1.125rem/18px) — リード文
Body:      text-base (1rem/16px)  — 本文
Body-S:    text-sm (0.875rem/14px) — 補助テキスト, フィーチャー説明
Caption:   text-xs (0.75rem/12px) — ラベル, バッジ
```

### スペーシングトークン
```
Tailwind 4 デフォルトの 4px グリッドシステム使用:
  4px (p-1), 8px (p-2), 12px (p-3), 16px (p-4),
  20px (p-5), 24px (p-6), 32px (p-8), 40px (p-10),
  48px (p-12), 64px (p-16), 80px (p-20), 96px (p-24)

セクション縦パディング:
  Desktop: py-24 〜 py-32 (96px 〜 128px)
  Mobile:  py-20 (80px)

コンテンツ横パディング:
  px-6 (24px) — 標準
  lg:px-8 (32px) — 大画面

コンテンツ最大幅:
  max-w-7xl (80rem/1280px) — セクション全体
  max-w-6xl (72rem/1152px) — Problem/Solution
  max-w-4xl (56rem/896px)  — Hero, Video
  max-w-3xl (48rem/768px)  — CTA
  max-w-2xl (42rem/672px)  — Hero サブテキスト
```

---

## 2. Component Library（コンポーネントライブラリ）

### 定義場所
```
web/src/components/
├── lp/              — LP専用コンポーネント（11ファイル）
│   ├── LPHeader.tsx
│   ├── HeroSection.tsx
│   ├── ProblemSection.tsx
│   ├── SolutionSection.tsx
│   ├── FeaturesSection.tsx
│   ├── HowItWorksSection.tsx
│   ├── VideoPlaceholder.tsx
│   ├── PricingPreview.tsx
│   ├── TestimonialsSection.tsx
│   ├── CTASection.tsx
│   └── FloatingElements.tsx
├── AuthModal.tsx    — 認証モーダル
├── PricingPlans.tsx — 料金プラン（アプリ内）
├── UserMenu.tsx     — ユーザーメニュー
└── ...              — その他アプリコンポーネント
```

### コンポーネントアーキテクチャ
- **パターン**: セクション単位の関数コンポーネント
- **状態管理**: React hooks (useState, useMemo)
- **アニメーション**: Framer Motion (`motion.*` コンポーネント)
- **アクセシビリティ**: `useReducedMotion` によるモーション削減対応
- **レスポンシブ**: `useIsMobile` フックによるモバイル分岐
- **Storybook**: 未設定

### 共通UIパターン

#### ボタン
```
Primary CTA:
  rounded-full bg-es-teal px-8 py-4 text-lg font-bold text-white
  shadow-lg shadow-[#2DB3A0]/25 transition-transform hover:scale-105

Secondary CTA:
  rounded-full border border-white/20 px-8 py-4 text-lg font-semibold text-white
  transition-colors hover:bg-white/10

Header CTA:
  rounded-full bg-es-teal px-5 py-2 text-sm font-semibold text-white
  transition-opacity hover:opacity-90

Gradient CTA:
  rounded-lg bg-gradient-to-r from-es-blue to-es-teal px-6 py-3
  text-center text-sm font-semibold text-white shadow-md
  transition-all hover:shadow-lg hover:brightness-110
```

#### カード
```
Light Card (Problem, Testimonials):
  rounded-2xl bg-white p-8 shadow-lg transition-shadow hover:shadow-xl

Dark Card (Features, Pricing):
  rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm

Highlighted Card (Recommended Pricing):
  rounded-2xl border-es-blue/50 bg-white/10 shadow-lg shadow-es-blue/20
  ring-1 ring-es-blue/30 scale-105
```

#### バッジ
```
人気バッジ:
  rounded-full bg-gradient-to-r from-amber-400 to-orange-500
  px-4 py-1 text-sm font-semibold text-white shadow-lg
```

---

## 3. Frameworks & Libraries

| カテゴリ | ライブラリ | バージョン |
|---------|-----------|-----------|
| Framework | Next.js | 16.0.8 |
| UI | React | 19.2.1 |
| Styling | Tailwind CSS | v4 |
| Animation | Framer Motion | 12.34.0 |
| Icons | Lucide React | 0.554.0 |
| CSS Build | @tailwindcss/postcss | 4.1.18 |
| Utilities | clsx, tailwind-merge | latest |

### ビルドシステム
- **Bundler**: Turbopack (Next.js 16 default)
- **PostCSS**: `@tailwindcss/postcss` プラグインのみ
- **TypeScript**: v5
- **デプロイ**: Vercel

---

## 4. Asset Management（アセット管理）

### アセット格納場所
```
web/public/
├── logo-edushift.png    — ブランドロゴ（ヘッダー用）
├── logo.jpg             — 代替ロゴ
├── icons/               — PWAアイコン
│   └── apple-touch-icon.png
├── manifest.json        — PWAマニフェスト
├── file.svg, globe.svg  — Next.js デフォルトアイコン
├── next.svg, vercel.svg — フレームワークロゴ
└── window.svg
```

### 参照方法
```tsx
// publicディレクトリからの静的参照
<img src="/logo-edushift.png" alt="EduShift" className="h-9 w-auto" />

// Next.js Image コンポーネントは現在未使用
// → 最適化推奨: next/image を活用
```

### 画像最適化
- **サーバーサイド**: Sharp (sharp@0.34.5)
- **クライアントサイド**: browser-image-compression
- **CDN**: Vercel Edge Network（デプロイ先）
- **注意**: `next/image` が LP で未使用 → LCP 改善の余地あり

---

## 5. Icon System（アイコンシステム）

### ライブラリ
- **Lucide React** (`lucide-react@0.554.0`)

### 使用パターン
```tsx
import { Clock, Scale, TrendingDown } from 'lucide-react';

// アイコンサイズ規約
<Icon className="h-7 w-7" />   // カード内アイコン（28px）
<Icon className="h-10 w-10" /> // フィーチャーアイコン（40px）
<Icon className="h-12 w-12" /> // ステップアイコン（48px）
<Icon className="h-6 w-6" />   // UI補助アイコン（24px）
<Icon className="h-5 w-5" />   // リスト内アイコン（20px）
<Icon className="h-4 w-4" />   // インラインアイコン（16px）
```

### LP で使用中のアイコン一覧
```
Header:   Menu, X
Hero:     ChevronDown
Problem:  Clock, Scale, TrendingDown
Solution: X, Check
Features: Zap, BarChart3, Camera
HowItWorks: Camera, Sparkles, FileCheck
Video:    Play
Testimonials: Star
```

---

## 6. Styling Approach（スタイリング手法）

### CSS メソドロジー
- **Tailwind CSS v4** — ユーティリティファースト
- **CSS変数** — カスタムプロパティでテーマ管理
- **@theme inline** — Tailwind テーマ拡張（Tailwind v4 方式）
- **インラインスタイル** — Framer Motion のアニメーション値のみ

### グローバルスタイル
```
web/src/app/globals.css
├── @import "tailwindcss"        — Tailwind v4 エントリポイント
├── :root { ... }                — CSS変数定義
├── @theme inline { ... }        — Tailwind カスタムテーマ
├── @media (prefers-color-scheme: dark) — ダークモード
├── body { ... }                 — ベーススタイル
├── @media print { ... }         — 印刷スタイル
├── @keyframes float             — フロートアニメーション
├── @keyframes pulse-glow        — パルスグローアニメーション
├── @keyframes float-particle    — パーティクルアニメーション
└── @media (prefers-reduced-motion) — モーション削減
```

### レスポンシブデザイン
```
ブレークポイント（Tailwind v4 デフォルト）:
  sm:  640px   — テキストサイズ拡大
  md:  768px   — 2〜3カラムグリッド
  lg:  1024px  — パディング拡大、ConnectingPath表示
  xl:  1280px  — （現在未使用）
  2xl: 1536px  — （現在未使用）

カスタムフック:
  useIsMobile()     — md (768px) 未満を検知
  useReducedMotion() — prefers-reduced-motion を検知
```

### アニメーション規約
```
Framer Motion パターン:

// スクロールトリガーのフェードアップ
initial={{ opacity: 0, y: 20 }}
whileInView={{ opacity: 1, y: 0 }}
viewport={{ once: true, amount: 0.5 }}
transition={{ duration: 0.5 }}

// スタガードコンテナ
variants={{
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } }
}}

// 子要素
variants={{
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } }
}}

// reducedMotion 対応
const reducedMotion = useReducedMotion();
initial={reducedMotion ? undefined : { opacity: 0, y: 20 }}
```

---

## 7. Project Structure（プロジェクト構造）

```
auto-tensaku-system/
├── web/                         — Next.js アプリケーション
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         — LP エントリポイント
│   │   │   ├── layout.tsx       — ルートレイアウト（フォント、AuthProvider）
│   │   │   ├── globals.css      — デザイントークン + グローバルスタイル
│   │   │   ├── (app)/           — 認証保護されたルート
│   │   │   │   ├── grading/     — メイン添削画面
│   │   │   │   ├── pricing/     — 料金ページ
│   │   │   │   ├── subscription/
│   │   │   │   ├── account/
│   │   │   │   ├── admin/
│   │   │   │   └── privacy/
│   │   │   ├── auth/            — 認証フロー
│   │   │   └── api/             — バックエンドAPI
│   │   ├── components/
│   │   │   ├── lp/              — LP コンポーネント群
│   │   │   └── *.tsx            — 共通コンポーネント
│   │   ├── hooks/               — カスタムフック
│   │   ├── lib/                 — ビジネスロジック
│   │   └── types/               — 型定義
│   ├── public/                  — 静的アセット
│   ├── package.json
│   └── next.config.ts
├── docs/                        — ドキュメント
└── .claude/                     — Claude Code 設定
```

---

## 8. Figma → Code ワークフロー

### Figma デザインからコードへの変換ルール

1. **カラー**: Figma の色 → `globals.css` の CSS 変数 → Tailwind `@theme` クラス
2. **フォント**: Figma の Inter/Noto Sans JP → `layout.tsx` の Google Fonts 読み込み
3. **スペーシング**: Figma の 8px グリッド → Tailwind の `p-*`, `m-*`, `gap-*`
4. **角丸**: `rounded-2xl` (16px) がカード標準、`rounded-full` がボタン標準
5. **影**: `shadow-lg` がカード標準、`shadow-md` がボタン標準
6. **アニメーション**: Figma のトランジション → Framer Motion の `motion.*`
7. **レスポンシブ**: Figma の Desktop (1440px) + Mobile (375px) → Tailwind ブレークポイント
8. **アイコン**: Figma のアイコン → Lucide React の対応コンポーネント

### コンポーネント命名規約
```
LP セクション: [セクション名]Section.tsx  (例: HeroSection.tsx)
共通UI:        [コンポーネント名].tsx      (例: AuthModal.tsx)
レイアウト:     [ページ名]/layout.tsx
ページ:        [ページ名]/page.tsx
```

---

## 9. 改善提案サマリ（Figmaデザイン作業用）

### デザインシステム強化
- [ ] ブランドカラーパレットを拡張（Accent, Surface, Semantic）
- [ ] 8pxグリッドに基づくスペーシングスケールを明文化
- [ ] ボタン・カード・バッジのコンポーネントバリアント定義
- [ ] タイポグラフィスケールの整理とFigma Text Styles 化

### LP 構造改善
- [ ] Hero にプロダクトモックアップ追加
- [ ] Social Proof Bar の新設（利用者数、満足度）
- [ ] 全プランにCTAボタン配置
- [ ] FAQ セクション追加
- [ ] Footer セクション追加

### ブランド統一
- [ ] ProblemSection のアクセント色をブランドカラーに統一
- [ ] SolutionSection の配色をブランドカラー基調に
- [ ] セクション背景の明暗リズムを整理
- [ ] FloatingElements を教育テーマに最適化
