// LegalModal.tsx
// プライバシーポリシー / 利用規約。
// コンテンツは ja/en の辞書で持ち、現在の locale で切り替えて描画する。

import { useState } from 'react';
import { useLocale, getLocale } from '../i18n';

type Tab = 'privacy' | 'terms';

interface Section {
  title: string;
  body?: string;
  items?: string[];
  itemsHtml?: { __html: string }[];
  contactEmail?: string;
}

interface Doc {
  title: string;
  intro?: string;
  sections: Section[];
}

const PRIVACY: Record<string, Doc> = {
  ja: {
    title: 'プライバシーポリシー',
    intro: 'Hit101(以下「本サービス」)を運営する個人開発者(以下「運営者」)は、利用者(以下「ユーザー」)のプライバシーを尊重し、本ポリシーに従って情報を取り扱います。',
    sections: [
      { title: '1. 収集する情報', items: [
        'プレイヤー名:ユーザーが任意に入力した表示名(本名不要)',
        'プレイヤーID(UUID):ブラウザで自動生成し localStorage に保存する識別子',
        'プレイ履歴:対戦数・累計ポイント・最終プレイ日時',
        'IPアドレス:サーバーへの接続時に自動的に記録(不正検知・監査ログ用途のみ)',
      ]},
      { title: '2. 利用目的', items: [
        'ゲームの進行、ランキング表示、再接続処理',
        '不正行為(チート・多重接続・迷惑行為)の検知と対応',
        'サービス品質の維持・改善',
      ]},
      { title: '3. 第三者提供', body: '法令に基づく開示要請がある場合を除き、収集した情報を第三者へ提供することはありません。' },
      { title: '4. Cookie/ローカルストレージ', body: 'UUIDおよび一部の設定情報を localStorage に保存します。ブラウザの設定でクリアできます。' },
      { title: '5. 保持期間', items: [
        'プレイヤー統計:無期限(ユーザーからの削除申請があった場合は対応)',
        '監査ログ:ファイルローテーションにより順次削除',
      ]},
      { title: '6. 未成年者について', body: '13歳未満の方は保護者の同意のうえでご利用ください。' },
      { title: '7. お問い合わせ', body: '本ポリシーに関するお問い合わせは以下までお願いします。', contactEmail: 'solabstudio.jp@gmail.com' },
      { title: '8. 改定', body: '本ポリシーは予告なく改定する場合があります。改定後は本ページに掲載した時点で効力を生じます。' },
    ],
  },
  en: {
    title: 'Privacy Policy',
    intro: 'The individual developer who operates Hit101 (the "Service") respects users\' privacy and handles information according to this policy.',
    sections: [
      { title: '1. Information We Collect', items: [
        'Player name: voluntary display name (no real name required)',
        'Player ID (UUID): generated and stored in browser localStorage',
        'Play history: games played, cumulative points, last play time',
        'IP address: recorded on connection (anti-abuse and audit log only)',
      ]},
      { title: '2. Purpose of Use', items: [
        'Running the game, leaderboard display, reconnection',
        'Detecting and responding to abuse (cheats, multi-connections, harassment)',
        'Service quality maintenance and improvement',
      ]},
      { title: '3. Sharing with Third Parties', body: 'We do not share collected information with third parties, except when required by law.' },
      { title: '4. Cookies / Local Storage', body: 'We save the UUID and some settings in localStorage. You can clear them in your browser settings.' },
      { title: '5. Retention', items: [
        'Player stats: indefinite (we honor user deletion requests)',
        'Audit logs: rotated and deleted automatically over time',
      ]},
      { title: '6. Minors', body: 'Users under 13 should obtain parental consent before using the Service.' },
      { title: '7. Contact', body: 'For inquiries about this policy, please contact us at:', contactEmail: 'solabstudio.jp@gmail.com' },
      { title: '8. Revisions', body: 'This policy may be revised without notice. Revisions take effect when posted on this page.' },
    ],
  },
};

