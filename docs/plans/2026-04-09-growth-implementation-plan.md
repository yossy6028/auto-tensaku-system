# Taskal AI 成長施策実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 戦略レポートの「信頼修復」「LP最適化」「PMF改善」を段階的に実装し、最初の有料ユーザー獲得を支援する

**Architecture:** Next.js App Router (web/src/app) + Supabase + Stripe。LPコンポーネントは web/src/components/lp/ に分離済み。変更はLP構成→信頼要素→プロダクト機能の順に進める

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Framer Motion, Supabase, Stripe

---

## フェーズ1: 信頼修復＆LP最適化（今週中）

### Task 1: LP構成の並べ替え — お悩みセクションをヒーロー直下に

**Files:**
- Modify: `web/src/app/page.tsx`

**Step 1: LP構成を変更**

現在の構成:
```
HeroSection → RealSampleSection → ProductHighlights → ProblemSection → SolutionSection → ...
```

変更後:
```
HeroSection → ProblemSection → SolutionSection → RealSampleSection → ProductHighlights → ...
```

```tsx
// web/src/app/page.tsx
export default function LandingPage() {
  return (
    <main className="overflow-x-hidden">
      <LPHeader />
      <HeroSection />
      <ProblemSection />       {/* ← ヒーロー直下に移動 */}
      <SolutionSection />      {/* ← 問題提起の直後 */}
      <RealSampleSection />    {/* ← 解決策を見せた後にサンプル */}
      <ProductHighlights />
      <FeaturesSection />
      <HowItWorksSection />
      <ThreeStepsSection />
      <VideoPlaceholder />
      <PricingPreview />
      <FAQSection />
      <CTASection />
      <LPFooter />
    </main>
  );
}
```

**Step 2: ビルド確認**

Run: `cd web && npx next build 2>&1 | tail -5`
Expected: Build succeeded

**Step 3: Commit**

```bash
git add web/src/app/page.tsx
git commit -m "refactor(lp): move ProblemSection directly after hero for better conversion"
```

---

### Task 2: ヒーローコピーの変更 — 塾講師向けに絞る

**Files:**
- Modify: `web/src/components/lp/HeroSection.tsx`

**Step 1: ヘッドラインとサブコピーを変更**

変更箇所1 — h1（80行目付近）:
```tsx
// Before:
// どんな国語の答案も
// 3分でプロ視点の添削が完了

// After:
<motion.h1
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.8, delay: 0.2 }}
  className="mb-6 text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent sm:text-4xl md:text-5xl"
>
  疲れていても、22時でも。<br />採点基準はブレない。
</motion.h1>
```

変更箇所2 — サブコピー（89行目付近）:
```tsx
// Before:
// 学習塾、学校、家庭教師、保護者様など、
// 記述の採点に取り組まれる様々な方にご利用いただけます。

// After:
<p className="text-base text-slate-700">
  学習塾・個人家庭教師の先生のための、<br className="hidden sm:inline" />
  国語記述専用AI自動添削システム。
</p>
```

**Step 2: ビルド確認**

Run: `cd web && npx next build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add web/src/components/lp/HeroSection.tsx
git commit -m "copy(lp): rewrite hero to target juku teachers with pain-point headline"
```

---

### Task 3: 架空テスティモニアルの削除 — 虚偽の数値を除去

**Files:**
- Modify: `web/src/components/lp/TestimonialsSection.tsx`

**重要:** 現在のTestimonialsセクションには架空の利用者の声と根拠のない数値（採点精度95%、継続利用率98%）がハードコードされている。実ユーザーがいない段階でこれを掲載するのは信頼を損なう。

**Step 1: 架空メトリクスと架空テスティモニアルを削除し、ベータ募集CTAに置換**

```tsx
// web/src/components/lp/TestimonialsSection.tsx
'use client';

import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import Link from 'next/link';
import { useReducedMotion } from '@/hooks/useMediaQuery';

export function TestimonialsSection() {
  const reducedMotion = useReducedMotion();

  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 lg:px-8 text-center">
        <motion.div
          initial={reducedMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-es-teal-light">
            <Users className="h-8 w-8 text-es-teal" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            先生方のフィードバックを募集中
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-slate-600">
            現在、塾講師・家庭教師の先生方にご協力いただける<br className="hidden sm:inline" />
            ベータモニターを募集しています。<br />
            <span className="font-semibold text-slate-800">3ヶ月間無料</span>でスタンダードプランをご利用いただけます。
          </p>
          <div className="mt-8">
            <Link
              href="/grading"
              className="inline-flex items-center justify-center rounded-full bg-es-teal px-8 py-4 text-lg font-bold text-white shadow-lg shadow-es-teal/25 transition-all hover:brightness-110 hover:shadow-xl hover:-translate-y-0.5"
            >
              無料でモニター体験する
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
```

