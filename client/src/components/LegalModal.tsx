import { useState } from 'react';

type Tab = 'privacy' | 'terms';

export default function LegalModal({ initialTab = 'privacy', onClose }: { initialTab?: Tab; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label="プライバシーポリシー・利用規約">
      <div className="bg-green-800 rounded-2xl p-5 max-w-md w-full shadow-2xl border border-green-600 my-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-yellow-400">
            {tab === 'privacy' ? 'プライバシーポリシー' : '利用規約'}
          </h2>
          <button onClick={onClose} className="text-green-400 hover:text-white font-bold text-xl">✕</button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('privacy')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${tab === 'privacy' ? 'bg-yellow-500 text-black' : 'bg-green-700 text-green-300 hover:bg-green-600'}`}
          >
            プライバシー
          </button>
          <button
            onClick={() => setTab('terms')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${tab === 'terms' ? 'bg-yellow-500 text-black' : 'bg-green-700 text-green-300 hover:bg-green-600'}`}
          >
            利用規約
          </button>
        </div>

        <div className="space-y-3 text-xs text-green-100 max-h-[65vh] overflow-y-auto pr-1">
          {tab === 'privacy' ? <PrivacyBody /> : <TermsBody />}
        </div>

        <p className="text-green-500 text-[10px] mt-4 text-right">最終更新: 2026-04-18</p>
      </div>
    </div>
  );
}

function PrivacyBody() {
  return (
    <>
      <p>Hit101（以下「本サービス」）を運営する個人開発者（以下「運営者」）は、利用者（以下「ユーザー」）のプライバシーを尊重し、本ポリシーに従って情報を取り扱います。</p>

      <Section title="1. 収集する情報">
        <ul className="list-disc list-inside space-y-1">
          <li>プレイヤー名：ユーザーが任意に入力した表示名（本名不要）</li>
          <li>プレイヤーID（UUID）：ブラウザで自動生成し localStorage に保存する識別子</li>
          <li>プレイ履歴：対戦数・累計ポイント・最終プレイ日時</li>
          <li>IPアドレス：サーバーへの接続時に自動的に記録（不正検知・監査ログ用途のみ）</li>
        </ul>
      </Section>

      <Section title="2. 利用目的">
        <ul className="list-disc list-inside space-y-1">
          <li>ゲームの進行、ランキング表示、再接続処理</li>
          <li>不正行為（チート・多重接続・迷惑行為）の検知と対応</li>
          <li>サービス品質の維持・改善</li>
        </ul>
      </Section>

      <Section title="3. 第三者提供">
        <p>法令に基づく開示要請がある場合を除き、収集した情報を第三者へ提供することはありません。</p>
      </Section>

      <Section title="4. Cookie／ローカルストレージ">
        <p>UUIDおよび一部の設定情報を localStorage に保存します。ブラウザの設定でクリアできます。</p>
      </Section>

      <Section title="5. 保持期間">
        <ul className="list-disc list-inside space-y-1">
          <li>プレイヤー統計：無期限（ユーザーからの削除申請があった場合は対応）</li>
          <li>監査ログ：ファイルローテーションにより順次削除</li>
        </ul>
      </Section>

      <Section title="6. 未成年者について">
        <p>13歳未満の方は保護者の同意のうえでご利用ください。</p>
      </Section>

      <Section title="7. お問い合わせ">
        <p>本ポリシーに関するお問い合わせは以下までお願いします。</p>
        <p className="text-yellow-300 break-all">xufangxiyin@gmail.com</p>
      </Section>

      <Section title="8. 改定">
        <p>本ポリシーは予告なく改定する場合があります。改定後は本ページに掲載した時点で効力を生じます。</p>
      </Section>
    </>
  );
}

function TermsBody() {
  return (
    <>
      <p>本利用規約（以下「本規約」）は、Hit101（以下「本サービス」）の利用条件を定めるものです。本サービスの利用により、本規約に同意したものとみなします。</p>

      <Section title="1. サービス内容">
        <p>本サービスは、ブラウザで動作する無料のリアルタイム対戦カードゲームです。登録不要でプレイできます。</p>
      </Section>

      <Section title="2. ポイント・ランキングの扱い">
        <ul className="list-disc list-inside space-y-1">
          <li>サービス内のポイント・順位は、ゲーム内の遊戯目的のみに使用されます</li>
          <li>ポイントは<strong className="text-yellow-300">現金・景品・その他の経済的利益と交換することはできません</strong></li>
          <li>ポイントの譲渡・売買は禁止します</li>
        </ul>
      </Section>

      <Section title="3. 禁止事項">
        <ul className="list-disc list-inside space-y-1">
          <li>不正なツール、ボット、自動化スクリプトの使用</li>
          <li>他のユーザーに対する誹謗中傷・嫌がらせ・迷惑行為</li>
          <li>意図的な切断・試合妨害の繰り返し</li>
          <li>本サービスの運営を妨害する行為</li>
          <li>サーバーへの不正アクセス、脆弱性を突く攻撃</li>
          <li>公序良俗に反する名前・表示の使用</li>
          <li>法令または本規約に違反する行為</li>
        </ul>
      </Section>

      <Section title="4. 利用停止">
        <p>運営者は、ユーザーが禁止事項に該当すると判断した場合、事前通告なく当該ユーザーの利用を停止することがあります。</p>
      </Section>

      <Section title="5. 免責事項">
        <ul className="list-disc list-inside space-y-1">
          <li>本サービスは現状有姿で提供され、継続的な稼働・不具合のないことを保証しません</li>
          <li>通信障害・サーバー障害・バグ等によりユーザーに生じた損害について、運営者は責任を負いません</li>
          <li>運営者は予告なく本サービスの内容変更・中断・終了を行うことがあります</li>
        </ul>
      </Section>

      <Section title="6. 知的財産">
        <p>本サービスに関する著作権その他の知的財産権は、運営者または正当な権利者に帰属します。</p>
      </Section>

      <Section title="7. 規約の変更">
        <p>運営者は必要に応じて本規約を変更することがあります。変更後の規約は本ページに掲載した時点で効力を生じます。</p>
      </Section>

      <Section title="8. 準拠法・管轄">
        <p>本規約は日本法に準拠し、本サービスに関する紛争は運営者の住所地を管轄する裁判所を専属的合意管轄とします。</p>
      </Section>

      <Section title="9. お問い合わせ">
        <p className="text-yellow-300 break-all">xufangxiyin@gmail.com</p>
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-yellow-300 font-bold mb-1">{title}</p>
      <div className="text-green-200 space-y-1 leading-relaxed">{children}</div>
    </div>
  );
}
