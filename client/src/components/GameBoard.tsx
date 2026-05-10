import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { socket } from '../socket';
import { GameState, Card, Player, RoundResult } from '../types';
import CardComponent from './Card';
import RulesModal from './RulesModal';
import { playCardSound, playDrawSound, playTurnSound, playHit101Sound, playBustSound, playJokerSound, playSkipSound, playReturnSound, playCountTick, playTurnWarning, isMuted, toggleMute } from '../sounds';
import { copyText, shareOrCopy } from '../clipboard';
import { useLocale, t } from '../i18n';

function LeaveConfirmModal({ isPlaying, onCancel, onConfirm }: { isPlaying: boolean; onCancel: () => void; onConfirm: () => void }) {
  useLocale();
  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-green-800 rounded-2xl p-6 max-w-xs w-full shadow-2xl text-center">
        <p className="text-xl font-bold text-white mb-2">
          {isPlaying ? t('leave.titlePlaying') : t('leave.titleWaiting')}
        </p>
        {isPlaying && (
          <p className="text-green-400 text-sm mb-2">{t('leave.note')}</p>
        )}
        <div className="flex gap-3 mt-4">
          <button onClick={onCancel} className="flex-1 bg-green-700 hover:bg-green-600 active:scale-95 text-white font-bold py-3 rounded-xl transition-all">
            {t('leave.cancel')}
          </button>
          <button onClick={onConfirm} className="flex-1 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold py-3 rounded-xl transition-all">
            {isPlaying ? t('leave.confirmPlaying') : t('leave.confirmWaiting')}
          </button>
        </div>
      </div>
    </div>
  );
}

function DirectionArrows({ direction }: { direction: number }) {
  const cw = direction === 1;
  const r = 160;
  const pad = 20;
  const color = '#facc15';
  const size = (r + pad) * 2;

  // 上半円・下半円それぞれ回転方向に沿って描く（矢印が向きを示す）
  const upper = cw
    ? `M ${-r},0 A ${r},${r} 0 0,1 ${r},0`   // 左→右（時計回り）
    : `M ${r},0 A ${r},${r} 0 0,0 ${-r},0`;  // 右→左（反時計回り）
  const lower = cw
    ? `M ${r},0 A ${r},${r} 0 0,1 ${-r},0`   // 右→左（時計回り）
    : `M ${-r},0 A ${r},${r} 0 0,0 ${r},0`;  // 左→右（反時計回り）

  return (
    <div className="absolute pointer-events-none" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
      <svg
        viewBox={`${-r - pad} ${-r - pad} ${size} ${size}`}
        style={{
          width: size,
          height: size,
          animation: cw ? 'spin-cw 4s linear infinite' : 'spin-ccw 4s linear infinite',
          transformOrigin: 'center',
          transformBox: 'fill-box',
        }}
      >
        <defs>
          <style>{`
            @keyframes spin-cw   { to { transform: rotate(360deg);  } }
            @keyframes spin-ccw  { to { transform: rotate(-360deg); } }
          `}</style>
          <marker id="dir-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
          </marker>
        </defs>
        <path d={upper} fill="none" stroke={color} strokeWidth="3.5" strokeOpacity="0.85" markerEnd="url(#dir-arrow)" />
        <path d={lower} fill="none" stroke={color} strokeWidth="3.5" strokeOpacity="0.85" markerEnd="url(#dir-arrow)" />
      </svg>
    </div>
  );
}

interface Props {
  gameState: GameState;
  myId: string;
  onPlayCard: (card: Card) => void;
  onDrawFromDeck: () => void;
  onStartGame: () => void;
  onVote: (vote: 'continue' | 'quit') => void;
  onRestart: () => void;
}

function OtherPlayerArea({ player, isCurrentTurn, points, cumulative, elRef }: { player: Player; isCurrentTurn: boolean; points: number; cumulative?: { totalPoints: number } | null; elRef?: (el: HTMLDivElement | null) => void }) {
  useLocale();
  return (
    <div ref={elRef} className={`text-center p-1.5 sm:p-2 rounded-xl transition-all w-[5.5rem] sm:w-[7rem] flex-shrink-0 ${isCurrentTurn && !player.lost && !player.disconnected ? 'ring-2 ring-yellow-400 bg-yellow-400/10' : ''}`}>
      <p className={`text-sm sm:text-base font-bold truncate ${player.lost ? 'text-red-400 line-through' : player.disconnected ? 'text-gray-400' : isCurrentTurn ? 'text-yellow-400' : 'text-green-300'}`}>
        {player.isBot ? '🤖 ' : (player.avatar ? player.avatar + ' ' : '')}{player.name}{player.disconnected ? '🔌' : ''}{isCurrentTurn && !player.lost && !player.disconnected ? '←' : ''}
      </p>
      <p className="text-yellow-300 text-xs sm:text-sm font-bold">{points >= 0 ? '+' : ''}{points}pt</p>
      {cumulative != null && (
        <p className="text-green-400 text-xs">{t('game.cumulativeShort', { points: (cumulative.totalPoints >= 0 ? '+' : '') + cumulative.totalPoints })}</p>
      )}
    </div>
  );
}