**Step 2: LP構成にTestimonialsSectionを追加**

TestimonialsSectionが現在LPのpage.tsxに含まれていない場合、PricingPreviewの前に挿入する。
既にpage.tsxのimportに含まれている場合はそのまま。

```tsx
// web/src/app/page.tsx にimportと配置を確認
import { TestimonialsSection } from '@/components/lp/TestimonialsSection';

// PricingPreviewの前に配置
<TestimonialsSection />
<PricingPreview />
```

**Step 3: ビルド確認**

Run: `cd web && npx next build 2>&1 | tail -5`

**Step 4: Commit**

```bash
git add web/src/components/lp/TestimonialsSection.tsx web/src/app/page.tsx
git commit -m "fix(lp): replace fake testimonials with beta-tester recruitment CTA"
```

---

### Task 4: 運営者プロフィールセクションを追加

**Files:**
- Create: `web/src/components/lp/FounderSection.tsx`
- Modify: `web/src/app/page.tsx`

**Step 1: FounderSectionコンポーネントを作成**

```tsx
// web/src/components/lp/FounderSection.tsx
'use client';

import { motion } from 'framer-motion';
import { BookOpen, Award, Code } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useMediaQuery';

export function FounderSection() {
  const reducedMotion = useReducedMotion();

  return (
    <section className="bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <motion.div
          initial={reducedMotion ? undefined : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
            開発者について
          </h2>
        </motion.div>

        <motion.div
          initial={reducedMotion ? undefined : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="rounded-2xl bg-white p-8 shadow-lg sm:p-10"
        >
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start">
            {/* TODO(human): 顔写真を /public/founder.jpg に配置し、下記を <Image> に置換 */}
            <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-es-teal to-es-blue text-3xl font-bold text-white shadow-lg">
              YK
            </div>

            <div className="text-center sm:text-left">
              <h3 className="text-2xl font-bold text-slate-900">
                吉井 克彦
              </h3>
              <p className="mt-1 text-sm font-medium text-es-teal">
                EduShift 代表 / 中学受験専門 国語講師
              </p>

              <p className="mt-4 leading-relaxed text-slate-700">
                {/* TODO(human): 自己紹介文を実際の経歴に合わせて修正してください */}
                指導歴20年超。中学受験専門の国語講師として数百名の生徒を指導。
                添削に費やす膨大な時間を解消するため、自らの採点ノウハウをAIに実装し
                Taskal AIを開発しました。
              </p>

              <div className="mt-6 flex flex-wrap justify-center gap-4 sm:justify-start">
                <div className="flex items-center gap-2 rounded-full bg-es-teal-light px-4 py-2">
                  <BookOpen className="h-4 w-4 text-es-teal" />
                  <span className="text-sm font-medium text-es-teal">指導歴20年超</span>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-es-blue-light px-4 py-2">
                  <Award className="h-4 w-4 text-es-blue" />
                  <span className="text-sm font-medium text-es-blue">中学受験専門</span>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-2">
                  <Code className="h-4 w-4 text-indigo-600" />
                  <span className="text-sm font-medium text-indigo-600">開発者</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
```

**Step 2: page.tsxに追加（FeaturesSection の後に配置）**

```tsx
import { FounderSection } from '@/components/lp/FounderSection';

// FeaturesSection の後に挿入
<FeaturesSection />
<FounderSection />
<HowItWorksSection />
```

**Step 3: ビルド確認**

Run: `cd web && npx next build 2>&1 | tail -5`

**Step 4: Commit**

```bash
git add web/src/components/lp/FounderSection.tsx web/src/app/page.tsx
git commit -m "feat(lp): add founder profile section for trust building"
```

---

### Task 5: メタデータ・OGタグの修正

**Files:**
- Modify: `web/src/app/layout.tsx`

**Step 1: layout.tsx の metadata を確認・修正**

