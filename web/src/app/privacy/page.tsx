'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, Eye, Lock, Server, UserCheck, Mail } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-slate-50 relative overflow-hidden selection:bg-indigo-100 selection:text-indigo-900 font-sans text-slate-900">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03]"></div>
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/20 blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[30%] h-[30%] rounded-full bg-violet-400/20 blur-[100px]"></div>
      </div>

      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Back Link */}
        <Link 
          href="/" 
          className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium mb-8 transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
          トップページに戻る
        </Link>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-4 rounded-2xl shadow-xl">
              <Shield className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-800 tracking-tight mb-4">
            プライバシーポリシー
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            EduShift 自動添削システムにおける個人情報の取り扱いについて
          </p>
          <p className="text-sm text-slate-500 mt-4">
            最終更新日: 2025年11月25日
          </p>
        </div>

        {/* Content */}
        <div className="bg-white/60 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] overflow-hidden border border-white/60 ring-1 ring-white/50">
          <div className="p-8 md:p-12 space-y-10">
            
            {/* Section 1 */}
            <section>
              <div className="flex items-center mb-4">
                <div className="bg-indigo-100 text-indigo-600 rounded-lg w-10 h-10 flex items-center justify-center mr-4">
                  <Eye className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">1. 基本方針</h2>
              </div>
              <div className="pl-14">
                <p className="text-slate-700 leading-relaxed">
                  EduShift（以下「当社」といいます）は、お客様の個人情報保護を最重要事項と考え、
                  関連する法令を遵守し、適切な管理を行います。本プライバシーポリシーは、
                  当社が提供する自動添削システム（以下「本サービス」といいます）における
                  個人情報の取り扱いについて定めるものです。
                </p>
              </div>
            </section>

            {/* Section 2 */}
            <section>
              <div className="flex items-center mb-4">
                <div className="bg-violet-100 text-violet-600 rounded-lg w-10 h-10 flex items-center justify-center mr-4">
                  <Server className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">2. 収集する情報</h2>
              </div>
              <div className="pl-14 space-y-4">
                <p className="text-slate-700 leading-relaxed">
                  本サービスでは、以下の情報を収集することがあります：
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <span className="bg-violet-100 text-violet-600 rounded-full w-6 h-6 flex items-center justify-center mr-3 mt-0.5 text-sm font-bold flex-shrink-0">1</span>
                    <div>
                      <strong className="text-slate-800">アップロードされた画像データ</strong>
                      <p className="text-slate-600 text-sm mt-1">答案・問題・模範解答の画像ファイル</p>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <span className="bg-violet-100 text-violet-600 rounded-full w-6 h-6 flex items-center justify-center mr-3 mt-0.5 text-sm font-bold flex-shrink-0">2</span>
                    <div>
                      <strong className="text-slate-800">サービス利用に関する情報</strong>
                      <p className="text-slate-600 text-sm mt-1">採点対象の問題番号、利用日時など</p>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <span className="bg-violet-100 text-violet-600 rounded-full w-6 h-6 flex items-center justify-center mr-3 mt-0.5 text-sm font-bold flex-shrink-0">3</span>
                    <div>
                      <strong className="text-slate-800">技術的な情報</strong>
                      <p className="text-slate-600 text-sm mt-1">IPアドレス、ブラウザ情報、アクセスログなど</p>
                    </div>
                  </li>
                </ul>
              </div>
            </section>

            {/* Section 3 */}
            <section>
              <div className="flex items-center mb-4">
                <div className="bg-blue-100 text-blue-600 rounded-lg w-10 h-10 flex items-center justify-center mr-4">
                  <Lock className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">3. 画像データの取り扱い</h2>
              </div>
              <div className="pl-14 space-y-4">
                <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
                  <h3 className="font-bold text-blue-800 mb-2">重要：アップロードされた画像について</h3>
                  <ul className="space-y-2 text-blue-700">
                    <li className="flex items-start">
                      <span className="text-blue-500 mr-2">✓</span>
                      採点処理が完了次第、サーバーから<strong>自動的に削除</strong>されます
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-500 mr-2">✓</span>
                      AIモデルの学習やトレーニングには<strong>一切使用されません</strong>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-500 mr-2">✓</span>
                      第三者への提供や開示は<strong>行いません</strong>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-500 mr-2">✓</span>
                      当社による画像の保存や蓄積は<strong>行いません</strong>
                    </li>
                  </ul>
                </div>
                <p className="text-slate-700 leading-relaxed">
                  お客様がアップロードした答案画像は、採点処理のためにのみ使用され、
                  処理完了後は速やかに削除されます。これらの画像データが
                  当社のサーバーに長期保存されることはありません。
                </p>
              </div>
            </section>

            {/* Section 4 */}
            <section>
              <div className="flex items-center mb-4">
                <div className="bg-green-100 text-green-600 rounded-lg w-10 h-10 flex items-center justify-center mr-4">
                  <UserCheck className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">4. 情報の利用目的</h2>
              </div>
              <div className="pl-14 space-y-4">
                <p className="text-slate-700 leading-relaxed">
                  収集した情報は、以下の目的でのみ利用します：
                </p>
                <ul className="space-y-2 text-slate-700">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">•</span>
                    本サービスの提供（答案の採点・フィードバック生成）
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">•</span>
                    サービスの品質向上および改善
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">•</span>
                    システムの安全性・安定性の確保
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">•</span>
                    利用状況の統計・分析（個人を特定しない形式）
                  </li>
                </ul>
              </div>
            </section>

            {/* Section 5 */}
            <section>
              <div className="flex items-center mb-4">
                <div className="bg-amber-100 text-amber-600 rounded-lg w-10 h-10 flex items-center justify-center mr-4">
                  <Shield className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">5. 第三者サービスの利用</h2>
              </div>
              <div className="pl-14 space-y-4">
                <p className="text-slate-700 leading-relaxed">
                  本サービスでは、採点処理のためにGoogle社のGemini APIを利用しています。
                  画像データはGoogle社のサーバーに送信されますが、Google社の
                  APIポリシーに基づき、有料APIを通じて送信されたデータは
                  モデルの学習には使用されません。
                </p>
                <div className="bg-amber-50 rounded-xl p-5 border border-amber-100">
                  <p className="text-amber-800 text-sm">
                    <strong>参考：</strong>Google社のデータ使用ポリシーについては、
                    <a 
                      href="https://ai.google.dev/gemini-api/terms" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-amber-600 underline hover:text-amber-700 ml-1"
                    >
                      Gemini API利用規約
                    </a>
                    をご確認ください。
                  </p>
                </div>
              </div>
            </section>

            {/* Section 6 */}
            <section>
              <div className="flex items-center mb-4">
                <div className="bg-red-100 text-red-600 rounded-lg w-10 h-10 flex items-center justify-center mr-4">
                  <Lock className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">6. セキュリティ対策</h2>
              </div>
              <div className="pl-14 space-y-4">
                <p className="text-slate-700 leading-relaxed">
                  当社は、お客様の情報を保護するために以下のセキュリティ対策を実施しています：
                </p>
                <ul className="space-y-2 text-slate-700">
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">•</span>
                    SSL/TLS暗号化通信の使用
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">•</span>
                    アクセス権限の適切な管理
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">•</span>
                    定期的なセキュリティ診断の実施
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">•</span>
                    データの自動削除機能の実装
                  </li>
                </ul>
              </div>
            </section>

            {/* Section 7 */}
            <section>
              <div className="flex items-center mb-4">
                <div className="bg-slate-100 text-slate-600 rounded-lg w-10 h-10 flex items-center justify-center mr-4">
                  <Eye className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">7. Cookieの使用</h2>
              </div>
              <div className="pl-14">
                <p className="text-slate-700 leading-relaxed">
                  本サービスでは、サービスの機能維持および利便性向上のために
                  Cookie（クッキー）を使用する場合があります。Cookieの使用を
                  希望されない場合は、ブラウザの設定により無効化することができますが、
                  一部のサービスが正常に機能しなくなる可能性があります。
                </p>
              </div>
            </section>

            {/* Section 8 */}
            <section>
              <div className="flex items-center mb-4">
                <div className="bg-indigo-100 text-indigo-600 rounded-lg w-10 h-10 flex items-center justify-center mr-4">
                  <Shield className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">8. お子様の個人情報</h2>
              </div>
              <div className="pl-14">
                <p className="text-slate-700 leading-relaxed">
                  本サービスは教育目的で提供されており、お子様（未成年者）の
                  答案を取り扱う場合があります。保護者の皆様におかれましては、
                  お子様が本サービスを利用する際には適切な監督をお願いいたします。
                  また、お子様の個人情報に関するお問い合わせは、保護者の方から
                  ご連絡をお願いいたします。
                </p>
              </div>
            </section>

            {/* Section 9 */}
            <section>
              <div className="flex items-center mb-4">
                <div className="bg-purple-100 text-purple-600 rounded-lg w-10 h-10 flex items-center justify-center mr-4">
                  <Server className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">9. デバイス制限について</h2>
              </div>
              <div className="pl-14 space-y-4">
                <p className="text-slate-700 leading-relaxed">
                  本サービスでは、アカウントの不正利用や複数教室でのアカウント共有を防ぐため、
                  <strong className="text-slate-900">1アカウントあたり最大2台のデバイス</strong>でのみご利用いただける制限を設けています。
                </p>
                <div className="bg-purple-50 rounded-xl p-5 border border-purple-100">
                  <h3 className="font-bold text-purple-800 mb-3">デバイス制限の詳細</h3>
                  <ul className="space-y-2 text-purple-700">
                    <li className="flex items-start">
                      <span className="text-purple-500 mr-2">•</span>
                      <span>1アカウントで登録可能なデバイスは最大2台までです</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-500 mr-2">•</span>
                      <span>デバイスはブラウザのフィンガープリント技術により識別されます</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-500 mr-2">•</span>
                      <span>3台目以降のデバイスで利用する場合は、既存のデバイスを削除する必要があります</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-500 mr-2">•</span>
                      <span>塾や学校で複数の教室でアカウントを共有することは利用規約で禁止されています</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-purple-500 mr-2">•</span>
                      <span>30日以上アクセスのないデバイスは自動的に削除される場合があります</span>
                    </li>
                  </ul>
                </div>
                <p className="text-slate-700 leading-relaxed text-sm">
                  この制限により、アカウントのセキュリティを確保し、適切な利用を促進しています。
                  デバイス制限に関する詳細や、デバイスの削除方法については、サービス内の設定画面からご確認いただけます。
                </p>
              </div>
            </section>

            {/* Section 10 */}
            <section>
              <div className="flex items-center mb-4">
                <div className="bg-violet-100 text-violet-600 rounded-lg w-10 h-10 flex items-center justify-center mr-4">
                  <UserCheck className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">10. プライバシーポリシーの変更</h2>
              </div>
              <div className="pl-14">
                <p className="text-slate-700 leading-relaxed">
                  当社は、法令の改正やサービス内容の変更等に伴い、
                  本プライバシーポリシーを変更することがあります。
                  重要な変更がある場合は、本ページにて告知いたします。
                  変更後のプライバシーポリシーは、本ページに掲載した時点から
                  効力を生じるものとします。
                </p>
              </div>
            </section>

            {/* Section 11 - Contact */}
            <section>
              <div className="flex items-center mb-4">
                <div className="bg-green-100 text-green-600 rounded-lg w-10 h-10 flex items-center justify-center mr-4">
                  <Mail className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">10. お問い合わせ</h2>
              </div>
              <div className="pl-14">
                <p className="text-slate-700 leading-relaxed mb-4">
                  本プライバシーポリシーに関するお問い合わせは、
                  以下の連絡先までお願いいたします。
                </p>
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <p className="text-slate-700">
                    <strong>EduShift 運営事務局</strong><br />
                    <span className="text-slate-600">メール：katsu.yoshii@gmail.com</span>
                  </p>
                </div>
              </div>
            </section>

          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-sm text-slate-500">
            © 2025 EduShift. All rights reserved.
          </p>
        </div>
      </div>
    </main>
  );
}

