// RulesModal.tsx
// Hit101 のルール説明。目次付き、ビジュアル例 (実カード) で初心者にもわかりやすく。

import { useState } from 'react';
import { useLocale, getLocale } from '../i18n';
import CardComponent from './Card';
import { Card as CardType } from '../types';

const c = (rank: string, suit: string): CardType => ({ id: `r-${rank}-${suit}`, rank, suit });

interface SectionDef {
  id: string;
  label: string;
}

interface Content {
  title: string;
  close: string;
  sections: SectionDef[];

  goalTitle: string;
  goalIntroHtml: string;
  goalBoxHtml: string;

  flowTitle: string;
  flowSteps: string[];
  flowExampleLabel: string;
  flowExampleNote: string;

  valuesTitle: string;
  valuesIntro: string;
  valueRows: { rank: string; suit: string; label: string; note?: string }[];

  specialTitle: string;
  specialNote: string;
  special10: { title: string; desc: string };
  special8: { title: string; desc: string };
  special9: { title: string; desc: string };
  specialJoker: { title: string; desc: string };

  pointsTitle: string;
  pointsIntro: string;
  pointWin101: { title: string; played: string; previous: string };
  pointBust: { title: string; played: string; previous: string };
  pointJoker: { title: string; played: string; others: string };

  tipsTitle: string;
  tips: string[];
}

