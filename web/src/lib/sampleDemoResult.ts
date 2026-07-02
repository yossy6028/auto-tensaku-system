import { SAMPLE_TRIAL } from './sampleTrial';

export type DemoAxisStatus = 'good' | 'partial';

export interface DemoAxis {
  label: string;
  status: DemoAxisStatus;
  comment: string;
}

export interface DemoDeduction {
  points: string;
  reason: string;
}

// RealSampleSection.tsx が表示している「実際の採点結果」をデータ化したもの。
// 数値・文言は捏造せず、実際にAIが返したレポートをそのまま再現している。
// 3軸ステータスは実際の減点がいずれも内容面であることに基づく忠実な区分であり、
// 架空の軸別点数は付与しない。
export const SAMPLE_DEMO_RESULT = {
  problemStatement: SAMPLE_TRIAL.problemCondition,
  imagePath: SAMPLE_TRIAL.imagePath,
  imageCaption: '中学受験 国語 記述問題 — 生徒の手書き答案',
  aiTranscription:
    '嘘つきの太郎君の言葉だったが愛国号が来ているらしい新舞子にはよく飛行機が来ていてまんざら嘘ではないと思ったから。',
  totalScore: 50,
  axes: [
    {
      label: '内容',
      status: 'partial',
      comment: '当時の状況・心情と、期待の要素が不足しています',
    },
    {
      label: '表現',
      status: 'good',
      comment: '理由を的確に読み取り、簡潔にまとめられています',
    },
    {
      label: '構成',
      status: 'good',
      comment: '因果関係が整理された文になっています',
    },
  ] satisfies DemoAxis[],
  deductions: [
    {
      points: '-30%',
      reason:
        '「退屈していて何か出来事を望んでいた」という当時の状況・心情の要素が不足',
    },
    {
      points: '-20%',
      reason: '「飛行機の曲芸が見られる」という目的・期待の要素が不足',
    },
  ] satisfies DemoDeduction[],
  strength:
    '太郎君の話に「新舞子によく飛行機が来る」という事実が混ざっていたため、嘘ではないと信じたという理由を的確に読み取ってまとめられています。',
  advice:
    '彼らが「退屈していて何か面白い出来事を望んでいた」ことや、愛国号の「曲芸」が見られるという期待感を補うと、より深い解答になります。',
  modelRewrite:
    '退屈して何か出来事を望んでいた時に、太郎君が事実を交えて愛国号の曲芸という面白そうな話をしたため、本当だと思って見に行きたくなったから。',
} as const;
