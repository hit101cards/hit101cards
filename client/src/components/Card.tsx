import { Card } from '../types';

interface Props {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
}

function isRed(suit: string) {
  return suit === '♥' || suit === '♦';
}

function getSpecialBadge(rank: string) {
  if (rank === '8') return { label: 'SKIP', color: 'bg-orange-500' };
  if (rank === '9') return { label: 'RTN', color: 'bg-purple-500' };
  if (rank === '10') return { label: '±10', color: 'bg-blue-500' };
  return null;
}

export default function CardComponent({ card, onClick, disabled }: Props) {
  const red = isRed(card.suit);
  const isJoker = card.rank === 'Joker';
  const badge = getSpecialBadge(card.rank);
  const clickable = !!onClick && !disabled;
  const ariaLabel = isJoker ? 'ジョーカー' : `${card.suit}の${card.rank}`;

  return (
    <div className="relative">
      {/* カード本体（overflow-hidden でテキストはみ出し防止） */}
      <div
        role={clickable ? 'button' : undefined}
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={clickable ? onClick : undefined}
        onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } } : undefined}
        className={[
          'relative rounded-lg border-2 bg-white select-none flex flex-col items-center justify-center gap-1 overflow-hidden',
          'w-16 h-24 p-1 text-xs min-[430px]:w-24 min-[430px]:h-36 min-[430px]:p-1.5 min-[430px]:text-base sm:w-20 sm:h-28 sm:p-1 sm:text-sm',
          clickable
            ? 'cursor-pointer hover:-translate-y-3 hover:shadow-2xl hover:shadow-yellow-400/30 active:scale-95 transition-all duration-150'
            : 'cursor-default',
          disabled ? 'opacity-50' : '',
          isJoker ? 'border-purple-400 bg-gradient-to-b from-purple-50 to-white' : 'border-gray-300',
        ].join(' ')}
      >
        {/* 背景の大きい数字 */}
        {!isJoker && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
            <span className={`font-black leading-none opacity-[0.4] text-[3.5rem] min-[430px]:text-[5.5rem] sm:text-[4.5rem] ${red ? 'text-red-500' : 'text-gray-800'}`}>
              {card.rank}
            </span>
          </div>
        )}

        {/* 左上 */}
        <div className={`self-start font-bold leading-tight text-[0.6rem] min-[430px]:text-base sm:text-xs ${isJoker ? 'text-purple-600' : red ? 'text-red-600' : 'text-gray-900'}`}>
          {isJoker ? <span className="text-base min-[430px]:text-2xl sm:text-base">🃏</span> : (
            <div className="text-center">
              <div>{card.rank}</div>
              <div>{card.suit}</div>
            </div>
          )}
        </div>

        {/* 中央 */}
        <div className={`text-2xl min-[430px]:text-4xl sm:text-2xl ${isJoker ? 'text-purple-500' : red ? 'text-red-500' : 'text-gray-800'}`}>
          {isJoker ? '★' : card.suit}
        </div>

        {/* 右下（反転） */}
        <div className={`self-end font-bold leading-tight rotate-180 text-[0.6rem] min-[430px]:text-base sm:text-xs ${isJoker ? 'text-purple-600' : red ? 'text-red-600' : 'text-gray-900'}`}>
          {isJoker ? <span className="text-base min-[430px]:text-2xl sm:text-base">🃏</span> : (
            <div className="text-center">
              <div>{card.rank}</div>
              <div>{card.suit}</div>
            </div>
          )}
        </div>
      </div>

      {/* 特殊バッジ（カードの外側に配置して切れないようにする） */}
      {badge && (
        <div className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 ${badge.color} text-white font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap shadow z-10`}
          style={{ fontSize: '0.6rem' }}>
          {badge.label}
        </div>
      )}
    </div>
  );
}