const CONTENT: Record<string, Content> = {
  ja: {
    title: '🎯 Hit101 ルール',
    close: '閉じる',
    sections: [
      { id: 'goal', label: '① 目的' },
      { id: 'flow', label: '② 進め方' },
      { id: 'values', label: '③ カードの値' },
      { id: 'special', label: '④ 特殊カード' },
      { id: 'points', label: '⑤ ポイント' },
      { id: 'tips', label: '⑥ コツ' },
    ],

    goalTitle: '① 目的',
    goalIntroHtml: '順番にカードを出して、場の合計を増やしていく。<br/><b>合計を ピッタリ 101</b> にしたら勝ち!',
    goalBoxHtml: '⚠️ ただし合計が <b>102 以上</b> になると、出した人の負け (バースト)',

    flowTitle: '② 進め方',
    flowSteps: [
      '手札から 1 枚出すか、山札から 1 枚引いて出す',
      '出されたカードの値が場の合計に加算される',
      '合計が 101 ちょうど → ラウンド勝利',
      '合計が 102 以上 → ラウンド敗北 (バースト)',
      '次のラウンドへ続行(投票で決定)',
    ],
    flowExampleLabel: '例: 場の合計 95 のとき K(30) を出すと…',
    flowExampleNote: '95 + 30 = 125 → 102 を超えて バースト!',

    valuesTitle: '③ カードの値',
    valuesIntro: '各カードがどれだけ合計に加算されるか:',
    valueRows: [
      { rank: 'A', suit: '♠', label: '1', note: '一番低い' },
      { rank: '2', suit: '♥', label: '2' },
      { rank: '5', suit: '♦', label: '5', note: '〜 7 まで数字どおり' },
      { rank: '8', suit: '♣', label: '+8 or スキップ', note: '特殊' },
      { rank: '9', suit: '♠', label: '+9 or リターン', note: '特殊' },
      { rank: '10', suit: '♥', label: '+10 or -10', note: '特殊・引くこともできる' },
      { rank: 'J', suit: '♦', label: '10' },
      { rank: 'Q', suit: '♣', label: '20' },
      { rank: 'K', suit: '♠', label: '30', note: '一番大きい数字カード' },
      { rank: 'Joker', suit: 'JOKER', label: '50 (または 1)', note: '合計100のときだけ1扱いで101達成!' },
    ],

    specialTitle: '④ 特殊カード',
    specialNote: '特殊カードは 2 つの選択肢から選べる:',
    special10: {
      title: '10: ±10',
      desc: '+10 か -10 かを選べる。場が大きくなりすぎたら -10 で減らせる。',
    },
    special8: {
      title: '8: +8 or スキップ',
      desc: '+8 で普通に加算するか、合計を変えずに 次の人を飛ばす。',
    },
    special9: {
      title: '9: +9 or リターン',
      desc: '+9 で普通に加算するか、合計を変えずに 順番を逆回りに。',
    },
    specialJoker: {
      title: '🃏 Joker: 50 (または 1)',
      desc: '通常は +50 だが、場の合計が 100 のときに出すと +1 → ピッタリ 101 でジョーカー勝利(高得点)!',
    },

    pointsTitle: '⑤ ポイント',
    pointsIntro: 'ラウンド終了時のポイント分配:',
    pointWin101: {
      title: '🎯 ピッタリ 101',
      played: '出した人',
      previous: '直前のプレイヤー',
    },
    pointBust: {
      title: '💥 102 以上 (バースト)',
      played: '出した人',
      previous: '直前のプレイヤー',
    },
    pointJoker: {
      title: '🃏 100 で Joker',
      played: '出した人',
      others: '他のプレイヤー全員',
    },

    tipsTitle: '⑥ コツ',
    tips: [
      '90 を超えたら超慎重に。+10 や J/Q/K は危険',
      '相手のターンを飛ばしたい時は 8 (スキップ) が便利',
      '不利なターン回りなら 9 (リターン) で逆回りに',
      '手元に 10 があれば、合計を下げる切り札として温存も有効',
      '合計 100 で Joker は最大の高得点 → 狙えるなら狙う',
      '迷ったら山札から引くのもアリ。中身は読めないが、戦況が変わる',
    ],
  },
  en: {
    title: '🎯 Hit101 Rules',
    close: 'Close',
    sections: [
      { id: 'goal', label: '① Goal' },
      { id: 'flow', label: '② How to Play' },
      { id: 'values', label: '③ Card Values' },
      { id: 'special', label: '④ Special Cards' },
      { id: 'points', label: '⑤ Points' },
      { id: 'tips', label: '⑥ Tips' },
    ],

    goalTitle: '① Goal',
    goalIntroHtml: 'Take turns playing cards to increase the table total.<br/>Hit <b>exactly 101</b> to win!',
    goalBoxHtml: '⚠️ But if the total reaches <b>102 or more</b>, the player who played loses (bust)',

    flowTitle: '② How to Play',
    flowSteps: [
      'Play one card from your hand, OR draw one from the deck and play it',
      "The card's value is added to the table total",
      'Hit total exactly 101 → win the round',
      'Total reaches 102+ → lose the round (bust)',
      'Continue to the next round (decided by vote)',
    ],
    flowExampleLabel: 'Example: total is 95, you play K (worth 30)…',
    flowExampleNote: '95 + 30 = 125 → over 102, BUST!',

    valuesTitle: '③ Card Values',
    valuesIntro: 'How much each card adds to the total:',
    valueRows: [
      { rank: 'A', suit: '♠', label: '1', note: 'lowest' },
      { rank: '2', suit: '♥', label: '2' },
      { rank: '5', suit: '♦', label: '5', note: '2–7 = face value' },
      { rank: '8', suit: '♣', label: '+8 or Skip', note: 'special' },
      { rank: '9', suit: '♠', label: '+9 or Return', note: 'special' },
      { rank: '10', suit: '♥', label: '+10 or -10', note: 'special, can subtract' },
      { rank: 'J', suit: '♦', label: '10' },
      { rank: 'Q', suit: '♣', label: '20' },
      { rank: 'K', suit: '♠', label: '30', note: 'highest number card' },
      { rank: 'Joker', suit: 'JOKER', label: '50 (or 1)', note: 'When total = 100, counts as 1 to hit 101!' },
    ],

    specialTitle: '④ Special Cards',
    specialNote: 'Special cards offer two options:',
    special10: {
      title: '10: ±10',
      desc: 'Choose +10 or -10. If the total is too high, subtract with -10.',
    },
    special8: {
      title: '8: +8 or Skip',
      desc: 'Add +8, OR keep the total unchanged and skip the next player.',
    },
    special9: {
      title: '9: +9 or Return',
      desc: 'Add +9, OR keep the total unchanged and reverse turn order.',
    },
    specialJoker: {
      title: '🃏 Joker: 50 (or 1)',
      desc: 'Normally adds +50, but when the total is 100, plays as +1 → hits exactly 101 for a Joker Win (high points)!',
    },

    pointsTitle: '⑤ Points',
    pointsIntro: 'Point distribution at round end:',
    pointWin101: {
      title: '🎯 Exactly 101',
      played: 'Player who played',
      previous: 'Previous player',
    },
    pointBust: {
      title: '💥 102+ (Bust)',
      played: 'Player who played',
      previous: 'Previous player',
    },
    pointJoker: {
      title: '🃏 Joker on 100',
      played: 'Player who played',
      others: 'All other players',
    },

    tipsTitle: '⑥ Tips',
    tips: [
      'Above 90, be very careful. +10 or J/Q/K are dangerous',
      'Use 8 (Skip) to skip the next player when convenient',
      'If turn order is unfavorable, use 9 (Return) to reverse',
      'Save your 10 as a "lower the total" trump card',
      'Joker on total 100 is the highest-scoring play — chase it when you can',
      "When unsure, drawing from the deck is valid — its value is unknown but changes the game",
    ],
  },
};

