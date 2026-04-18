import { Card } from '../types';

interface Props {
  card: Card;
  currentTotal: number;
  onChoice: (choice: string) => void;
  onCancel: () => void;
  fromDeck?: boolean; // 山札から引いたカードの場合はキャンセル不可
}

function getChoiceConfig(rank: string, currentTotal: number) {
  if (rank === '10') {
    return {
      title: '10のカード',
      choices: [
        { value: 'plus', label: '+10', sub: `→ ${currentTotal + 10}`, color: 'bg-red-500 hover:bg-red-400', warn: currentTotal + 10 > 101 },
        { value: 'minus', label: '-10', sub: `→ ${currentTotal - 10}`, color: 'bg-blue-500 hover:bg-blue-400', warn: false }
      ]
    };
  }
  if (rank === '8') {
    return {
      title: '8のカード',
      choices: [
        { value: 'plus', label: '+8', sub: `→ ${currentTotal + 8}`, color: 'bg-red-500 hover:bg-red-400', warn: currentTotal + 8 > 101 },
        { value: 'skip', label: 'スキップ', sub: '次を飛ばす（+0）', color: 'bg-orange-500 hover:bg-orange-400', warn: false }
      ]
    };
  }
  if (rank === '9') {
    return {
      title: '9のカード',
      choices: [
        { value: 'plus', label: '+9', sub: `→ ${currentTotal + 9}`, color: 'bg-red-500 hover:bg-red-400', warn: currentTotal + 9 > 101 },
        { value: 'return', label: 'リターン', sub: '順番を逆にする（+0）', color: 'bg-purple-500 hover:bg-purple-400', warn: false }
      ]
    };
  }
  return { title: 'カードを選択', choices: [] };
}

export default function ChoiceModal({ card, currentTotal, onChoice, onCancel, fromDeck }: Props) {
  const config = getChoiceConfig(card.rank, currentTotal);
  const isRed = card.suit === '♥' || card.suit === '♦';

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label={`${config.title}の選択`}>
      <div className="bg-green-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-green-600">
        {/* カード表示 */}
        <div className="text-center mb-5">
          {fromDeck && (
            <p className="text-yellow-400 text-xs mb-2 font-bold">📤 山札から引いたカード</p>
          )}
          <div className={`inline-flex items-center justify-center w-16 h-24 bg-white rounded-lg border-2 shadow-lg mb-3 ${isRed ? 'border-red-400' : card.suit === 'JOKER' ? 'border-purple-400' : 'border-gray-400'}`}>
            <div className="text-center">
              <div className={`text-xl font-bold ${isRed ? 'text-red-600' : card.suit === 'JOKER' ? 'text-purple-600' : 'text-gray-900'}`}>
                {card.rank}
              </div>
              <div className={`text-2xl ${isRed ? 'text-red-500' : card.suit === 'JOKER' ? 'text-purple-500' : 'text-gray-800'}`}>
                {card.suit === 'JOKER' ? '★' : card.suit}
              </div>
            </div>
          </div>
          <h3 className="text-xl font-bold text-white">{config.title}</h3>
          <p className="text-green-300 mt-1 text-sm">
            現在の合計: <span className="text-white font-bold text-lg">{currentTotal}</span>
          </p>
        </div>

        <p className="text-green-400 text-xs text-center mb-4">どちらを選びますか？</p>

        <div className="flex gap-3 mb-4">
          {config.choices.map(c => (
            <button
              key={c.value}
              onClick={() => onChoice(c.value)}
              className={`flex-1 ${c.color} active:scale-95 text-white font-bold py-4 rounded-xl transition-all duration-150 shadow-lg`}
            >
              <div className="text-xl">{c.label}</div>
              <div className={`text-xs mt-1 font-normal ${c.warn ? 'text-red-200 font-bold' : 'opacity-80'}`}>
                {c.sub}
                {c.warn && <span role="alert"> 危険 💀</span>}
              </div>
            </button>
          ))}
        </div>

        {!fromDeck && (
          <button
            onClick={onCancel}
            className="w-full text-green-400 hover:text-white text-sm transition py-2"
          >
            キャンセル（カードを戻す）
          </button>
        )}
      </div>
    </div>
  );
}
