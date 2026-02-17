'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, FileText, Scale } from 'lucide-react';

type TabId = 'terms' | 'privacy' | 'tokushoho';

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'terms', label: '利用規約', icon: FileText },
  { id: 'privacy', label: 'プライバシーポリシー', icon: Shield },
  { id: 'tokushoho', label: '特定商取引法に基づく表記', icon: Scale },
];

function TermsContent() {
  return (
    <div className="space-y-10">
      {/* 第1条 */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">第1条（定義）</h3>
        <div className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm">
          {`本規約において、以下の用語は以下の意味を有するものとします。

1. 「本サービス」とは、当社が「Taskal AI」の名称で提供する国語記述答案のAI自動添削サービス（関連するWebサイト、アプリケーション、APIその他一切のサービスを含みます）をいいます。
2. 「当社」とは、EduShiftをいいます。
3. 「ユーザー」とは、本規約に同意のうえ本サービスを利用するすべての個人または法人をいいます。
4. 「法人ユーザー」とは、学習塾その他の教育機関として本サービスを利用する法人または団体をいいます。
5. 「個人ユーザー」とは、法人ユーザー以外のユーザーをいいます。
6. 「利用生徒」とは、本サービスを通じて答案を提出し添削を受ける生徒をいいます。
7. 「保護者」とは、利用生徒が未成年者である場合の親権者または法定代理人をいいます。
8. 「答案データ」とは、利用生徒が本サービスに入力・送信する記述答案その他のテキストデータをいいます。
9. 「添削結果」とは、答案データに対して本サービスのAIが生成する添削・評価・フィードバック等の情報をいいます。
10.「利用料金」とは、本サービスの利用に対してユーザーが支払うべき月額料金その他の対価をいいます。`}
        </div>
      </section>

      {/* 第2条 */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">第2条（アカウント登録・管理）</h3>
        <div className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm">
          {`1. ユーザーは、本サービスの利用にあたり、当社所定の方法によりアカウント登録を行い、登録時に正確かつ最新の情報を提供するものとします。
2. ユーザーは、1人につき1つのアカウントのみ登録できるものとします。
3. アカウント情報（ID・パスワード等）の管理責任はユーザーに帰属し、第三者に利用させてはなりません。
4. ユーザーは、アカウントの不正利用を発見した場合、直ちに当社に報告するものとします。
5. 法人ユーザーの場合、管理者アカウントを通じて利用生徒のアカウントを管理するものとします。`}
        </div>
      </section>

      {/* 第3条 */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">第3条（未成年者の利用）</h3>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 mb-4">
          <p className="text-amber-800 text-sm font-bold">重要条項</p>
        </div>
        <div className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm">
          {`1. 18歳未満の方が本サービスを利用する場合、事前に保護者の同意を得なければなりません。当社所定の方法により保護者の同意が確認できない場合、当該未成年者は本サービスを利用することができません。

2. 保護者が本規約への同意手続きを完了した場合、当該保護者は、利用生徒による本サービスの利用に関し、本規約に基づくすべての義務について連帯して責任を負うものとします。

3. 法人ユーザーが利用生徒に本サービスを利用させる場合、当該法人ユーザーは、利用生徒が未成年者であるときは、本サービスの利用開始前に保護者から書面またはこれに準ずる方法（電磁的方法を含みます）により同意を取得する責任を負うものとします。

4. 当社は、利用生徒が未成年者であることが判明し、かつ保護者の同意が確認できない場合、当該アカウントの利用を停止または削除することができるものとします。

5. 保護者は、いつでも当社所定の方法により、利用生徒のアカウントの利用停止またはデータの削除を請求することができます。`}
        </div>
      </section>

      {/* 第4条 */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">第4条（サービス内容）</h3>
        <div className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm">
          {`1. 本サービスは、AI技術を用いて国語記述答案の自動添削・評価・フィードバックを提供するものです。
2. 本サービスの処理はすべてAI（人工知能）により自動的に行われます。
3. 利用可能なプランおよび料金の詳細は、本サービスのWebサイト（料金プランページ）に掲載するものとします。
4. 当社は、本サービスの内容を当社の裁量により変更することができるものとします。ただし、ユーザーに重大な不利益を及ぼす変更を行う場合は、事前に通知するものとします。`}
        </div>
      </section>

      {/* 第5条 */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">第5条（AI添削結果の性質）</h3>
        <div className="bg-red-50 rounded-xl p-4 border border-red-100 mb-4">
          <p className="text-red-800 text-sm font-bold">最重要条項</p>
        </div>
        <div className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm">
          {`1. 本サービスのAI添削結果は、人工知能（AI）技術を用いて自動的に生成されるものであり、参考情報としての性質を有します。添削結果は、教師その他の教育専門家による添削・指導を代替するものではなく、学習上の最終的な判断はユーザー自身（未成年者の場合はその保護者を含みます）の責任において行ってください。

2. AIによる添削には、技術的な限界に起因する以下の可能性があり、当社はこれらについて完全性、正確性、有用性その他いかなる保証もいたしません。
  (1) 文法・語法・論理構成等の評価に誤りが含まれる場合
  (2) 模範解答・改善提案が不適切または不十分である場合
  (3) 特定の出題意図や採点基準を正確に反映しない場合
  (4) 同一の答案に対し、異なる時点で異なる評価が生成される場合

3. ユーザーは、入学試験、定期試験その他の重要な学業上の判断にあたり、本サービスの添削結果のみに依拠せず、教育機関、教師その他の専門家に確認することを強く推奨します。

4. 当社は、添削結果に基づいてユーザーまたは利用生徒が行った判断により生じた結果（試験の合否、成績評価等を含みますがこれに限りません）について、一切の責任を負わないものとします。`}
        </div>
      </section>

      {/* 第6条 */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">第6条（料金・支払い）</h3>
        <div className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm">
          {`1. 本サービスの有料プランの利用料金は、月額サブスクリプション方式とし、料金の詳細は本サービスのWebサイトに掲載するものとします。
2. 初回登録のユーザーには、無料トライアルとして3回分の無料採点を提供します。
3. 支払方法は、クレジットカード（Visa、Mastercard、JCB、American Express）によるものとします。
4. 利用料金はすべて税込価格で表示されます。`}
        </div>
      </section>

      {/* 第7条 */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">第7条（自動更新・解約）</h3>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 mb-4">
          <p className="text-amber-800 text-sm font-bold">重要条項</p>
        </div>
        <div className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm">
          {`1. 本サービスの有料プランは、ユーザーが解約手続きを完了しない限り、各契約期間の満了日に同一条件で自動的に更新されます。

2. 無料トライアル期間は、アカウント登録日から起算して14日間とします。無料トライアル期間の終了日までに解約手続きが完了しない場合、翌日よりユーザーが選択した有料プランの利用料金が自動的に課金されます。当社は、トライアル期間終了の3日前までに、登録されたメールアドレス宛てに課金開始の事前通知を行います。

3. ユーザーは、本サービスのアカウント設定画面から、いつでも解約手続きを行うことができます。解約手続きが完了した場合、当該契約期間の満了日まで本サービスを利用することができ、満了日の翌日以降は有料機能を利用することができなくなります。

4. 契約期間の途中で解約した場合、既に支払済みの利用料金の日割り計算による返金は行いません。ただし、当社の責めに帰すべき事由による場合はこの限りではありません。

5. 本サービスでは、答案データおよび添削結果はサーバーに保存されません。採点処理の完了後、これらのデータは即時破棄されます。ユーザーは、採点結果が画面に表示されている間に、自身の責任でデータを保存してください。解約後、アカウント情報は90日間保持された後、完全に削除されます。`}
        </div>
      </section>

      {/* 第8条 */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">第8条（知的財産権）</h3>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 mb-4">
          <p className="text-amber-800 text-sm font-bold">重要条項</p>
        </div>
        <div className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm">
          {`1. 本サービスに関するソフトウェア、アルゴリズム、デザイン、ロゴ、商標その他の知的財産権は、すべて当社または当社にライセンスを許諾した第三者に帰属します。

2. 答案データに関する著作権その他の権利は、利用生徒（またはその法定代理人）に帰属します。当社は、答案データについて、本サービスの提供（AI添削処理を含みます）に必要な範囲でのみ利用する権利を有します。

3. 添削結果に関する著作権は当社に帰属します。当社は、ユーザーに対し、添削結果を個人の学習目的（法人ユーザーの場合は、当該法人が運営する教育事業の目的）で利用する非独占的かつ譲渡不能な権利を許諾します。

4. 当社は、本サービスの品質向上および改善を目的として、利用回数・利用日時等の統計情報を収集・分析することがあります。なお、答案データおよび添削結果はサーバーに保存されないため、これらを用いた分析やAI学習は行いません。

5. ユーザーは、本サービスに出題文・問題文を入力する場合、当該出題文・問題文に関する著作権その他の第三者の権利を侵害しないことを保証するものとします。`}
        </div>
      </section>

      {/* 第9条 */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">第9条（禁止事項）</h3>
        <div className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm">
          {`ユーザーは、本サービスの利用にあたり、以下の行為を行ってはなりません。

(1) 当社またはその委託先のサーバーその他のコンピュータに不正にアクセスし、またはこれを試みる行為
(2) 本サービスのソフトウェアを逆コンパイル、逆アセンブル、リバースエンジニアリングする行為
(3) 自己のアカウントを第三者に利用させ、または第三者のアカウントを利用する行為
(4) 本サービスの添削結果を、当社の事前の書面による承諾なく、商業目的で第三者に販売、再配布、公衆送信する行為
(5) 本サービスに対し、APIを通じたものを含め、通常の利用の範囲を超えた大量のアクセスを行う行為
(6) 虚偽の情報を登録し、または年齢その他の属性を偽る行為
(7) 公序良俗に反する内容、差別的な内容、わいせつな内容その他不適切なテキストを入力する行為
(8) 他のユーザーの利用を妨害する行為
(9) 法令または本規約に違反する行為
(10) 前各号に準ずる行為で、当社が不適切と判断する行為`}
        </div>
      </section>

      {/* 第10条 */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">第10条（サービスの変更・中断・終了）</h3>
        <div className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm">
          {`1. 当社は、ユーザーに事前に通知することなく、本サービスの内容を変更し、または機能を追加・削除することができるものとします。ただし、ユーザーに重大な不利益を及ぼす変更を行う場合は、変更の効力発生日の30日前までに通知するものとします。

2. 当社は、以下のいずれかに該当する場合、本サービスの全部または一部を一時的に中断することができるものとします。
  (1) システムの保守・点検・更新を行う場合
  (2) 地震、落雷、火災、停電、天災その他の不可抗力の場合
  (3) 第三者によるサイバー攻撃その他のセキュリティ上の理由
  (4) 利用するLLMプロバイダーのサービスが中断した場合
  (5) その他、運用上または技術上の理由により中断が必要な場合

3. 当社は、90日前までにユーザーに通知することにより、本サービスの全部を終了することができるものとします。なお、本サービスでは答案データおよび添削結果はサーバーに保存されないため、サービス終了時のデータエクスポートの対象外となります。`}
        </div>
      </section>

      {/* 第11条 */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">第11条（損害賠償の制限）</h3>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 mb-4">
          <p className="text-amber-800 text-sm font-bold">重要条項</p>
        </div>
        <div className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm">
          {`1. 当社は、本サービスの利用に関連してユーザーに生じた損害について、当社に故意または重過失がある場合を除き、以下の範囲を上限として賠償の責任を負うものとします。
  (1) 個人ユーザーの場合：損害発生月の前月から遡って12か月間にユーザーが当社に支払った利用料金の総額
  (2) 法人ユーザーの場合：同上

2. 前項にかかわらず、当社は、以下の損害については、当社に故意または重過失がある場合を除き、一切の責任を負わないものとします。
  (1) 間接損害、付随的損害、特別損害、懲罰的損害または結果損害
  (2) 逸失利益、逸失データ、営業機会の喪失
  (3) 第三者が提供するサービス（LLMプロバイダーを含む）の不具合に起因する損害

3. 前2項の規定は、当社の故意または重過失に基づく損害賠償責任を制限するものではありません。

4. ユーザーが消費者契約法に定める「消費者」に該当する場合、本条の規定のうち、同法に反する部分は適用されず、同法の規定が優先して適用されるものとします。`}
        </div>
      </section>

      {/* 第12条〜第18条 */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">第12条〜第18条（その他）</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left py-3 px-4 font-bold text-slate-700 border border-slate-200 whitespace-nowrap">条項</th>
                <th className="text-left py-3 px-4 font-bold text-slate-700 border border-slate-200">内容</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-3 px-4 border border-slate-200 text-slate-800 font-medium whitespace-nowrap">第12条</td>
                <td className="py-3 px-4 border border-slate-200 text-slate-700">反社会的勢力の排除 — ユーザーが反社会的勢力に該当しないことを表明・保証するものとします。</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="py-3 px-4 border border-slate-200 text-slate-800 font-medium whitespace-nowrap">第13条</td>
                <td className="py-3 px-4 border border-slate-200 text-slate-700">秘密保持 — ユーザーは、本サービスの利用を通じて知り得た当社の技術上・営業上の情報を第三者に開示・漏洩してはなりません。</td>
              </tr>
              <tr>
                <td className="py-3 px-4 border border-slate-200 text-slate-800 font-medium whitespace-nowrap">第14条</td>
                <td className="py-3 px-4 border border-slate-200 text-slate-700">権利義務の譲渡禁止 — ユーザーは、当社の事前の書面による承諾なく、本規約上の地位または権利義務を第三者に譲渡し、または担保に供することはできません。</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="py-3 px-4 border border-slate-200 text-slate-800 font-medium whitespace-nowrap">第15条</td>
                <td className="py-3 px-4 border border-slate-200 text-slate-700">分離可能性 — 本規約のいずれかの条項が無効または執行不能と判断された場合でも、残りの条項の効力には影響を及ぼさないものとします。</td>
              </tr>
              <tr>
                <td className="py-3 px-4 border border-slate-200 text-slate-800 font-medium whitespace-nowrap">第16条</td>
                <td className="py-3 px-4 border border-slate-200 text-slate-700">規約の変更 — 当社は、民法第548条の4の規定に基づき、変更の効力発生日の30日前までに通知することにより、本規約を変更することができます。</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="py-3 px-4 border border-slate-200 text-slate-800 font-medium whitespace-nowrap">第17条</td>
                <td className="py-3 px-4 border border-slate-200 text-slate-700">準拠法・管轄裁判所 — 本規約は日本法に準拠し、本サービスに関する一切の紛争は東京地方裁判所を第一審の専属的合意管轄裁判所とします。</td>
              </tr>
              <tr>
                <td className="py-3 px-4 border border-slate-200 text-slate-800 font-medium whitespace-nowrap">第18条</td>
                <td className="py-3 px-4 border border-slate-200 text-slate-700">連絡方法 — 当社からユーザーへの通知は、登録されたメールアドレスへの送信または本サービス上での掲示により行います。ユーザーから当社への連絡は、当社所定の問い合わせフォームまたはメールにより行うものとします。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 附則 */}
      <section className="pt-4 border-t border-slate-200">
        <p className="text-sm text-slate-500">制定日: 2026年2月7日</p>
      </section>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div className="space-y-10">
      {/* 基本方針 */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">1. 基本方針</h3>
        <p className="text-slate-700 leading-relaxed text-sm">
          EduShift（以下「当社」といいます）は、お客様の個人情報保護を最重要事項と考え、
          関連する法令を遵守し、適切な管理を行います。本プライバシーポリシーは、
          当社が提供するTaskal AI（以下「本サービス」といいます）における
          個人情報の取り扱いについて定めるものです。
        </p>
      </section>

      {/* 収集する個人情報 */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">2. 収集する個人情報</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left py-3 px-4 font-bold text-slate-700 border border-slate-200 whitespace-nowrap">カテゴリ</th>
                <th className="text-left py-3 px-4 font-bold text-slate-700 border border-slate-200">項目</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-3 px-4 border border-slate-200 text-slate-800 font-medium whitespace-nowrap align-top">アカウント情報</td>
                <td className="py-3 px-4 border border-slate-200 text-slate-700">氏名、メールアドレス、パスワード（ハッシュ化）、生年月日/年齢区分、学年・学校種別、電話番号（任意）</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="py-3 px-4 border border-slate-200 text-slate-800 font-medium whitespace-nowrap align-top">保護者情報</td>
                <td className="py-3 px-4 border border-slate-200 text-slate-700">保護者氏名、メールアドレス、同意記録（日時・方法・IPアドレス）</td>
              </tr>
              <tr>
                <td className="py-3 px-4 border border-slate-200 text-slate-800 font-medium whitespace-nowrap align-top">法人ユーザー情報</td>
                <td className="py-3 px-4 border border-slate-200 text-slate-700">法人名、担当者氏名・役職、所在地・連絡先</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="py-3 px-4 border border-slate-200 text-slate-800 font-medium whitespace-nowrap align-top">決済情報</td>
                <td className="py-3 px-4 border border-slate-200 text-slate-700">クレジットカード下4桁・トークン情報（決済代行経由）、請求先情報</td>
              </tr>
              <tr>
                <td className="py-3 px-4 border border-slate-200 text-slate-800 font-medium whitespace-nowrap align-top">利用データ</td>
                <td className="py-3 px-4 border border-slate-200 text-slate-700">利用履歴（回数・日時・機能）<br />※答案データおよび添削結果はサーバーに保存されません（処理完了後に即時破棄）</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="py-3 px-4 border border-slate-200 text-slate-800 font-medium whitespace-nowrap align-top">技術情報</td>
                <td className="py-3 px-4 border border-slate-200 text-slate-700">IPアドレス、ブラウザ情報、デバイス情報、Cookie、アクセスログ</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 情報の利用目的 */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">3. 情報の利用目的</h3>
        <ul className="space-y-2 text-slate-700 text-sm">
          <li className="flex items-start">
            <span className="text-indigo-500 mr-2 mt-0.5">&#8226;</span>
            本サービスの提供（答案の採点・フィードバック生成）
          </li>
          <li className="flex items-start">
            <span className="text-indigo-500 mr-2 mt-0.5">&#8226;</span>
            サービスの品質向上および改善
          </li>
          <li className="flex items-start">
            <span className="text-indigo-500 mr-2 mt-0.5">&#8226;</span>
            システムの安全性・安定性の確保
          </li>
          <li className="flex items-start">
            <span className="text-indigo-500 mr-2 mt-0.5">&#8226;</span>
            利用状況の統計・分析（個人を特定しない形式）
          </li>
          <li className="flex items-start">
            <span className="text-indigo-500 mr-2 mt-0.5">&#8226;</span>
            ユーザーへの重要な通知・連絡
          </li>
        </ul>
      </section>

      {/* 第三者提供 */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">4. 第三者提供（LLMプロバイダーへの送信）</h3>
        <div className="bg-blue-50 rounded-xl p-5 border border-blue-100 mb-4">
          <h4 className="font-bold text-blue-800 mb-3">重要：AIサービスプロバイダーへのデータ送信について</h4>
          <p className="text-blue-700 text-sm leading-relaxed mb-3">
            当社は、AI添削機能を提供するため、以下のAIサービスプロバイダーに答案データの処理を委託しています。
          </p>
          <div className="space-y-2 text-sm">
            <p className="text-blue-800 font-medium">委託先：</p>
            <ul className="space-y-1 text-blue-700 ml-4">
              <li>&#8226; Google LLC（米国）- Gemini API</li>
            </ul>
            <p className="text-blue-600 text-xs mt-2">※利用プロバイダーは変更される場合があり、変更時には本ポリシーを更新します。</p>
          </div>
        </div>
        <div className="space-y-2 text-slate-700 text-sm">
          <p className="font-medium text-slate-800">保護措置：</p>
          <ul className="space-y-2 ml-4">
            <li className="flex items-start">
              <span className="text-green-500 mr-2">&#10003;</span>
              送信データは答案テキストのみ。氏名等の直接的識別情報は送信しません
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">&#10003;</span>
              LLMプロバイダーは送信データをAIモデルの学習に使用しない設定で運用しています
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">&#10003;</span>
              送信データはLLMプロバイダーのサーバー上で処理後、最大30日で削除されます
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">&#10003;</span>
              データ処理契約（DPA）を締結し、セキュリティ措置・守秘義務を確保しています
            </li>
          </ul>
        </div>
      </section>

      {/* 子どものデータに関する特則 */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">5. 子どものデータに関する特則</h3>
        <div className="bg-amber-50 rounded-xl p-5 border border-amber-100 mb-4">
          <h4 className="font-bold text-amber-800 mb-2">16歳未満の利用生徒について</h4>
        </div>
        <ul className="space-y-2 text-slate-700 text-sm ml-4">
          <li className="flex items-start">
            <span className="text-amber-500 mr-2">(1)</span>
            アカウント登録には保護者の同意を必須とします
          </li>
          <li className="flex items-start">
            <span className="text-amber-500 mr-2">(2)</span>
            サービス提供に直接必要な情報のみ収集します（マーケティング目的の収集は行いません）
          </li>
          <li className="flex items-start">
            <span className="text-amber-500 mr-2">(3)</span>
            マーケティング目的のプロファイリング・ターゲティング広告には使用しません
          </li>
          <li className="flex items-start">
            <span className="text-amber-500 mr-2">(4)</span>
            保護者は開示・訂正・削除・利用停止・アカウント即時削除を請求できます
          </li>
          <li className="flex items-start">
            <span className="text-amber-500 mr-2">(5)</span>
            アカウント削除後30日以内に全データを削除します
          </li>
          <li className="flex items-start">
            <span className="text-amber-500 mr-2">(6)</span>
            LLM送信時、個人識別情報を自動スキャン・マスキング処理を行います
          </li>
        </ul>
      </section>

      {/* 画像データの取り扱い */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">6. 画像データの取り扱い</h3>
        <div className="bg-blue-50 rounded-xl p-5 border border-blue-100 mb-4">
          <h4 className="font-bold text-blue-800 mb-2">重要：アップロードされた画像について</h4>
          <ul className="space-y-2 text-blue-700 text-sm">
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">&#10003;</span>
              採点処理が完了次第、サーバーから<strong>自動的に削除</strong>されます
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">&#10003;</span>
              AIモデルの学習やトレーニングには<strong>一切使用されません</strong>
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">&#10003;</span>
              第三者への提供や開示は<strong>行いません</strong>
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">&#10003;</span>
              当社による画像の保存や蓄積は<strong>行いません</strong>
            </li>
          </ul>
        </div>
      </section>

      {/* データ保持期間 */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">7. データ保持期間</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left py-3 px-4 font-bold text-slate-700 border border-slate-200 whitespace-nowrap">データの種類</th>
                <th className="text-left py-3 px-4 font-bold text-slate-700 border border-slate-200">保持期間</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-3 px-4 border border-slate-200 text-slate-800 font-medium whitespace-nowrap">アカウント情報</td>
                <td className="py-3 px-4 border border-slate-200 text-slate-700">アカウント存続中 + 解約後90日間</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="py-3 px-4 border border-slate-200 text-slate-800 font-medium whitespace-nowrap">保護者同意記録</td>
                <td className="py-3 px-4 border border-slate-200 text-slate-700">同意取得日から5年間</td>
              </tr>
              <tr>
                <td className="py-3 px-4 border border-slate-200 text-slate-800 font-medium whitespace-nowrap">答案データ・添削結果</td>
                <td className="py-3 px-4 border border-slate-200 text-slate-700">保存しません（採点処理完了後、サーバーから即時破棄されます。結果はブラウザ上にのみ表示され、ページを離れると消去されます）</td>
              </tr>
              <tr>
                <td className="py-3 px-4 border border-slate-200 text-slate-800 font-medium whitespace-nowrap">決済情報</td>
                <td className="py-3 px-4 border border-slate-200 text-slate-700">最終取引日から7年間（法令要件）</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="py-3 px-4 border border-slate-200 text-slate-800 font-medium whitespace-nowrap">アクセスログ</td>
                <td className="py-3 px-4 border border-slate-200 text-slate-700">取得日から1年間</td>
              </tr>
              <tr>
                <td className="py-3 px-4 border border-slate-200 text-slate-800 font-medium whitespace-nowrap">Cookie</td>
                <td className="py-3 px-4 border border-slate-200 text-slate-700">最大13か月間</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* セキュリティ対策 */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">8. セキュリティ対策</h3>
        <ul className="space-y-2 text-slate-700 text-sm">
          <li className="flex items-start">
            <span className="text-indigo-500 mr-2 mt-0.5">&#8226;</span>
            SSL/TLS暗号化通信の使用
          </li>
          <li className="flex items-start">
            <span className="text-indigo-500 mr-2 mt-0.5">&#8226;</span>
            アクセス権限の適切な管理
          </li>
          <li className="flex items-start">
            <span className="text-indigo-500 mr-2 mt-0.5">&#8226;</span>
            定期的なセキュリティ診断の実施
          </li>
          <li className="flex items-start">
            <span className="text-indigo-500 mr-2 mt-0.5">&#8226;</span>
            データの自動削除機能の実装
          </li>
        </ul>
      </section>

      {/* デバイス制限 */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">9. デバイス制限について</h3>
        <p className="text-slate-700 leading-relaxed text-sm mb-4">
          本サービスでは、アカウントの不正利用や複数教室でのアカウント共有を防ぐため、
          <strong className="text-slate-900">1アカウントあたり最大2台のデバイス</strong>でのみご利用いただける制限を設けています。
        </p>
        <div className="bg-purple-50 rounded-xl p-5 border border-purple-100">
          <ul className="space-y-2 text-purple-700 text-sm">
            <li className="flex items-start">
              <span className="text-purple-500 mr-2">&#8226;</span>
              1アカウントで登録可能なデバイスは最大2台までです
            </li>
            <li className="flex items-start">
              <span className="text-purple-500 mr-2">&#8226;</span>
              デバイスはブラウザのフィンガープリント技術により識別されます
            </li>
            <li className="flex items-start">
              <span className="text-purple-500 mr-2">&#8226;</span>
              3台目以降のデバイスで利用する場合は、既存のデバイスを削除する必要があります
            </li>
            <li className="flex items-start">
              <span className="text-purple-500 mr-2">&#8226;</span>
              30日以上アクセスのないデバイスは自動的に削除される場合があります
            </li>
          </ul>
        </div>
      </section>

      {/* ポリシーの変更 */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">10. プライバシーポリシーの変更</h3>
        <p className="text-slate-700 leading-relaxed text-sm">
          当社は、法令の改正やサービス内容の変更等に伴い、本プライバシーポリシーを変更することがあります。
          重要な変更がある場合は、本ページにて告知いたします。
          変更後のプライバシーポリシーは、本ページに掲載した時点から効力を生じるものとします。
        </p>
      </section>

      {/* お問い合わせ */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">11. お問い合わせ</h3>
        <p className="text-slate-700 leading-relaxed text-sm mb-4">
          本プライバシーポリシーに関するお問い合わせは、以下の連絡先までお願いいたします。
        </p>
        <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
          <p className="text-slate-700 text-sm">
            <strong>EduShift 運営事務局</strong><br />
            メール：katsu.yoshii@gmail.com
          </p>
        </div>
      </section>

      {/* 附則 */}
      <section className="pt-4 border-t border-slate-200">
        <p className="text-sm text-slate-500">制定日: 2026年2月7日</p>
      </section>
    </div>
  );
}

function TokushohoContent() {
  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <dl className="divide-y divide-slate-200">
          {[
            { term: '販売業者', desc: 'EduShift' },
            { term: '代表者', desc: '吉井勝彦' },
            { term: '所在地', desc: '〒150-0021\n東京都渋谷区恵比寿西2丁目4番8号ウィンド恵比寿ビル8F' },
            { term: '電話番号', desc: '090-6028-3779（受付: 平日10:00〜17:00）' },
            { term: 'メールアドレス', desc: 'katsu.yoshii@gmail.com' },
            { term: 'ホームページURL', desc: 'https://www.edu-shift.com/' },
            { term: 'サービスの名称', desc: 'Taskal AI（国語記述答案 AI自動添削システム）' },
            {
              term: '販売価格（税込）',
              desc: null,
              table: [
                { plan: 'ライトプラン', price: '月額 ¥980（税込）※期間限定価格' },
                { plan: 'スタンダードプラン', price: '月額 ¥1,980（税込）※期間限定価格' },
                { plan: '無制限プラン', price: '月額 ¥4,980（税込）※期間限定価格' },
              ],
            },
            { term: '販売価格以外の負担費用', desc: 'インターネット接続料金・通信料金' },
            { term: '支払方法', desc: 'クレジットカード（Visa, Mastercard, JCB, AMEX）' },
            { term: '支払時期', desc: '毎月1日に当月分を自動課金' },
            { term: '役務の提供時期', desc: '決済完了後、直ちに利用可能' },
            { term: '契約期間', desc: '月単位の自動更新' },
            {
              term: '返品・キャンセル',
              desc: `・デジタルサービスの性質上、提供開始後の返金は原則不可
・無料トライアル期間中の解約は費用ゼロ
・当社の責に帰すべき事由の場合は相当額を返金`,
            },
            {
              term: '特別な販売条件',
              desc: `・18歳未満の利用には保護者の同意が必要
・無料トライアル（初回3回分の無料採点）あり`,
            },
          ].map((item, i) => (
            <div key={i} className="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-bold text-slate-800 mb-1 sm:mb-0">{item.term}</dt>
              <dd className="text-sm text-slate-700 sm:col-span-2">
                {item.table ? (
                  <table className="w-full border-collapse">
                    <tbody>
                      {item.table.map((row, j) => (
                        <tr key={j} className={j % 2 === 1 ? 'bg-slate-50' : ''}>
                          <td className="py-2 px-3 border border-slate-200 text-slate-800 font-medium">{row.plan}</td>
                          <td className="py-2 px-3 border border-slate-200">{row.price}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <span className="whitespace-pre-wrap">{item.desc}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* 附則 */}
      <section className="pt-4 border-t border-slate-200">
        <p className="text-sm text-slate-500">制定日: 2026年2月7日</p>
      </section>
    </div>
  );
}

export default function LegalPage() {
  const [activeTab, setActiveTab] = useState<TabId>('terms');

  // Handle URL hash on mount and hash change
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '') as TabId;
      if (hash === 'terms' || hash === 'privacy' || hash === 'tokushoho') {
        setActiveTab(hash);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    window.history.replaceState(null, '', `#${tabId}`);
  };

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
          href="/grading"
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
            利用規約・プライバシーポリシー
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            サービスのご利用条件および個人情報の取り扱いについて
          </p>
          <p className="text-sm text-slate-500 mt-4">
            最終更新日: 2026年2月7日
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 bg-slate-100 rounded-xl p-1.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-bold transition-all ${isActive
                      ? 'bg-white text-indigo-700 shadow-md'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white/60 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[2rem] overflow-hidden border border-white/60 ring-1 ring-white/50">
          <div className="p-8 md:p-12">
            {activeTab === 'terms' && <TermsContent />}
            {activeTab === 'privacy' && <PrivacyContent />}
            {activeTab === 'tokushoho' && <TokushohoContent />}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-sm text-slate-500">
            &copy; 2025 EduShift. All rights reserved.
          </p>
        </div>
      </div>
    </main>
  );
}
