import { useState, useEffect } from 'react';
import { socket } from '../socket';
import { CumulativeStat } from '../types';
import RulesModal from './RulesModal';
import LegalModal from './LegalModal';

interface Props {
  onCreateRoom: (name: string) => void;
  onJoinRoom: (name: string, roomId: string) => void;
  onJoinMatchmaking: (name: string) => void;
  error: string;
  onClearError: () => void;
  myUUID: string;
  onOpenLeaderboard: () => void;
}

type Mode = 'menu' | 'create' | 'join' | 'matchmaking';

const sanitizeName = (n: string) => n.replace(/[\x00-\x1F\x7F]/g, '').trim();

export default function Lobby({ onCreateRoom, onJoinRoom, onJoinMatchmaking, error, onClearError, myUUID, onOpenLeaderboard }: Props) {
  const [mode, setMode] = useState<Mode>('menu');
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [myStats, setMyStats] = useState<CumulativeStat | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [legalTab, setLegalTab] = useState<'privacy' | 'terms' | null>(null);

  useEffect(() => {
    if (mode !== 'matchmaking' || !myUUID) return;

    const fetchStats = () => {
      socket.emit('get-player-stats', { uuid: myUUID }, (stats: CumulativeStat | null) => {
        setMyStats(stats);
      });
    };

    if (socket.connected) {
      fetchStats();
    } else {
      socket.connect();
      socket.once('connect', fetchStats);
    }

    return () => { socket.off('connect', fetchStats); };
  }, [mode, myUUID]);

  function handleModeChange(m: Mode) {
    onClearError();
    setMode(m);
  }

  return (
    <div className="min-h-screen bg-green-900 flex items-center justify-center p-4 relative">
      <div className="bg-green-800 rounded-2xl p-8 shadow-2xl w-full max-w-sm">
        {/* タイトル */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🃏</div>
          <h1 className="text-4xl font-bold text-white tracking-wide">Hit<span className="text-yellow-400">101</span></h1>
          <p className="text-green-400 mt-1 text-sm">合計をピッタリ101にしたら勝ち！</p>
        </div>

        {mode === 'menu' && (
          <div className="space-y-3">
            <button
              onClick={() => handleModeChange('create')}
              className="w-full bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-black font-bold py-4 rounded-xl text-lg transition-all duration-150 shadow-lg"
            >
              ルームを作成
            </button>
            <button
              onClick={() => handleModeChange('join')}
              className="w-full bg-blue-500 hover:bg-blue-400 active:scale-95 text-white font-bold py-4 rounded-xl text-lg transition-all duration-150 shadow-lg"
            >
              ルームに参加
            </button>
            <button
              onClick={() => handleModeChange('matchmaking')}
              className="w-full bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold py-4 rounded-xl text-lg transition-all duration-150 shadow-lg"
            >
              🔍 ランダムマッチ
            </button>
            <button
              onClick={() => setShowRules(true)}
              className="w-full bg-green-700 hover:bg-green-600 active:scale-95 text-green-300 font-bold py-2.5 rounded-xl text-sm transition-all duration-150"
            >
              ？ ルール確認
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="space-y-4">
            <h2 className="text-white text-xl font-bold">ルームを作成</h2>
            <div>
              <label className="text-green-300 text-sm block mb-1">プレイヤー名</label>
              <input
                type="text"
                placeholder="名前を入力"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sanitizeName(name) && onCreateRoom(sanitizeName(name))}
                className="w-full px-4 py-3 rounded-lg bg-green-700 text-white placeholder-green-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
                maxLength={20}
                autoFocus
              />
            </div>
            <button
              onClick={() => sanitizeName(name) && onCreateRoom(sanitizeName(name))}
              disabled={!sanitizeName(name)}
              className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 text-black font-bold py-3 rounded-xl transition-all duration-150"
            >
              作成する
            </button>
            <button
              onClick={() => handleModeChange('menu')}
              className="w-full text-green-400 hover:text-white text-sm transition py-1"
            >
              ← 戻る
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="space-y-4">
            <h2 className="text-white text-xl font-bold">ルームに参加</h2>
            <div>
              <label className="text-green-300 text-sm block mb-1">プレイヤー名</label>
              <input
                type="text"
                placeholder="名前を入力"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-green-700 text-white placeholder-green-500 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                maxLength={20}
                autoFocus
              />
            </div>
            <div>
              <label className="text-green-300 text-sm block mb-1">ルームID</label>
              <input
                type="text"
                placeholder="例: AB12CD"
                value={roomId}
                onChange={e => setRoomId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && sanitizeName(name) && roomId.trim() && onJoinRoom(sanitizeName(name), roomId.trim())}
                className="w-full px-4 py-3 rounded-lg bg-green-700 text-white placeholder-green-500 focus:outline-none focus:ring-2 focus:ring-blue-400 transition font-mono tracking-widest text-center text-lg"
                maxLength={6}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                inputMode="text"
                name="roomId"
              />
            </div>
            <button
              onClick={() => sanitizeName(name) && roomId.trim() && onJoinRoom(sanitizeName(name), roomId.trim())}
              disabled={!sanitizeName(name) || roomId.trim().length < 4}
              className="w-full bg-blue-500 hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 text-white font-bold py-3 rounded-xl transition-all duration-150"
            >
              参加する
            </button>
            <button
              onClick={() => handleModeChange('menu')}
              className="w-full text-green-400 hover:text-white text-sm transition py-1"
            >
              ← 戻る
            </button>
          </div>
        )}

        {mode === 'matchmaking' && (
          <div className="space-y-4">
            <h2 className="text-white text-xl font-bold">ランダムマッチ</h2>

            {/* 累計ポイント表示 */}
            {myStats ? (
              <div className="bg-green-700/50 rounded-xl px-4 py-2.5">
                <p className="text-green-400 text-xs mb-0.5">あなたの累計ポイント</p>
                <p className="text-yellow-300 font-bold text-lg">{myStats.totalPoints >= 0 ? '+' : ''}{myStats.totalPoints}pt <span className="text-green-400 text-sm font-normal">{myStats.gamesPlayed}ゲーム</span></p>
              </div>
            ) : (
              <div className="bg-green-700/30 rounded-xl px-4 py-2.5">
                <p className="text-green-500 text-sm">初回プレイ — ポイントは累計されます</p>
              </div>
            )}

            <div>
              <label className="text-green-300 text-sm block mb-1">プレイヤー名</label>
              <input
                type="text"
                placeholder="名前を入力"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sanitizeName(name) && onJoinMatchmaking(sanitizeName(name))}
                className="w-full px-4 py-3 rounded-lg bg-green-700 text-white placeholder-green-500 focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
                maxLength={20}
                autoFocus
              />
            </div>
            <p className="text-green-500 text-xs">4人集まったら自動でゲームが始まります</p>
            <button
              onClick={() => sanitizeName(name) && onJoinMatchmaking(sanitizeName(name))}
              disabled={!sanitizeName(name)}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 text-white font-bold py-3 rounded-xl transition-all duration-150"
            >
              ランダムマッチを始める
            </button>
            <button
              onClick={onOpenLeaderboard}
              className="w-full bg-yellow-600/80 hover:bg-yellow-500 active:scale-95 text-white font-bold py-2.5 rounded-xl transition-all duration-150 text-sm"
            >
              🏆 ランキングを見る
            </button>
            <button
              onClick={() => handleModeChange('menu')}
              className="w-full text-green-400 hover:text-white text-sm transition py-1"
            >
              ← 戻る
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

      </div>

      {/* フッター: 法的情報リンク */}
      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-4 text-[11px] text-green-500">
        <button onClick={() => setLegalTab('privacy')} className="hover:text-green-300 underline-offset-2 hover:underline transition">
          プライバシー
        </button>
        <span className="text-green-700">·</span>
        <button onClick={() => setLegalTab('terms')} className="hover:text-green-300 underline-offset-2 hover:underline transition">
          利用規約
        </button>
      </div>

      {/* ルール確認モーダル */}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {/* 法的情報モーダル */}
      {legalTab && <LegalModal initialTab={legalTab} onClose={() => setLegalTab(null)} />}
    </div>
  );
}