// 最終結果画面
function EndScreen({ players, points, cumulativeStats, onRestart }: { players: Player[]; points: Record<string, number>; cumulativeStats: Record<string, { totalPoints: number; gamesPlayed: number }> | null; onRestart: () => void }) {
  useLocale();
  const ranked = [...players].sort((a, b) => (points[b.name] || 0) - (points[a.name] || 0));
  const medals = ['🥇', '🥈', '🥉'];
  const isMatchmaking = !!cumulativeStats;

  return (
    <div className="min-h-screen bg-green-900 flex items-center justify-center p-4">
      <div className="bg-green-800 rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">
        <div className="text-6xl mb-3">🏆</div>
        <h2 className="text-3xl font-bold text-yellow-400 mb-6">{t('end.title')}</h2>
        <div className="space-y-3 mb-8">
          {ranked.map((p, i) => (
            <div key={p.id} className={`rounded-xl px-4 py-3 ${i === 0 ? 'bg-yellow-500/20 border border-yellow-400' : 'bg-green-700/50'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{medals[i] || `${i + 1}.`}</span>
                  <span className={`font-bold ${i === 0 ? 'text-yellow-300' : 'text-white'}`}>{p.name}</span>
                </div>
                <span className={`text-xl font-bold ${(points[p.name] || 0) >= 0 ? 'text-green-300' : 'text-red-400'}`}>
                  {(points[p.name] || 0) >= 0 ? '+' : ''}{points[p.name] || 0}pt
                </span>
              </div>
              {isMatchmaking && cumulativeStats[p.name] != null && (
                <div className="flex justify-end mt-1">
                  <span className="text-yellow-400 text-xs">{t('game.cumulativeShort', { points: (cumulativeStats[p.name].totalPoints >= 0 ? '+' : '') + cumulativeStats[p.name].totalPoints })}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={onRestart}
          className="w-full bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-black font-bold py-3 rounded-xl transition-all"
        >
          {t('end.restart')}
        </button>
      </div>
    </div>
  );
}

// ラウンド終了・投票オーバーレイ
function RoundEndOverlay({ result, players, points, cumulativeStats, votes, myId, roundCount, voteDeadline, onVote }:
  { result: RoundResult; players: Player[]; points: Record<string, number>; cumulativeStats: Record<string, { totalPoints: number }> | null; votes: Record<string, 'continue' | 'quit' | null>; myId: string; roundCount: number; voteDeadline: number | null; onVote: (v: 'continue' | 'quit') => void }) {
  useLocale();
  const me = players.find(p => p.id === myId);
  const myVote = me ? votes[me.name] : null;
  const ranked = [...players].sort((a, b) => (points[b.name] || 0) - (points[a.name] || 0));
  const emoji = result.scenario === 'joker101' ? '🃏' : result.scenario === '101' ? '🎯' : '💥';
  const activePlayers = players.filter(p => !p.disconnected && !p.lost);
  const votedCount = activePlayers.filter(p => votes[p.name] !== null).length;

  // 投票カウントダウン
  const calcRemaining = useCallback(() =>
    voteDeadline ? Math.max(0, Math.ceil((voteDeadline - Date.now()) / 1000)) : null,
  [voteDeadline]);
  const [remaining, setRemaining] = useState(calcRemaining);
  useEffect(() => {
    if (!voteDeadline) { setRemaining(null); return; }
    setRemaining(calcRemaining());
    const id = setInterval(() => {
      const r = calcRemaining();
      setRemaining(r);
      if (r === 0) clearInterval(id);
    }, 500);
    return () => clearInterval(id);
  }, [voteDeadline, calcRemaining]);

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-40 p-4 overflow-y-auto">
      <div className="bg-green-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-green-600 my-4 max-h-[90vh] overflow-y-auto">
        {/* ラウンド結果 */}
        <div className="text-center mb-4">
          <div className="text-4xl mb-1">{emoji}</div>
          <h2 className="text-xl font-bold text-white">{t('round.title', { n: roundCount })}</h2>
          <p className="text-green-300 text-sm mt-1">
            {(result as any).descriptionKey
              ? t((result as any).descriptionKey, (result as any).descriptionParams)
              : result.description}
          </p>
        </div>

        {/* ポイント変動 */}
        <div className="mb-3">
          <p className="text-green-400 text-xs mb-1.5 font-bold uppercase tracking-wider">{t('round.pointChanges')}</p>
          <div className="space-y-1">
            {result.pointChanges.map(pc => (
              <div key={pc.playerName} className="flex items-center justify-between bg-green-700/50 rounded-lg px-3 py-1.5">
                <span className="text-white text-sm">{pc.playerName}{pc.playerName === me?.name ? ' ' + t('round.youSuffix') : ''}</span>
                <span className={`font-bold text-sm ${pc.change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {pc.change > 0 ? '+' : ''}{pc.change}pt
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 現在の順位 */}
        <div className="mb-5">
          <p className="text-green-400 text-xs mb-1.5 font-bold uppercase tracking-wider">{t('round.currentRanking')}</p>
          <div className="space-y-1">
            {ranked.map((p, i) => (
              <div key={p.id} className="bg-green-700/50 rounded-lg px-3 py-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
                    <span className="text-white text-sm">{p.name}{p.id === myId ? ' ' + t('round.youSuffix') : ''}</span>
                  </div>
                  <span className={`font-bold text-sm ${(points[p.name] || 0) >= 0 ? 'text-yellow-300' : 'text-red-400'}`}>
                    {(points[p.name] || 0) >= 0 ? '+' : ''}{points[p.name] || 0}pt
                  </span>
                </div>
                {cumulativeStats?.[p.name] != null && (
                  <div className="flex justify-end">
                    <span className="text-yellow-400 text-xs">{t('game.cumulativeShort', { points: (cumulativeStats[p.name].totalPoints >= 0 ? '+' : '') + cumulativeStats[p.name].totalPoints })}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 投票セクション */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-green-400 text-xs font-bold uppercase tracking-wider">
              {t('round.continueQuestion', { voted: votedCount, total: activePlayers.length })}
            </p>
            {remaining !== null && (
              <span className={`text-xs font-bold tabular-nums ${remaining <= 10 ? 'text-red-400' : 'text-yellow-300'}`}>
                {t('round.timerLabel', { seconds: remaining })}
              </span>
            )}
          </div>
          {remaining === null && votedCount === 0 && (
            <p className="text-green-500 text-xs mb-2">{t('round.waitingForVote')}</p>
          )}

          {/* 各プレイヤーの投票状況 */}
          <div className="space-y-1 mb-3">
            {activePlayers.map(p => {
              const v = votes[p.name];
              return (
                <div key={p.id} className="flex items-center justify-between bg-green-700/30 rounded-lg px-3 py-1">
                  <span className="text-white text-sm">{p.name}{p.id === myId ? ' ' + t('round.youSuffix') : ''}</span>
                  <span className="text-sm">
                    {v === 'continue' ? t('round.voteDone') : v === 'quit' ? t('round.voteQuit') : t('round.voting')}
                  </span>
                </div>
              );
            })}
          </div>

          {/* 自分の投票ボタン */}
          <div className="flex gap-3">
            <button
              onClick={() => onVote('continue')}
              disabled={remaining === 0}
              className={`flex-1 active:scale-95 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed ${myVote === 'continue' ? 'bg-green-500 ring-2 ring-white' : 'bg-green-700 hover:bg-green-600'}`}
            >
              {t('round.continue')}
            </button>
            <button
              onClick={() => onVote('quit')}
              disabled={remaining === 0}
              className={`flex-1 active:scale-95 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed ${myVote === 'quit' ? 'bg-gray-500 ring-2 ring-white' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              {t('round.quit')}
            </button>
          </div>
          {remaining === 0 ? (
            <p className="text-center text-xs text-red-400 mt-2 font-bold">{t('round.voteEnded')}</p>
          ) : myVote !== null ? (
            <p className="text-center text-xs text-green-500 mt-2 opacity-70">{t('round.waitingForOthers')}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function WaitingScreen({ gameState, myId, onStartGame, onLeaveClick }: { gameState: GameState; myId: string; onStartGame: () => void; onLeaveClick: () => void }) {
  useLocale();
  const isHost = gameState.hostId === myId;
  const canAddBot = isHost && gameState.players.length < 6;
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const handleAddBot = () => {
    socket.emit('add-bot', { roomId: gameState.roomId }, () => {});
  };
  const handleRemoveBot = (botName: string) => {
    socket.emit('remove-bot', { roomId: gameState.roomId, botName }, () => {});
  };
  const handleCopyRoomId = async () => {
    const ok = await copyText(gameState.roomId);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  const handleShareInviteLink = async () => {
    const url = `${window.location.origin}/?room=${gameState.roomId}`;
    const result = await shareOrCopy(url, 'Hit101');
    if (result === 'shared' || result === 'copied') {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };
  return (
    <div className="min-h-screen bg-green-900 flex items-center justify-center p-4">
      <div className="bg-green-800 rounded-2xl p-8 max-w-sm w-full shadow-2xl">
        <h2 className="text-2xl font-bold text-white text-center mb-1">{t('wait.title')}</h2>
        <div className="text-center mb-6">
          <p className="text-green-400 text-sm mb-1">{t('wait.roomIdLabel')}</p>
          <button onClick={handleCopyRoomId} className="bg-green-700 hover:bg-green-600 rounded-xl px-6 py-3 inline-flex items-center gap-2 transition-colors">
            <span className="font-mono font-bold text-yellow-400 text-3xl tracking-widest">{gameState.roomId}</span>
            <span className="text-green-300 text-sm">{copied ? '✓' : '📋'}</span>
          </button>
          <p className="text-green-500 text-xs mt-2">{copied ? t('wait.copied') : t('wait.copyHint')}</p>
          <button
            onClick={handleShareInviteLink}
            className="mt-3 w-full bg-yellow-600 hover:bg-yellow-500 active:scale-95 text-white font-bold py-2.5 rounded-xl transition-all text-sm shadow"
          >
            {linkCopied ? t('wait.copyLink.done') : t('wait.copyLink')}
          </button>
        </div>
        <div className="space-y-2 mb-6">
          {gameState.players.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 bg-green-700/50 rounded-lg px-4 py-3">
              <span className="text-lg">{p.isBot ? '🤖' : (p.avatar || (i === 0 ? '👑' : '👤'))}</span>
              <span className="text-white font-medium flex-1">{p.name}</span>
              {p.id === myId && <span className="text-green-400 text-xs bg-green-600 px-2 py-0.5 rounded-full">{t('wait.you')}</span>}
              {p.isBot && isHost && (
                <button onClick={() => handleRemoveBot(p.name)} className="text-red-400 hover:text-red-300 text-xs font-bold">
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {isHost && (
            <>
              <button onClick={onStartGame} disabled={gameState.players.length < 2}
                className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 active:scale-95 text-black font-bold py-4 rounded-xl text-lg transition-all">
                {gameState.players.length < 2 ? t('wait.startWaiting') : t('wait.start')}
              </button>
              <button onClick={handleAddBot} disabled={!canAddBot}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 active:scale-95 text-white font-bold py-2.5 rounded-xl text-sm transition-all">
                {t('wait.addBot')}
              </button>
            </>
          )}
          {!isHost && (
            <p className="text-center text-green-400 py-2">{t('wait.notHost')}</p>
          )}
          <button onClick={onLeaveClick}
            className="w-full bg-transparent hover:bg-red-900/30 active:scale-95 text-red-400 font-bold py-2 rounded-xl text-sm transition-all border border-red-800">
            {t('wait.backToLobby')}
          </button>
        </div>
        <p className="text-green-600 text-xs text-center mt-3">{t('wait.note')}</p>
      </div>
    </div>
  );
}

export default function GameBoard({ gameState, myId, onPlayCard, onDrawFromDeck, onStartGame, onVote, onRestart }: Props) {
  useLocale();
  const { players, currentTotal, currentPlayerIndex, direction, lastPlayedCard, status, deckCount, points, votes, roundResult, roundCount, cumulativeStats, turnDeadline } = gameState;

  const [showRules, setShowRules] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [connected, setConnected] = useState(socket.connected);
  const [muted, setMuted] = useState(isMuted());

  // 接続状態インジケータ
  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => { socket.off('connect', onConnect); socket.off('disconnect', onDisconnect); };
  }, []);
  const [notification, setNotification] = useState<string | null>(null);
  const notifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevStateRef = useRef<GameState | null>(null);
  const [roundEffect, setRoundEffect] = useState<'101' | '102' | 'joker101' | null>(null);
  const [actionEffect, setActionEffect] = useState<'skip' | 'return' | null>(null);
  const roundEffectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const personalBannerRef = useRef<HTMLDivElement>(null);
  const personalBannerT1Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const personalBannerClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionEffectClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [displayTotal, setDisplayTotal] = useState<number | null>(null);
  const [roundEndVisible, setRoundEndVisible] = useState(false);
  const [turnSecsLeft, setTurnSecsLeft] = useState<number | null>(null);
  const lastWarnSecRef = useRef<number>(-1);
  const countTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // カード飛行アニメーション用の位置参照
  const playSlotRef = useRef<HTMLDivElement | null>(null);
  const deckRef = useRef<HTMLButtonElement | null>(null);
  const handRef = useRef<HTMLDivElement | null>(null);
  const otherPlayerRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const lastAnimatedKeyRef = useRef<string | null>(null);

  // プレイヤーリスト変更時にotherPlayerRefsから不要なエントリを削除
  useEffect(() => {
    const currentNames = new Set(players.map(p => p.name));
    for (const key of otherPlayerRefs.current.keys()) {
      if (!currentNames.has(key)) otherPlayerRefs.current.delete(key);
    }
  }, [players]);

  // パーソナルバナーを初期状態で非表示に
  useLayoutEffect(() => {
    if (personalBannerRef.current) personalBannerRef.current.style.visibility = 'hidden';
  }, []);

  // 最後に出されたカードの飛行アニメーション（出したプレイヤー/山札の位置から）
  useLayoutEffect(() => {
    const card = gameState.lastPlayedCard;
    if (!card || !playSlotRef.current) return;
    const key = `${card.id}:${card.playerName}:${card.fromDeck ? 'd' : 'h'}`;
    if (lastAnimatedKeyRef.current === key) return;
    lastAnimatedKeyRef.current = key;

    const target = playSlotRef.current.getBoundingClientRect();
    let source: DOMRect | null = null;
    const myName = gameState.players.find(p => p.id === myId)?.name;

    if (card.fromDeck && deckRef.current) {
      source = deckRef.current.getBoundingClientRect();
    } else if (card.playerName === myName && handRef.current) {
      source = handRef.current.getBoundingClientRect();
    } else {
      const el = otherPlayerRefs.current.get(card.playerName);
      if (el) source = el.getBoundingClientRect();
    }

    let dx = 0, dy = 260; // フォールバック: 下から
    if (source) {
      dx = source.left + source.width / 2 - (target.left + target.width / 2);
      dy = source.top + source.height / 2 - (target.top + target.height / 2);
    }

    playSlotRef.current.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(0.4)`, opacity: 0, offset: 0 },
      { opacity: 1, offset: 0.35 },
      { transform: `translate(${dx * -0.04}px, ${dy * -0.04}px) scale(1.08)`, opacity: 1, offset: 0.7 },
      { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 1 }
    ], { duration: 600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' });
  }, [gameState.lastPlayedCard?.id, gameState.lastPlayedCard?.playerName, gameState.lastPlayedCard?.fromDeck, myId, gameState.players]);

  // ラウンド終了カウントアップアニメーション
  // useLayoutEffect: 最初のペイント前に displayTotal=fromTotal を確定させて値のフラッシュを防ぐ
  useLayoutEffect(() => {
    if (gameState.status === 'roundEnd' && gameState.roundResult) {
      const scenario = gameState.roundResult.scenario as '101' | '102' | 'joker101';
      const addedValue = gameState.lastPlayedCard?.addedValue ?? 0;
      const toTotal = gameState.currentTotal;
      const fromTotal = Math.max(0, toTotal - addedValue);
      const myName = gameState.players.find(p => p.id === myId)?.name;
      const myChange = gameState.roundResult.pointChanges.find(pc => pc.playerName === myName)?.change ?? 0;
      let cancelled = false;

      function showOverlayAndPersonal() {
        // ラウンド終了効果音
        if (scenario === '101') playHit101Sound();
        else if (scenario === '102') playBustSound();
        else if (scenario === 'joker101') playJokerSound();
        // フラッシュエフェクト（最終値到達時に発火）
        setRoundEffect(scenario);
        if (roundEffectTimerRef.current) clearTimeout(roundEffectTimerRef.current);
        roundEffectTimerRef.current = setTimeout(() => setRoundEffect(null), 2200);
        // パーソナルバナー
        if (myChange !== 0) {
          if (personalBannerT1Ref.current) clearTimeout(personalBannerT1Ref.current);
          if (personalBannerClearRef.current) clearTimeout(personalBannerClearRef.current);
          personalBannerT1Ref.current = setTimeout(() => {
            personalBannerT1Ref.current = null;
            const el = personalBannerRef.current;
            if (!el || cancelled) return;
            el.textContent = myChange > 0 ? `+${myChange}pt` : `${myChange}pt`;
            el.style.backgroundColor = myChange > 0 ? '#22c55e' : '#ef4444';
            el.style.animation = 'none';
            void el.offsetWidth;
            el.style.visibility = 'visible';
            el.style.animation = 'personal-slide-up 1.8s ease-out forwards';
            personalBannerClearRef.current = setTimeout(() => {
              personalBannerClearRef.current = null;
              if (personalBannerRef.current) personalBannerRef.current.style.visibility = 'hidden';
            }, 1900);
          }, 500);
        }
        // 1秒後に結果オーバーレイ表示
        countEndTimerRef.current = setTimeout(() => {
          if (!cancelled) {
            setRoundEndVisible(true);
            setDisplayTotal(null);
          }
        }, 1000);
      }

      // 101に近づくほど遅く（ドラマチック）、102以降は一気に流す
      function getStepDelay(nextVal: number): number {
        if (nextVal >= 103) return 30;       // バースト確定後のダメ押しは速く
        if (nextVal === 102) return 260;     // バースト判明の瞬間は少しタメる
        if (nextVal === 101) return toTotal === 101 ? 360 : 280; // ジャスト or バースト直前
        const dist = 101 - nextVal;          // 101より小さい側での距離
        if (dist === 1) return 260;          // 100 直前
        if (dist === 2) return 200;
        if (dist <= 4) return 120;
        if (dist <= 8) return 70;
        return 35;
      }

      function runStep(current: number) {
        if (cancelled) return;
        if (current >= toTotal) {
          setDisplayTotal(toTotal);
          showOverlayAndPersonal();
          return;
        }
        const next = current + 1;
        countTimerRef.current = setTimeout(() => {
          if (cancelled) return;
          setDisplayTotal(next);
          // 音はスロットル（3ステップに1回 or 98以上）でAndroid負荷軽減
          if (next % 3 === 0 || next >= 98) playCountTick(next);
          runStep(next);
        }, getStepDelay(next));
      }

      // オーバーレイは非表示で開始
      setRoundEndVisible(false);

      if (fromTotal >= toTotal) {
        // 加算値がない場合はアニメーションなし、即時オーバーレイ
        showOverlayAndPersonal();
      } else {
        setDisplayTotal(fromTotal);
        runStep(fromTotal);
      }

      return () => {
        cancelled = true;
        if (countTimerRef.current) clearTimeout(countTimerRef.current);
        if (countEndTimerRef.current) clearTimeout(countEndTimerRef.current);
      };
    }

    if (gameState.status === 'playing') {
      setRoundEndVisible(false);
      setDisplayTotal(null);
    }
    // status と roundCount が変わったときだけ起動（gameState 更新ごとにアニメーションをリセットしない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.status, gameState.roundCount]);

  // 退出通知 / スキップ・リターンフラッシュ検知
  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = gameState;
    if (!prev || (gameState.status !== 'playing' && gameState.status !== 'roundEnd')) return;

    const n = players.length;

    // ラウンド開始通知（シャッフル）
    if (prev.roundCount !== gameState.roundCount && gameState.roundCount > 1 && gameState.status === 'playing') {
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
      setNotification(t('game.notification.roundStart', { n: gameState.roundCount }));
      notifTimerRef.current = setTimeout(() => setNotification(null), 2500);
    }

    // 退出・タイムアウトによる新規脱落を検知
    for (const p of players) {
      if (p.id === myId) continue;
      const prevP = prev.players.find(pp => pp.id === p.id);
      if (prevP && !prevP.lost && p.lost) {
        if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
        setNotification(t('game.notification.left', { name: p.name }));
        notifTimerRef.current = setTimeout(() => setNotification(null), 2500);
        break;
      }
    }

    // スキップ・リターンフラッシュ検知（playing中のみ）
    if (gameState.status === 'playing') {
      const prevCard = prev.lastPlayedCard;
      const currCard = gameState.lastPlayedCard;
      if (currCard && prevCard?.id !== currCard.id) {
        // カード再生音
        if (currCard.fromDeck) playDrawSound();
        else playCardSound();

        let action: 'skip' | 'return' | null = null;
        if (currCard.rank === '8' && currCard.addedValue === 0) { action = 'skip'; playSkipSound(); }
        else if (currCard.rank === '9' && currCard.addedValue === 0) { action = 'return'; playReturnSound(); }
        if (action) {
          if (actionEffectClearRef.current) clearTimeout(actionEffectClearRef.current);
          setActionEffect(action);
          actionEffectClearRef.current = setTimeout(() => {
            actionEffectClearRef.current = null;
            setActionEffect(null);
          }, 1400);
        }
      }

      // 自分のターン通知音
      const prevCurrent = prev.players[prev.currentPlayerIndex];
      const nowCurrent = gameState.players[gameState.currentPlayerIndex];
      if (nowCurrent?.id === myId && prevCurrent?.id !== myId) {
        playTurnSound();
      }
    }
  }, [gameState, myId, players]);

  const me = players.find(p => p.id === myId);
  const isMyTurn = players[currentPlayerIndex]?.id === myId && status === 'playing' && !me?.lost;

  // ターン時間カウントダウン表示 + 残り5秒以下で警告音
  useEffect(() => {
    if (!turnDeadline || status !== 'playing') {
      setTurnSecsLeft(null);
      lastWarnSecRef.current = -1;
      return;
    }
    const tick = () => {
      const remain = Math.max(0, Math.ceil((turnDeadline - Date.now()) / 1000));
      setTurnSecsLeft(remain);
      if (isMyTurn && remain > 0 && remain <= 5 && remain !== lastWarnSecRef.current) {
        lastWarnSecRef.current = remain;
        playTurnWarning();
      }
      if (remain === 0) clearInterval(id);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [turnDeadline, status, isMyTurn]);
  const currentPlayer = players[currentPlayerIndex];
  const currentPlayerName = currentPlayer?.name || '';
  const isBotTurn = currentPlayer?.isBot && status === 'playing' && !currentPlayer?.lost;
  const myPoints = points[me?.name || ''] || 0;
  const myCumulative = me && cumulativeStats ? cumulativeStats[me.name] : null;

  // 手札をランク値昇順でソート（A, 2-10, J, Q, K, Joker）
  const rankOrder: Record<string, number> = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'Joker': 14 };
  const sortedHand = me?.hand ? [...me.hand].sort((a, b) => (rankOrder[a.rank] || 0) - (rankOrder[b.rank] || 0)) : [];

  if (status === 'ended') return <EndScreen players={players} points={points} cumulativeStats={cumulativeStats} onRestart={onRestart} />;
  if (status === 'waiting') return (
    <>
      <WaitingScreen gameState={gameState} myId={myId} onStartGame={onStartGame} onLeaveClick={() => setShowLeaveConfirm(true)} />
      {showLeaveConfirm && <LeaveConfirmModal isPlaying={false} onCancel={() => setShowLeaveConfirm(false)} onConfirm={onRestart} />}
    </>
  );

  // roundEnd 直後は useLayoutEffect で displayTotal が fromTotal にセットされるが、
  // その前のフレームで最終値がチラ見えしないよう、描画時点で起点を計算しておく
  const resolvedDisplay = displayTotal !== null
    ? displayTotal
    : (status === 'roundEnd' && roundResult
        ? Math.max(0, currentTotal - (lastPlayedCard?.addedValue ?? 0))
        : currentTotal);
  const shownTotal = resolvedDisplay;
  const totalColor = shownTotal >= 90 ? 'text-red-400' : shownTotal >= 70 ? 'text-yellow-400' : 'text-white';

  // 時計回り順に並べる（自分の次から）
  const myIndex = players.findIndex(p => p.id === myId);
  const n = players.length;
  const orderedOthers = Array.from({ length: n - 1 }, (_, i) => players[(myIndex + 1 + i) % n]);

  return (
    <div className="min-h-screen bg-green-900 flex flex-col select-none overflow-y-auto">

      {/* 通知バナー */}
      {notification && (
        <div className="fixed left-1/2 -translate-x-1/2 z-50 bg-yellow-500 text-black font-bold px-5 py-2.5 rounded-full shadow-lg text-sm whitespace-nowrap" style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}>
          {notification}
        </div>
      )}

      {/* ターンタイマー (ターン中のみ表示) */}
      {turnSecsLeft !== null && status === 'playing' && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 z-40 px-3.5 py-1 rounded-full shadow-md text-xs font-bold whitespace-nowrap flex items-center gap-1.5 safe-top-10 ${
            turnSecsLeft <= 5
              ? 'bg-red-600 text-white animate-pulse'
              : isMyTurn ? 'bg-yellow-500 text-black' : 'bg-green-700/80 text-green-100'
          }`}
        >
          <span>⏱</span>
          <span>{isMyTurn ? t('game.timer.you') : `${currentPlayerName}`} — {turnSecsLeft}s</span>
        </div>
      )}

      {/* 接続状態インジケータ */}
      <div className="fixed left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 safe-top-2" title={connected ? t('game.connected') : t('game.disconnected')}>
        <span className={`inline-block w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`} />
        {!connected && <span className="text-red-400 text-xs font-bold">{t('game.disconnected')}</span>}
      </div>

      {/* ルールボタン・ミュートボタン */}
      <div className="fixed z-30 flex items-center gap-1.5 safe-top-2 safe-right-2">
        <button
          onClick={() => setMuted(toggleMute())}
          className="bg-green-700 hover:bg-green-600 text-white text-xs font-bold w-7 h-7 rounded-full shadow flex items-center justify-center"
          title={muted ? t('game.muted') : t('game.unmuted')}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <button
          onClick={() => setShowRules(true)}
          className="bg-green-700 hover:bg-green-600 text-white text-base font-bold px-4 py-2 rounded-full shadow"
        >
          {t('game.rules')}
        </button>
      </div>

      {/* 他プレイヤー（上部、左から時計回り順） */}
      <div className="flex flex-wrap justify-center gap-2 sm:gap-4 px-2 sm:px-3 pt-14 sm:pt-14 pb-10 sm:pb-10">
        {orderedOthers.map(player => (
          <OtherPlayerArea
            key={player.id}
            player={player}
            isCurrentTurn={players[currentPlayerIndex]?.id === player.id}
            points={points[player.name] || 0}
            cumulative={cumulativeStats ? cumulativeStats[player.name] : null}
            elRef={el => {
              if (el) otherPlayerRefs.current.set(player.name, el);
              else otherPlayerRefs.current.delete(player.name);
            }}
          />
        ))}
      </div>

      {/* ゲーム情報（中央） */}
      <div className="flex items-center justify-center px-1 py-10 sm:py-12">
        <div className="text-center space-y-2 sm:space-y-3 w-full">
          <p className="text-green-500 text-xs uppercase tracking-widest">{t('game.round', { n: roundCount })} ｜ {t('game.totalLabel')}</p>

          {/* 合計 + 最後のカード + 山札 */}
          <div className="relative flex items-center justify-center gap-3 sm:gap-6">
            <DirectionArrows direction={direction} />

            {/* 最後に出されたカード（左） — 出所の位置から飛んでくるアニメーション */}
            {lastPlayedCard && (
              <div ref={playSlotRef} className="flex flex-col items-center gap-1">
                <CardComponent card={lastPlayedCard} />
                <p className="text-green-300 text-xs mt-2">
                  {lastPlayedCard.playerName}
                  {lastPlayedCard.fromDeck && <span className="ml-1 text-blue-300">{t('game.fromDeck')}</span>}
                </p>
              </div>
            )}

            {/* 合計 */}
            <div className={`text-6xl sm:text-8xl font-bold tabular-nums ${totalColor} transition-colors duration-300`}>
              {shownTotal}
            </div>

            {/* 山札（右） */}
            <button
              ref={deckRef}
              onClick={isMyTurn ? onDrawFromDeck : undefined}
              disabled={!isMyTurn}
              aria-label={t('game.deck.aria', { n: deckCount })}
              className={`relative flex flex-col items-center gap-1 transition-all duration-150 ${isMyTurn ? 'active:scale-95 cursor-pointer' : 'cursor-default opacity-60'}`}
            >
              {/* カードの重なり（奥行き表現） */}
              <div className="relative">
                <div className="absolute top-1 left-1 w-20 sm:w-16 h-28 sm:h-24 rounded-lg bg-blue-900 border border-blue-700" />
                <div className="absolute top-0.5 left-0.5 w-20 sm:w-16 h-28 sm:h-24 rounded-lg bg-blue-900 border border-blue-700" />
                <div className={`relative w-20 sm:w-16 h-28 sm:h-24 rounded-lg border-2 flex items-center justify-center
                  ${isMyTurn
                    ? 'bg-blue-800 border-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.6)]'
                    : 'bg-blue-900 border-blue-600'}`}
                >
                  <span className="text-4xl sm:text-4xl">?</span>
                </div>
              </div>
              <p className="text-green-300 text-xs mt-2">{t('game.deck.cards', { n: deckCount })}</p>
            </button>
          </div>

          {isMyTurn ? (
            <div className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-bold text-xs sm:text-sm bg-yellow-500 text-black">
              {t('game.yourTurn')}
            </div>
          ) : isBotTurn ? (
            <div className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-bold text-xs sm:text-sm bg-indigo-500/70 text-white">
              {t('game.botThinking', { name: currentPlayerName })}
            </div>
          ) : status === 'playing' ? (
            <div className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-bold text-xs sm:text-sm bg-green-700/50 text-green-300">
              {t('game.othersTurn', { name: currentPlayerName })}
            </div>
          ) : null}
        </div>
      </div>

      {/* 自分の手札（下） */}
      <div className="px-2 sm:px-4 pt-10 sm:pt-10 border-t border-green-800 pb-3 sm:pb-4">
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2 sm:mb-3">
          {isMyTurn && <p className="text-yellow-400 text-xs">{t('game.tapToPlay')}</p>}
          <span className="text-base sm:text-lg text-green-300 font-bold">{me?.avatar ? `${me.avatar} ` : ''}{me?.name}</span>
          <span className={`text-base sm:text-lg font-bold px-3 py-1 rounded-full ${myPoints >= 0 ? 'text-yellow-300 bg-yellow-900/40' : 'text-red-400 bg-red-900/40'}`}>
            {myPoints >= 0 ? '+' : ''}{myPoints}pt
          </span>
          {myCumulative != null && (
            <span className="text-xs text-yellow-400">{t('game.cumulativeShort', { points: (myCumulative.totalPoints >= 0 ? '+' : '') + myCumulative.totalPoints })}</span>
          )}
        </div>
        <div ref={handRef} className="flex justify-center gap-3 sm:gap-4 flex-wrap pb-1 sm:pb-2">
          {sortedHand.map(card => (
            <div key={card.id} className="mb-3 sm:mb-4">
              <CardComponent
                card={card}
                onClick={isMyTurn ? () => onPlayCard(card) : undefined}
                disabled={!isMyTurn}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 退出ボタン */}
      <button
        onClick={() => setShowLeaveConfirm(true)}
        className="fixed z-30 bg-green-700 hover:bg-green-600 text-white text-base font-bold px-4 py-2 rounded-full shadow safe-top-2 safe-left-2"
      >
        {t('game.exit')}
      </button>

      {/* ルールモーダル */}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {/* 退出確認モーダル */}
      {showLeaveConfirm && <LeaveConfirmModal isPlaying={true} onCancel={() => setShowLeaveConfirm(false)} onConfirm={onRestart} />}

      {/* アニメーション keyframe 定義（常時DOMに置く） */}
      <style>{`
        @keyframes round-flash {
          0%   { opacity: 0.55; }
          60%  { opacity: 0.3; }
          100% { opacity: 0; }
        }
        @keyframes round-text-pop {
          0%   { transform: scale(0.2); opacity: 0; }
          20%  { transform: scale(1.18); opacity: 1; }
          35%  { transform: scale(0.95); opacity: 1; }
          45%  { transform: scale(1.0);  opacity: 1; }
          72%  { transform: scale(1.0);  opacity: 1; }
          100% { transform: scale(1.05); opacity: 0; }
        }
        @keyframes personal-slide-up {
          0%   { transform: translateY(40px); opacity: 0; }
          20%  { transform: translateY(0);    opacity: 1; }
          70%  { transform: translateY(0);    opacity: 1; }
          100% { transform: translateY(-10px); opacity: 0; }
        }
        @keyframes action-flash {
          0%   { opacity: 0.45; }
          50%  { opacity: 0.25; }
          100% { opacity: 0; }
        }
        @keyframes action-text-pop {
          0%   { transform: scale(0.3); opacity: 0; }
          25%  { transform: scale(1.15); opacity: 1; }
          40%  { transform: scale(0.97); opacity: 1; }
          60%  { transform: scale(1.0);  opacity: 1; }
          100% { transform: scale(1.0);  opacity: 0; }
        }
      `}</style>

      {/* ラウンド終了エフェクト */}
      {roundEffect && (
        <>
          {/* 画面フラッシュ */}
          <div
            className="fixed inset-0 pointer-events-none z-50"
            style={{
              backgroundColor: roundEffect === '102' ? '#ef4444' : '#facc15',
              animation: 'round-flash 0.7s ease-out forwards',
            }}
          />
          {/* 中央テキスト */}
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
            <p
              className="font-black drop-shadow-2xl text-center select-none"
              style={{
                fontSize: 'clamp(3rem, 15vw, 6rem)',
                color: roundEffect === '102' ? '#fca5a5' : '#fef08a',
                textShadow: roundEffect === '102'
                  ? '0 0 30px rgba(239,68,68,0.8), 0 4px 8px rgba(0,0,0,0.8)'
                  : '0 0 30px rgba(250,204,21,0.8), 0 4px 8px rgba(0,0,0,0.8)',
                animation: 'round-text-pop 2.2s ease-out forwards',
              }}
            >
              {roundEffect === '101' ? t('game.effect.101') : roundEffect === 'joker101' ? t('game.effect.joker101') : t('game.effect.bust')}
            </p>
          </div>
        </>
      )}

      {/* スキップ・リターンフラッシュ */}
      {actionEffect && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
          <p
            className="font-black drop-shadow-2xl select-none"
            style={{
              fontSize: 'clamp(3rem, 15vw, 5.5rem)',
              color: actionEffect === 'skip' ? '#fb923c' : '#c084fc',
              textShadow: actionEffect === 'skip'
                ? '0 0 30px rgba(249,115,22,0.9), 0 4px 8px rgba(0,0,0,0.8)'
                : '0 0 30px rgba(168,85,247,0.9), 0 4px 8px rgba(0,0,0,0.8)',
              animation: 'action-text-pop 1.4s ease-out forwards',
            }}
          >
            {actionEffect === 'skip' ? t('game.effect.skip') : t('game.effect.return')}
          </p>
        </div>
      )}

      {/* パーソナルバナー（常時DOM上、imperativeで制御） */}
      <div className="fixed bottom-32 inset-x-0 flex justify-center pointer-events-none z-50">
        <div
          ref={personalBannerRef}
          className="px-8 py-3 rounded-2xl font-black text-3xl shadow-2xl text-white"
        />
      </div>

      {/* ラウンド終了・投票オーバーレイ */}
      {roundEndVisible && roundResult && (
        <RoundEndOverlay
          result={roundResult}
          players={players}
          points={points}
          cumulativeStats={cumulativeStats}
          votes={votes}
          myId={myId}
          roundCount={roundCount}
          voteDeadline={gameState.voteDeadline}
          onVote={onVote}
        />
      )}
    </div>
  );
}
