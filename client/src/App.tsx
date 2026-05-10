import { useEffect, useState, useCallback, useRef } from 'react';
import { socket } from './socket';
import { GameState, Card, CumulativeStat, MatchmakingPlayer } from './types';
import { useLocale, t } from './i18n';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import ChoiceModal from './components/ChoiceModal';
import LeaderboardModal from './components/LeaderboardModal';

const UUID_KEY = '101game-uuid';
function getOrCreateUUID(): string {
  let uuid = localStorage.getItem(UUID_KEY);
  if (!uuid) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      uuid = crypto.randomUUID();
    } else {
      // 古いブラウザ向けフォールバック
      uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    }
    localStorage.setItem(UUID_KEY, uuid);
  }
  return uuid;
}
const MY_UUID = getOrCreateUUID();

const STORAGE_KEY = '101game-session';

interface PendingCard {
  card: Card;
  fromDeck: boolean;
}

function saveSession(playerName: string, roomId: string) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ playerName, roomId }));
}

function clearSession() {
  sessionStorage.removeItem(STORAGE_KEY);
}

function loadSession(): { playerName: string; roomId: string } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function App() {
  useLocale();
  const [myId, setMyId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [phase, setPhase] = useState<'lobby' | 'game' | 'reconnecting' | 'matchmaking'>('reconnecting');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [pendingCard, setPendingCard] = useState<PendingCard | null>(null);
  const [error, setError] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [matchReadyCount, setMatchReadyCount] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [countdownStartedAt, setCountdownStartedAt] = useState<number | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(5);
  const [displayCountdown, setDisplayCountdown] = useState<number | null>(null);
  const [matchPlayers, setMatchPlayers] = useState<MatchmakingPlayer[]>([]);
  const [myStats, setMyStats] = useState<CumulativeStat | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showLeaveMatchmakingConfirm, setShowLeaveMatchmakingConfirm] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false); // 連打防止
  const [disconnectedAt, setDisconnectedAtState] = useState<number | null>(null);
  const [reconnectCountdown, setReconnectCountdown] = useState(60);
  const [dailyBonus, setDailyBonus] = useState<number | null>(null);
  const dailyBonusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectedAtRef = useRef<number | null>(null);
  const phaseRef = useRef<string>('reconnecting');

  // 合計値アニメーション用
  const [displayTotal, setDisplayTotal] = useState(0);
  const [displayCurrentPlayerIndex, setDisplayCurrentPlayerIndex] = useState(0);
  const displayTotalRef = useRef(0);

  // phaseRef を常に最新に保つ
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // 再接続カウントダウン
  useEffect(() => {
    if (disconnectedAt === null) { setReconnectCountdown(60); return; }
    const id = setInterval(() => {
      const remaining = Math.max(0, 60 - Math.floor((Date.now() - disconnectedAt) / 1000));
      setReconnectCountdown(remaining);
      if (remaining === 0) {
        clearSession();
        disconnectedAtRef.current = null;
        setDisconnectedAtState(null);
        setPhase('lobby');
      }
    }, 500);
    return () => clearInterval(id);
  }, [disconnectedAt]);

  // 起動時に前回のセッションがあれば再接続を試みる
  useEffect(() => {
    const session = loadSession();
    if (!session) { setPhase('lobby'); return; }

    socket.connect();
    socket.once('connect', () => {
      socket.emit('reconnect-game', { roomId: session.roomId, playerName: session.playerName },
        (res: { success: boolean; error?: string; roomId?: string; state?: GameState }) => {
          if (res.success && res.state && res.roomId) {
            setMyId(socket.id!);
            setRoomId(res.roomId);
            setGameState(res.state);
            setPhase('game');
          } else {
            // 再接続失敗 → ロビーへ
            clearSession();
            setPhase('lobby');
          }
        }
      );
    });

    // 接続失敗時もロビーへ
    socket.once('connect_error', () => {
      clearSession();
      setPhase('lobby');
    });
  }, []);

  useEffect(() => {
    socket.on('connect', () => {
      setMyId(socket.id!);
      setError('');
      // ゲーム中の切断から再接続した場合
      if (disconnectedAtRef.current !== null) {
        const session = loadSession();
        if (session) {
          socket.emit('reconnect-game', { roomId: session.roomId, playerName: session.playerName },
            (res: { success: boolean; error?: string; roomId?: string; state?: GameState }) => {
              disconnectedAtRef.current = null;
              setDisconnectedAtState(null);
              if (res.success && res.state && res.roomId) {
                setMyId(socket.id!);
                setRoomId(res.roomId);
                setGameState(res.state);
              } else {
                clearSession();
                setPhase('lobby');
              }
            }
          );
        } else {
          disconnectedAtRef.current = null;
          setDisconnectedAtState(null);
          setPhase('lobby');
        }
      }
    });
    socket.on('disconnect', () => {
      setError(t('error.disconnected'));
      setPendingCard(null); // 切断時にpendingCardをクリア
      if (phaseRef.current === 'game') {
        const now = Date.now();
        disconnectedAtRef.current = now;
        setDisconnectedAtState(now);
        setTimeout(() => { if (!socket.connected) socket.connect(); }, 1500);
      }
    });
    socket.on('game-update', (state: GameState) => setGameState(state));
    socket.on('return-to-lobby', () => {
      clearSession();
      setGameState(null);
      setRoomId('');
      setPhase('lobby');
    });
    socket.on('return-to-matchmaking', ({ playerName }: { playerName: string }) => {
      clearSession();
      setGameState(null);
      setRoomId('');
      setIsReady(false);
      setMatchCount(0);
      setMatchReadyCount(0);
      setCountdownStartedAt(null);
      setMatchPlayers([]);
      socket.emit('get-player-stats', { uuid: MY_UUID }, (stats: CumulativeStat | null) => {
        setMyStats(stats);
      });
      socket.emit('join-matchmaking', { playerName, uuid: MY_UUID }, (res: { success: boolean; count?: number; error?: string }) => {
        if (res?.success) {
          setMatchCount(res.count || 1);
          setPhase('matchmaking');
        } else {
          setPhase('lobby');
        }
      });
    });
    socket.on('matchmaking-update', ({ count, readyCount, countdownStartedAt: csa, countdownSeconds: cds, players: mqPlayers }: { count: number; readyCount?: number; countdownStartedAt?: number | null; countdownSeconds?: number | null; players?: MatchmakingPlayer[] }) => {
      setMatchCount(count);
      if (readyCount !== undefined) setMatchReadyCount(readyCount);
      setCountdownStartedAt(csa ?? null);
      if (typeof cds === 'number') setCountdownSeconds(cds);
      if (mqPlayers) setMatchPlayers(mqPlayers);
    });
    socket.on('daily-bonus', ({ amount }: { amount: number }) => {
      setDailyBonus(amount);
      if (dailyBonusTimerRef.current) clearTimeout(dailyBonusTimerRef.current);
      dailyBonusTimerRef.current = setTimeout(() => {
        setDailyBonus(null);
        dailyBonusTimerRef.current = null;
      }, 4500);
    });
    socket.on('matchmaking-matched', ({ roomId: rid, state }: { roomId: string; state: GameState }) => {
      setMyId(socket.id!);
      setRoomId(rid);
      setGameState(state);
      saveSession(state.players.find(p => p.id === socket.id!)?.name || '', rid);
      setIsReady(false);
      setMatchReadyCount(0);
      setCountdownStartedAt(null);
      setPhase('game');
    });
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('game-update');
      socket.off('return-to-lobby');
      socket.off('return-to-matchmaking');
      socket.off('matchmaking-update');
      socket.off('matchmaking-matched');
      socket.off('daily-bonus');
    };
  }, []);

  const handleCreateRoom = useCallback((name: string, avatar: string) => {
    if (actionInProgress) return;
    setActionInProgress(true);
    setError('');
    if (!socket.connected) socket.connect();
    socket.timeout(5000).emit('create-room', { playerName: name, uuid: MY_UUID, avatar },
      (err: Error | null, res: { success: boolean; error?: string; roomId?: string; state?: GameState }) => {
        setActionInProgress(false);
        if (err) { setError(t('error.connect')); return; }
        if (res.success && res.state && res.roomId) {
          setMyId(socket.id!);
          setRoomId(res.roomId);
          setGameState(res.state);
          saveSession(name, res.roomId);
          setPhase('game');
        } else {
          setError(res.error || t('error.generic'));
        }
      });
  }, [actionInProgress]);

  const handleJoinRoom = useCallback((name: string, rid: string, avatar: string) => {
    if (actionInProgress) return;
    setActionInProgress(true);
    setError('');
    if (!socket.connected) socket.connect();
    socket.timeout(5000).emit('join-room', { playerName: name, roomId: rid, uuid: MY_UUID, avatar },
      (err: Error | null, res: { success: boolean; error?: string; roomId?: string; state?: GameState }) => {
        setActionInProgress(false);
        if (err) { setError(t('error.connect')); return; }
        if (res.success && res.state && res.roomId) {
          setMyId(socket.id!);
          setRoomId(res.roomId);
          setGameState(res.state);
          saveSession(name, res.roomId);
          setPhase('game');
        } else {
          setError(res.error || t('error.generic'));
        }
      });
  }, [actionInProgress]);

  const handleJoinMatchmaking = useCallback((name: string, avatar: string) => {
    if (actionInProgress) return;
    setActionInProgress(true);
    setError('');
    if (!socket.connected) socket.connect();
    // 自分のstatsを事前取得
    socket.emit('get-player-stats', { uuid: MY_UUID }, (stats: CumulativeStat | null) => {
      setMyStats(stats);
    });
    socket.timeout(5000).emit('join-matchmaking', { playerName: name, uuid: MY_UUID, avatar }, (err: Error | null, res: { success: boolean; error?: string; count?: number }) => {
      setActionInProgress(false);
      if (err) {
        setError(t('error.connect'));
        return;
      }
      if (res.success) {
        setMatchCount(res.count || 1);
        setPhase('matchmaking');
      } else {
        setError(res.error || t('error.generic'));
      }
    });
  }, [actionInProgress]);

  // カウントダウン表示用タイマー
  // countdownStartedAt が変わるたびに、サーバー指定の秒数からカウントし直す
  useEffect(() => {
    if (countdownStartedAt === null) { setDisplayCountdown(null); return; }
    setDisplayCountdown(countdownSeconds);
    let secs = countdownSeconds;
    const id = setInterval(() => {
      secs = Math.max(0, secs - 1);
      setDisplayCountdown(secs);
      if (secs === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [countdownStartedAt, countdownSeconds]);

  // 合計値カウントアップ/ダウンアニメーション
  useEffect(() => {
    if (!gameState) return;
    const target = gameState.currentTotal;
    const targetIdx = gameState.currentPlayerIndex;
    const from = displayTotalRef.current;

    // roundEnd時はGameBoard側で独自にカウントアップするのでここではスキップ
    // 0リセット（ラウンド開始）や変化なしもアニメーションなし
    if (gameState.status === 'roundEnd' || target === from || target === 0) {
      displayTotalRef.current = target;
      setDisplayTotal(target);
      setDisplayCurrentPlayerIndex(targetIdx);
      return;
    }

    const diff = target - from;
    const steps = Math.min(Math.abs(diff), 10);
    const ms = Math.ceil(200 / steps);
    let step = 0;

    const id = setInterval(() => {
      step++;
      const val = step >= steps ? target : Math.round(from + diff * (step / steps));
      displayTotalRef.current = val;
      setDisplayTotal(val);
      if (step >= steps) {
        clearInterval(id);
        setDisplayCurrentPlayerIndex(targetIdx);
      }
    }, ms);

    return () => clearInterval(id);
  }, [gameState]);

  const handleLeaveMatchmaking = useCallback(() => {
    socket.emit('leave-matchmaking', () => {});
    setPhase('lobby');
    setMatchCount(0);
    setMatchReadyCount(0);
    setIsReady(false);
    setCountdownStartedAt(null);
    setMatchPlayers([]);
  }, []);

  const handleOpenLeaderboard = useCallback(() => {
    if (!socket.connected) socket.connect();
    setShowLeaderboard(true);
  }, []);

  const handleReadyMatchmaking = useCallback(() => {
    socket.timeout(5000).emit('ready-matchmaking', (err: Error | null, res: { success: boolean; error?: string }) => {
      if (err) { setError(t('error.connectErr')); return; }
      if (res.success) setIsReady(true);
      else setError(res.error || t('error.generic'));
    });
  }, []);

  const handleUnreadyMatchmaking = useCallback(() => {
    socket.emit('unready-matchmaking', (res: { success: boolean; error?: string }) => {
      if (res?.success) {
        setIsReady(false);
      } else if (res?.error) {
        setError(res.error);
      }
    });
  }, []);

  const handleStartGame = useCallback(() => {
    socket.emit('start-game', { roomId }, (res: { success: boolean; error?: string }) => {
      if (!res.success) setError(res.error || t('error.generic'));
    });
  }, [roomId]);

  const handleVote = useCallback((vote: 'continue' | 'quit') => {
    socket.emit('vote', { roomId, vote }, (res: { success: boolean; error?: string }) => {
      if (!res.success) setError(res.error || t('error.generic'));
    });
  }, [roomId]);

  const handlePlayCard = useCallback((card: Card) => {
    if (card.rank === '10' || card.rank === '8' || card.rank === '9') {
      setPendingCard({ card, fromDeck: false });
      return;
    }
    socket.emit('play-card', { roomId, cardId: card.id }, (res: { success: boolean; error?: string }) => {
      if (!res.success) setError(res.error || t('error.generic'));
    });
  }, [roomId]);

  const handleDrawFromDeck = useCallback(() => {
    socket.emit('draw-from-deck', { roomId },
      (res: { success: boolean; error?: string; card?: Card; needsChoice?: boolean }) => {
        if (!res.success) { setError(res.error || t('error.generic')); return; }
        if (res.needsChoice && res.card) {
          setPendingCard({ card: res.card, fromDeck: true });
        }
      });
  }, [roomId]);

  const handleChoice = useCallback((choice: string) => {
    if (!pendingCard) return;
    if (pendingCard.fromDeck) {
      socket.emit('play-drawn-card', { roomId, choice }, (res: { success: boolean; error?: string }) => {
        if (!res.success) setError(res.error || t('error.generic'));
      });
    } else {
      socket.emit('play-card', { roomId, cardId: pendingCard.card.id, choice },
        (res: { success: boolean; error?: string }) => {
          if (!res.success) setError(res.error || t('error.generic'));
        });
    }
    setPendingCard(null);
  }, [pendingCard, roomId]);

  // 再接続中スプラッシュ（初回起動時）
  if (phase === 'reconnecting') {
    return (
      <div className="min-h-screen bg-green-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-spin">🃏</div>
          <p className="text-white text-lg">{t('splash.connecting')}</p>
          <p className="text-green-500 text-xs mt-2">{t('splash.reconnecting')}</p>
        </div>
      </div>
    );
  }

  if (phase === 'lobby') {
    return (
      <>
        <Lobby onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} onJoinMatchmaking={handleJoinMatchmaking} error={error} onClearError={() => setError('')} myUUID={MY_UUID} onOpenLeaderboard={handleOpenLeaderboard} />
        {showLeaderboard && <LeaderboardModal myUUID={MY_UUID} onClose={() => setShowLeaderboard(false)} />}
      </>
    );
  }

  if (phase === 'matchmaking') {
    return (
      <div className="min-h-screen bg-green-900 flex items-center justify-center p-4">
        <div className="bg-green-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
          <div className="text-5xl mb-3 animate-spin">🃏</div>
          <h2 className="text-2xl font-bold text-white mb-1">{t('mm.title')}</h2>
          <p className="text-green-400 text-sm mb-3">{t('mm.subtitle')}</p>

          {/* 自分の累計ポイント */}
          {myStats && (
            <div className="bg-green-700/50 rounded-xl px-4 py-2 mb-3 text-left">
              <p className="text-green-400 text-xs mb-1">{t('mm.yourCumulative')}</p>
              <p className="text-yellow-300 font-bold">{myStats.totalPoints >= 0 ? '+' : ''}{myStats.totalPoints}pt <span className="text-green-400 text-xs font-normal">{myStats.gamesPlayed} {t('mm.gamesUnit')}</span></p>
            </div>
          )}

          <div className="bg-green-700 rounded-xl px-6 py-3 mb-3">
            <p className="text-yellow-400 text-4xl font-bold">{matchCount} / 4</p>
            <p className="text-green-400 text-xs mt-1">{t('mm.waiting')}</p>
          </div>

          {/* 参加者リスト */}
          {matchPlayers.length > 0 && (
            <div className="bg-green-700/40 rounded-xl px-4 py-3 mb-3 text-left">
              <p className="text-green-400 text-xs font-bold mb-2 uppercase tracking-wider">{t('mm.playerList')}</p>
              <div className="space-y-1">
                {matchPlayers.map((p, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-white text-sm">{p.name}</span>
                    <span className="text-yellow-300 text-xs font-bold">
                      {p.stats ? `${p.stats.totalPoints >= 0 ? '+' : ''}${p.stats.totalPoints}pt` : t('mm.firstTime')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {matchCount >= 2 && (
            <div className="mb-3 space-y-2">
              {displayCountdown !== null ? (
                <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl px-4 py-3">
                  <p className="text-yellow-300 font-bold text-lg">{t('mm.countdown', { seconds: displayCountdown })}</p>
                  <p className="text-yellow-400 text-xs mt-1">{t('mm.ready', { ready: matchReadyCount, total: matchCount })}</p>
                </div>
              ) : (
                <p className="text-green-400 text-xs">{t('mm.ready', { ready: matchReadyCount, total: matchCount })}</p>
              )}
              {!isReady ? (
                <button onClick={handleReadyMatchmaking} className="w-full bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-black font-bold py-3 rounded-xl transition-all">
                  {t('mm.startButton')}
                </button>
              ) : displayCountdown !== null ? (
                <div className="w-full bg-green-600 text-white font-bold py-3 rounded-xl text-center">
                  {t('mm.readyDone')}
                </div>
              ) : (
                <button onClick={handleUnreadyMatchmaking} className="w-full bg-green-600 hover:bg-green-500 active:scale-95 text-white font-bold py-3 rounded-xl transition-all">
                  {t('mm.unready')}
                </button>
              )}
            </div>
          )}

          <div className="space-y-2">
            <button onClick={handleOpenLeaderboard} className="w-full bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold py-2.5 rounded-xl transition-all text-sm">
              {t('lobby.leaderboard')}
            </button>
            {displayCountdown === null && (
              <button onClick={() => setShowLeaveMatchmakingConfirm(true)} className="w-full bg-gray-600 hover:bg-gray-500 active:scale-95 text-white font-bold py-2.5 rounded-xl transition-all text-sm">
                {t('mm.leave')}
              </button>
            )}
          </div>
        </div>

        {/* ランキングモーダル */}
        {showLeaderboard && <LeaderboardModal myUUID={MY_UUID} onClose={() => setShowLeaderboard(false)} />}

        {/* マッチング退出確認 */}
        {showLeaveMatchmakingConfirm && (
          <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
            <div className="bg-green-800 rounded-2xl p-6 max-w-xs w-full shadow-2xl text-center">
              <p className="text-xl font-bold text-white mb-2">{t('mm.leaveConfirm.title')}</p>
              <p className="text-green-400 text-sm mb-4">{t('mm.leaveConfirm.body')}</p>
              <div className="flex gap-3">
                <button onClick={() => setShowLeaveMatchmakingConfirm(false)} className="flex-1 bg-green-700 hover:bg-green-600 active:scale-95 text-white font-bold py-3 rounded-xl transition-all">
                  {t('mm.leaveConfirm.cancel')}
                </button>
                <button onClick={() => { setShowLeaveMatchmakingConfirm(false); handleLeaveMatchmaking(); }} className="flex-1 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold py-3 rounded-xl transition-all">
                  {t('mm.leave')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-900">
      {gameState && (
        <GameBoard
          gameState={{ ...gameState, currentTotal: gameState.status === 'roundEnd' ? gameState.currentTotal : displayTotal, currentPlayerIndex: displayCurrentPlayerIndex }}
          myId={myId}
          onPlayCard={handlePlayCard}
          onDrawFromDeck={handleDrawFromDeck}
          onStartGame={handleStartGame}
          onVote={handleVote}
          onRestart={() => {
            clearSession();
            if (gameState && (gameState.status === 'playing' || gameState.status === 'roundEnd') && socket.connected) {
              let done = false;
              const doReload = () => { if (!done) { done = true; window.location.reload(); } };
              socket.emit('leave-game', doReload);
              setTimeout(doReload, 1500);
            } else {
              window.location.reload();
            }
          }}
        />
      )}

      {pendingCard && gameState && (
        <ChoiceModal
          card={pendingCard.card}
          currentTotal={gameState.currentTotal}
          onChoice={handleChoice}
          onCancel={() => setPendingCard(null)}
          fromDeck={pendingCard.fromDeck}
        />
      )}

      {/* 再接続カウントダウンオーバーレイ */}
      {disconnectedAt !== null && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
          <div className="bg-green-800 rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">
            <div className="text-5xl mb-4">🔌</div>
            <h2 className="text-xl font-bold text-white mb-2">{t('disconnect.title')}</h2>
            <p className="text-green-400 text-sm mb-4">{t('disconnect.subtitle')}</p>
            <div className="bg-green-700 rounded-xl px-6 py-4 mb-5">
              <p className={`text-5xl font-bold tabular-nums ${reconnectCountdown <= 10 ? 'text-red-400' : 'text-yellow-300'}`}>
                {reconnectCountdown}
              </p>
              <p className="text-green-400 text-xs mt-1">{t('disconnect.note')}</p>
            </div>
            <button
              onClick={() => socket.connect()}
              className="w-full bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-black font-bold py-3 rounded-xl transition-all"
            >
              {t('disconnect.button')}
            </button>
          </div>
        </div>
      )}

      {/* デイリーボーナストースト */}
      {dailyBonus !== null && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-yellow-400 to-yellow-300 text-black rounded-xl shadow-2xl px-5 py-3 flex items-center gap-3"
          role="alert"
          aria-live="polite"
          style={{ top: 'calc(1.25rem + env(safe-area-inset-top))' }}
        >
          <div className="text-3xl">🎁</div>
          <div>
            <div className="font-bold text-sm">{t('dailyBonus.title')}</div>
            <div className="font-black text-lg">{t('dailyBonus.amount', { amount: dailyBonus })}</div>
          </div>
        </div>
      )}
      {error && (
        <div
          className="fixed bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50"
          style={{
            bottom: 'calc(1rem + env(safe-area-inset-bottom))',
            right: 'calc(1rem + env(safe-area-inset-right))',
          }}
        >
          <span>{error}</span>
          <button onClick={() => setError('')} className="font-bold">✕</button>
        </div>
      )}
    </div>
  );
}