const TERMS: Record<string, Doc> = {
  ja: {
    title: '利用規約',
    intro: '本利用規約(以下「本規約」)は、Hit101(以下「本サービス」)の利用条件を定めるものです。本サービスの利用により、本規約に同意したものとみなします。',
    sections: [
      { title: '1. サービス内容', body: '本サービスは、ブラウザで動作する無料のリアルタイム対戦カードゲームです。登録不要でプレイできます。' },
      { title: '2. ポイント・ランキングの扱い', itemsHtml: [
        { __html: 'サービス内のポイント・順位は、ゲーム内の遊戯目的のみに使用されます' },
        { __html: 'ポイントは<strong class="text-yellow-300">現金・景品・その他の経済的利益と交換することはできません</strong>' },
        { __html: 'ポイントの譲渡・売買は禁止します' },
      ]},
      { title: '3. 禁止事項', items: [
        '不正なツール、ボット、自動化スクリプトの使用',
        '他のユーザーに対する誹謗中傷・嫌がらせ・迷惑行為',
        '意図的な切断・試合妨害の繰り返し',
        '本サービスの運営を妨害する行為',
        'サーバーへの不正アクセス、脆弱性を突く攻撃',
        '公序良俗に反する名前・表示の使用',
        '法令または本規約に違反する行為',
      ]},
      { title: '4. 利用停止', body: '運営者は、ユーザーが禁止事項に該当すると判断した場合、事前通告なく当該ユーザーの利用を停止することがあります。' },
      { title: '5. 免責事項', items: [
        '本サービスは現状有姿で提供され、継続的な稼働・不具合のないことを保証しません',
        '通信障害・サーバー障害・バグ等によりユーザーに生じた損害について、運営者は責任を負いません',
        '運営者は予告なく本サービスの内容変更・中断・終了を行うことがあります',
      ]},
      { title: '6. 知的財産', body: '本サービスに関する著作権その他の知的財産権は、運営者または正当な権利者に帰属します。' },
      { title: '7. 規約の変更', body: '運営者は必要に応じて本規約を変更することがあります。変更後の規約は本ページに掲載した時点で効力を生じます。' },
      { title: '8. 準拠法・管轄', body: '本規約は日本法に準拠し、本サービスに関する紛争は運営者の住所地を管轄する裁判所を専属的合意管轄とします。' },
      { title: '9. お問い合わせ', contactEmail: 'solabstudio.jp@gmail.com' },
    ],
  },
  en: {
    title: 'Terms of Service',
    intro: 'These Terms of Service ("Terms") govern your use of Hit101 (the "Service"). By using the Service, you agree to these Terms.',
    sections: [
      { title: '1. Service', body: 'The Service is a free real-time browser card game. No registration is required.' },
      { title: '2. Points and Leaderboard', itemsHtml: [
        { __html: 'Points and rankings are for in-game entertainment use only.' },
        { __html: 'Points <strong class="text-yellow-300">cannot be exchanged for cash, prizes, or any economic benefit</strong>.' },
        { __html: 'Transferring or selling points is prohibited.' },
      ]},
      { title: '3. Prohibited Acts', items: [
        'Use of cheats, bots, or automation scripts',
        'Defamation, harassment, or annoyance toward other users',
        'Repeated intentional disconnections or sabotage',
        'Interference with the operation of the Service',
        'Unauthorized access or attacks exploiting vulnerabilities',
        'Use of names or displays violating public order',
        'Acts violating law or these Terms',
      ]},
      { title: '4. Suspension', body: 'The operator may suspend a user without notice if the user is judged to violate the prohibited acts.' },
      { title: '5. Disclaimer', items: [
        'The Service is provided "as is" with no guarantee of continuous operation or absence of bugs.',
        'The operator is not liable for damages caused by network failures, server outages, bugs, etc.',
        'The operator may modify, suspend, or terminate the Service at any time without notice.',
      ]},
      { title: '6. Intellectual Property', body: 'All copyrights and other intellectual property rights related to the Service belong to the operator or rightful holders.' },
      { title: '7. Changes', body: 'The operator may revise these Terms as needed. Revisions take effect when posted on this page.' },
      { title: '8. Governing Law / Jurisdiction', body: 'These Terms are governed by Japanese law, and disputes shall be subject to the exclusive jurisdiction of the court covering the operator\'s address.' },
      { title: '9. Contact', contactEmail: 'solabstudio.jp@gmail.com' },
    ],
  },
};

const LABELS: Record<string, { privacy: string; terms: string; updated: string; close: string }> = {
  ja: { privacy: 'プライバシー', terms: '利用規約', updated: '最終更新: 2026-04-18', close: '閉じる' },
  en: { privacy: 'Privacy', terms: 'Terms', updated: 'Last updated: 2026-04-18', close: 'Close' },
};

export default function LegalModal({ initialTab = 'privacy', onClose }: { initialTab?: Tab; onClose: () => void }) {
  useLocale();
  const locale = getLocale();
  const labels = LABELS[locale] || LABELS.ja;
  const [tab, setTab] = useState<Tab>(initialTab);
  const doc = tab === 'privacy' ? (PRIVACY[locale] || PRIVACY.ja) : (TERMS[locale] || TERMS.ja);

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="bg-green-800 rounded-2xl p-5 max-w-md w-full shadow-2xl border border-green-600 my-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-yellow-400">{doc.title}</h2>
          <button onClick={onClose} className="text-green-400 hover:text-white font-bold text-xl" aria-label={labels.close}>✕</button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('privacy')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${tab === 'privacy' ? 'bg-yellow-500 text-black' : 'bg-green-700 text-green-300 hover:bg-green-600'}`}
          >
            {labels.privacy}
          </button>
          <button
            onClick={() => setTab('terms')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${tab === 'terms' ? 'bg-yellow-500 text-black' : 'bg-green-700 text-green-300 hover:bg-green-600'}`}
          >
            {labels.terms}
          </button>
        </div>

        <div className="space-y-3 text-xs text-green-100 max-h-[65vh] overflow-y-auto pr-1">
          {doc.intro && <p>{doc.intro}</p>}
          {doc.sections.map((s, i) => (
            <div key={i}>
              <p className="text-yellow-300 font-bold mb-1">{s.title}</p>
              <div className="text-green-200 space-y-1 leading-relaxed">
                {s.body && <p>{s.body}</p>}
                {s.items && (
                  <ul className="list-disc list-inside space-y-1">
                    {s.items.map((it, j) => <li key={j}>{it}</li>)}
                  </ul>
                )}
                {s.itemsHtml && (
                  <ul className="list-disc list-inside space-y-1">
                    {s.itemsHtml.map((it, j) => <li key={j} dangerouslySetInnerHTML={it} />)}
                  </ul>
                )}
                {s.contactEmail && <p className="text-yellow-300 break-all">{s.contactEmail}</p>}
              </div>
            </div>
          ))}
        </div>

        <p className="text-green-500 text-[10px] mt-4 text-right">{labels.updated}</p>
      </div>
    </div>
  );
}