export default function RulesModal({ onClose }: { onClose: () => void }) {
  useLocale();
  const C = CONTENT[getLocale()] || CONTENT.ja;
  const [active, setActive] = useState('goal');

  function jumpTo(id: string) {
    setActive(id);
    document.getElementById(`rules-section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div
      className="fixed inset-0 bg-black/85 flex items-center justify-center z-[110] p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={C.title}
      onClick={onClose}
    >
      <div
        className="bg-green-800 max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] rounded-3xl shadow-2xl flex flex-col border border-yellow-500/30 relative"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 60px rgba(250,204,21,0.12)' }}
      >
        {/* ヘッダー (固定) */}
        <div className="flex-shrink-0 rounded-t-3xl p-4 sm:p-5 border-b border-green-700/60 relative">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl sm:text-2xl font-black gold-shimmer">{C.title}</h2>
            <button
              onClick={onClose}
              className="w-9 h-9 bg-red-600/90 hover:bg-red-500 rounded-full text-white text-lg font-bold transition"
              aria-label={C.close}
            >
              ✕
            </button>
          </div>
          {/* 目次 */}
          <div className="flex flex-wrap gap-1.5">
            {C.sections.map((s) => (
              <button
                key={s.id}
                onClick={() => jumpTo(s.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  active === s.id
                    ? 'bg-yellow-500 text-black shadow-md'
                    : 'bg-green-700/70 text-green-200 hover:bg-green-700'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* スクロール本文 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* ① 目的 */}
          <Section id="goal" title={C.goalTitle}>
            <p className="text-sm sm:text-base text-green-100 mb-3" dangerouslySetInnerHTML={{ __html: C.goalIntroHtml }} />
            <Box variant="warn">
              <p dangerouslySetInnerHTML={{ __html: C.goalBoxHtml }} />
            </Box>
          </Section>

          {/* ② 進め方 */}
          <Section id="flow" title={C.flowTitle}>
            <ol className="space-y-2 text-sm">
              {C.flowSteps.map((step, i) => (
                <li key={i} className="flex gap-3 bg-green-900/50 rounded-lg p-3">
                  <span className="flex-shrink-0 w-7 h-7 bg-yellow-500 text-black rounded-full text-sm font-black flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-green-100 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
            {/* バースト例 */}
            <div className="mt-4 bg-red-900/30 border border-red-500/40 rounded-lg p-4">
              <p className="text-xs text-yellow-200 mb-3">{C.flowExampleLabel}</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl font-black text-yellow-300">95</span>
                <span className="text-green-300">+</span>
                <CardComponent card={c('K', '♠')} />
                <span className="text-green-300">=</span>
                <span className="text-3xl font-black text-red-400">125 💥</span>
              </div>
              <p className="text-center text-xs text-red-300 mt-3 font-bold">{C.flowExampleNote}</p>
            </div>
          </Section>

          {/* ③ カードの値 */}
          <Section id="values" title={C.valuesTitle}>
            <p className="text-sm text-green-200 mb-3">{C.valuesIntro}</p>
            <div className="space-y-2">
              {C.valueRows.map((row, i) => (
                <div key={i} className="flex items-center gap-3 bg-green-900/40 rounded-lg p-2">
                  <div className="flex-shrink-0 scale-75 sm:scale-90 origin-left">
                    <CardComponent card={c(row.rank, row.suit)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-yellow-300 text-base sm:text-lg">{row.label}</div>
                    {row.note && <div className="text-xs text-green-400">{row.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* ④ 特殊カード */}
          <Section id="special" title={C.specialTitle}>
            <p className="text-sm text-green-200 mb-3">{C.specialNote}</p>
            <div className="space-y-3">
              <SpecialCard color="blue" {...C.special10} />
              <SpecialCard color="orange" {...C.special8} />
              <SpecialCard color="purple" {...C.special9} />
              <SpecialCard color="gold" {...C.specialJoker} />
            </div>
          </Section>

          {/* ⑤ ポイント */}
          <Section id="points" title={C.pointsTitle}>
            <p className="text-sm text-green-200 mb-3">{C.pointsIntro}</p>
            <div className="space-y-3">
              {/* 101 ジャスト */}
              <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-xl p-4">
                <h4 className="font-black text-yellow-300 mb-2">{C.pointWin101.title}</h4>
                <PointRow who={C.pointWin101.played} value="+10" positive big />
                <PointRow who={C.pointWin101.previous} value="-3" />
              </div>
              {/* 102 バースト */}
              <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-4">
                <h4 className="font-black text-red-300 mb-2">{C.pointBust.title}</h4>
                <PointRow who={C.pointBust.played} value="-5" />
                <PointRow who={C.pointBust.previous} value="+3" positive />
              </div>
              {/* Joker on 100 */}
              <div className="bg-purple-900/30 border border-purple-400/50 rounded-xl p-4">
                <h4 className="font-black text-purple-200 mb-2">{C.pointJoker.title}</h4>
                <PointRow who={C.pointJoker.played} value="+15" positive big />
                <PointRow who={C.pointJoker.others} value="-1" />
              </div>
            </div>
          </Section>

          {/* ⑥ コツ */}
          <Section id="tips" title={C.tipsTitle} last>
            <ul className="space-y-2 text-sm">
              {C.tips.map((tip, i) => (
                <li key={i} className="flex gap-2.5 bg-green-900/40 rounded-lg p-3">
                  <span className="text-yellow-400 flex-shrink-0">💡</span>
                  <span className="text-green-100 leading-relaxed">{tip}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        {/* フッター閉じる */}
        <div className="flex-shrink-0 p-3 sm:p-4 border-t border-green-700/60">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-yellow-500 hover:brightness-110 text-black font-black shadow-lg"
          >
            {C.close}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── サブコンポーネント ────────────────────────────────────────

function Section({ id, title, last, children }: { id: string; title: string; last?: boolean; children: React.ReactNode }) {
  return (
    <section id={`rules-section-${id}`} className={last ? '' : 'pb-6 border-b border-green-700/40'}>
      <h3 className="text-lg sm:text-xl font-black text-yellow-300 mb-3">{title}</h3>
      {children}
    </section>
  );
}

function Box({ children, variant = 'info' }: { children: React.ReactNode; variant?: 'info' | 'warn' }) {
  const styles = variant === 'warn'
    ? 'bg-red-900/30 border-red-500/50 text-red-100'
    : 'bg-blue-900/30 border-blue-400/50 text-blue-100';
  return (
    <div className={`rounded-lg p-3 border-l-4 text-sm ${styles}`}>
      {children}
    </div>
  );
}

function SpecialCard({ title, desc, color }: { title: string; desc: string; color: 'blue' | 'orange' | 'purple' | 'gold' }) {
  const palette = {
    blue: { bg: 'bg-blue-900/30', border: 'border-blue-400/40', titleColor: 'text-blue-300' },
    orange: { bg: 'bg-orange-900/30', border: 'border-orange-400/40', titleColor: 'text-orange-300' },
    purple: { bg: 'bg-purple-900/30', border: 'border-purple-400/40', titleColor: 'text-purple-300' },
    gold: { bg: 'bg-yellow-900/30', border: 'border-yellow-400/50', titleColor: 'text-yellow-300' },
  }[color];
  return (
    <div className={`${palette.bg} border ${palette.border} rounded-xl p-4`}>
      <h4 className={`font-black ${palette.titleColor} mb-1`}>{title}</h4>
      <p className="text-sm text-green-100 leading-relaxed">{desc}</p>
    </div>
  );
}

function PointRow({ who, value, positive, big }: { who: string; value: string; positive?: boolean; big?: boolean }) {
  const color = positive ? 'text-green-300' : 'text-red-300';
  const sizeClass = big ? 'text-xl' : 'text-base';
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-green-100">{who}</span>
      <span className={`font-black tabular-nums ${color} ${sizeClass}`}>{value}pt</span>
    </div>
  );
}
