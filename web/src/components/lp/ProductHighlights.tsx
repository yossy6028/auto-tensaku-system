'use client';

import { motion } from 'framer-motion';
import { PenTool, CheckCircle, ShieldCheck } from 'lucide-react';
import type { ComponentType } from 'react';

type Highlight = {
    icon: ComponentType<{ className?: string }>;
    title: string;
    description: string;
    tag?: string;
    colorBg: string; // Tailwind class for background color of the card/icon area
    colorText: string; // Tailwind class for text color
    borderColor: string; // Tailwind class for border
};

const highlights: Highlight[] = [
    {
        icon: PenTool,
        title: '手書きの答案 もそのままOK！',
        description:
            'スマホで撮影した手書きの答案画像をそのままアップロードしてください。最新のAI文字認識技術が、あなたの文字を正確に読み取り、的確な添削を行います。',
        tag: '✨ 多少の癖字や乱筆でも高精度に認識します',
        colorBg: 'bg-indigo-50',
        colorText: 'text-indigo-600',
        borderColor: 'border-indigo-100',
    },
    {
        icon: CheckCircle,
        title: 'プロ講師の採点基準で設計',
        description:
            '20年以上の指導経験を持つプロ講師の採点ノウハウをAIに学習させています。入試本番を見据えた実践的なフィードバックで、「なぜ減点されるのか」「どう書けば満点になるのか」を具体的にアドバイスします。',
        colorBg: 'bg-blue-50',
        colorText: 'text-blue-600',
        borderColor: 'border-blue-100',
    },
    {
        icon: ShieldCheck,
        title: 'プライバシーの約束',
        description:
            'お子様の答案データは採点完了後すぐに削除され、AIの学習には一切使用しません。安心してご利用いただけるよう、データ保護を徹底しています。',
        tag: '💡 より安心のため、氏名部分を隠してアップロードすることもできます。',
        colorBg: 'bg-emerald-50',
        colorText: 'text-emerald-600',
        borderColor: 'border-emerald-100',
    },
];

const containerVariants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.2,
        },
    },
};

const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, ease: 'easeOut' as const },
    },
};

export function ProductHighlights() {
    return (
        <section className="py-16 bg-white md:py-24">
            <div className="mx-auto max-w-5xl px-4 sm:px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.5 }}
                    className="mb-16 text-center"
                >
                    <h2 className="text-xl font-medium leading-relaxed text-slate-700 md:text-2xl">
                        指導歴20年超のベテラン国語講師のノウハウと
                        <br className="hidden md:block" />
                        最新AIによる解析で、あなたの思考に寄り添うフィードバックを。
                    </h2>
                </motion.div>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-100px' }}
                    className="space-y-6"
                >
                    {highlights.map((item) => {
                        const Icon = item.icon;
                        // The first item in the image looked distinct (large icon on left), but for consistency/implementation speed, 
                        // I'll make them stacked cards or a grid. 
                        // The design in the image shows:
                        // 1. Large card with "Handwritten OK"
                        // 2. Card "Pro lecturer"
                        // 3. Card "Privacy"
                        // Let's make the first one featured or just vertical stack as per the content flow.
                        // Actually, the request "Include this in the top" suggests a prominent placement.
                        // I will implement them as a vertical stack of styled cards to match the detailed text.

                        return (
                            <motion.div
                                key={item.title}
                                variants={cardVariants}
                                className={`overflow-hidden rounded-2xl border ${item.borderColor} ${item.colorBg} p-6 md:p-8`}
                            >
                                <div className="flex flex-col md:flex-row md:items-start md:gap-6">
                                    <div className={`mb-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ${item.colorText} md:mb-0`}>
                                        <Icon className="h-7 w-7" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className={`mb-3 text-xl font-bold ${item.colorText}`}>
                                            {item.title}
                                        </h3>
                                        <p className="mb-4 leading-relaxed text-slate-700">
                                            {item.description}
                                        </p>
                                        {item.tag && (
                                            <div className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm">
                                                {item.tag}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </motion.div>
            </div>
        </section>
    );
}