```tsx
export const metadata: Metadata = {
  title: 'Taskal AI - 国語記述問題AI自動添削システム',
  description: '学習塾・家庭教師の先生のための国語記述AI自動添削。手書き答案をスマホで撮影するだけで、3軸採点・改善アドバイス・満点例を自動生成。',
  openGraph: {
    title: 'Taskal AI - 国語記述問題AI自動添削システム',
    description: '疲れていても、22時でも。採点基準はブレない。学習塾・家庭教師向け国語記述AI添削。',
    type: 'website',
    locale: 'ja_JP',
    url: 'https://auto-tensaku-system.vercel.app',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Taskal AI - 国語記述問題AI自動添削システム',
    description: '疲れていても、22時でも。採点基準はブレない。',
  },
};
```

**Step 2: ビルド確認 → Commit**

```bash
git add web/src/app/layout.tsx
git commit -m "fix(seo): update metadata and OG tags with proper branding"
```

---

### Task 6: CTAコピーの改善

**Files:**
- Modify: `web/src/components/lp/HeroSection.tsx`
- Modify: `web/src/components/lp/CTASection.tsx`

**Step 1: HeroSection のCTAボタンテキストを変更**

```tsx
// Before: 無料で5回試す
// After:
<Link
  href="/grading"
  className="inline-flex items-center justify-center rounded-full bg-es-teal px-8 py-4 text-lg font-bold text-white shadow-lg shadow-es-teal/25 transition-all hover:brightness-110 hover:shadow-xl hover:-translate-y-0.5"
>
  手元の答案で無料体験する
</Link>
```

**Step 2: CTASection も同様に変更**

**Step 3: ビルド確認 → Commit**

```bash
git add web/src/components/lp/HeroSection.tsx web/src/components/lp/CTASection.tsx
git commit -m "copy(lp): improve CTA from generic '5 free tries' to action-oriented text"
```

---

## フェーズ2: プロダクト改善（来週以降）

### Task 7: 生徒管理＋採点履歴テーブルの設計

**Files:**
- Create: `web/supabase/migrations/YYYYMMDD_student_management.sql`

**概要:** Supabase に students テーブルと grading_history テーブルを追加。
これにより「使うほど価値が増える」データ蓄積構造を作る。

```sql
-- students テーブル
CREATE TABLE IF NOT EXISTS public.students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade TEXT,             -- 学年（小6、中3等）
  target_school TEXT,     -- 志望校
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- grading_history テーブル
CREATE TABLE IF NOT EXISTS public.grading_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  label TEXT NOT NULL,           -- 大問1 問2 等
  content_score INT,             -- 内容点
  expression_score INT,          -- 表現点
  structure_score INT,           -- 構成点
  total_score INT,
  feedback JSONB,                -- 採点フィードバック全文
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grading_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own students"
  ON public.students FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own grading history"
  ON public.grading_history FOR ALL
  USING (auth.uid() = user_id);
```

**この後のステップ:**
- 採点API（route.ts）で結果をgrading_historyに自動保存
- 生徒選択UIをgradingページに追加
- ダッシュボードページ（/dashboard）でスコア推移グラフを表示

---

### Task 8: バッチ採点UXの改善（既存機能の強化）

**概要:** web/src/components/BatchProgress.tsx と BatchResults.tsx が存在するため、
設問テンプレートの保存・再利用機能を追加してバッチ処理を効率化する。

---

### Task 9: 価格プラン改定（生徒数ベース課金への移行）

**概要:** Stripe Products/Prices を生徒数ベースに変更し、PricingPlans.tsx を更新。
現行の回数ベース（10回/30回/無制限）から生徒数ベース（10名/30名/無制限）へ。

---

## フェーズ3: マーケティング支援（並行タスク・非コード）

以下はコード変更不要のマーケティング施策。別途チェックリストとして管理：

- [ ] 知人の塾講師5人に具体的な日時を指定してLINEを送る
- [ ] X で `#塾講師` `#国語指導` の講師50人をフォロー→共感リプライ
- [ ] LINE オープンチャット「塾講師・経営者コミュニティ」に参加
- [ ] note に「国語記述 採点の流儀」第1弾を投稿
- [ ] ベータモニター10名を招待（3ヶ月無料）
- [ ] 60秒のデモ動画を画面録画で作成
- [ ] 採点精度検証（20問で人間講師と比較）→ LP掲載
