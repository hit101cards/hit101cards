import { useEffect, useState, useCallback } from 'react';
import { socket } from '../socket';
import { LeaderboardResult } from '../types';
import { useLocale, t, getLocale } from '../i18n';

interface Props {
  myUUID: string;
  onClose: () => void;
}

const PAGE_SIZE = 10;

export default function LeaderboardModal({ myUUID, onClose }: Props) {
  useLocale();
  const [result, setResult] = useState<LeaderboardResult>({ top: [], entries: [], total: 0, limit: PAGE_SIZE, offset: 0, myEntry: null });
  const [page, setPage] = useState(0);
  const [minGames, setMinGames] = useState(0);
  const [sinceDays, setSinceDays] = useState(0);
  const [sort, setSort] = useState<'points' | 'games'>('points');
  const [period, setPeriod] = useState<'all' | 'month'>('all');
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const fetchPage = useCallback(() => {
    setLoading(true);
    setFetchError(false);
    const timeout = setTimeout(() => {
      setLoading(false);
      setFetchError(true);
    }, 8000);
    const run = () => socket.emit(
      'get-leaderboard',
      { uuid: myUUID, limit: PAGE_SIZE, offset: page * PAGE_SIZE, minGames, sinceDays, sort, period },
      (res: LeaderboardResult) => { clearTimeout(timeout); setResult(res); setLoading(false); setFetchError(false); }
    );
    if (socket.connected) run();
    else { socket.connect(); socket.once('connect', run); }
  }, [myUUID, page, minGames, sinceDays, sort, period]);

  useEffect(() => { fetchPage(); }, [fetchPage]);

  const total = result.total ?? (result.entries ?? result.top).length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const entries = result.entries ?? result.top;

  const sinceOptions: [number, string][] = [[0, t('lb.since.all')], [7, t('lb.since.7')], [30, t('lb.since.30')]];
  const now = new Date();
  const locale = getLocale();
  const monthLabel = locale === 'en'
    ? now.toLocaleString('en-US', { month: 'long', year: 'numeric' })
    : `${now.getFullYear()}年${now.getMonth() + 1}月`;

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-green-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-yellow-400">{t('lb.title')} {period === 'month' && <span className="text-sm text-yellow-200 font-normal">{t('lb.month', { month: monthLabel })}</span>}</h2>
          <button onClick={onClose} className="text-green-400 hover:text-white font-bold text-xl">✕</button>
        </div>

        <div className="bg-green-700/40 rounded-lg p-2 mb-3 space-y-2">
          <div className="flex gap-1 text-xs">
            <button
              onClick={() => { setPeriod('all'); setPage(0); }}
              className={`flex-1 py-1 rounded ${period === 'all' ? 'bg-yellow-500 text-black font-bold' : 'bg-green-700 text-green-300'}`}>
              {t('lb.tab.all')}
            </button>
            <button
              onClick={() => { setPeriod('month'); setPage(0); }}
              className={`flex-1 py-1 rounded ${period === 'month' ? 'bg-yellow-500 text-black font-bold' : 'bg-green-700 text-green-300'}`}>
              {t('lb.tab.month')}
            </button>
          </div>
          {period === 'all' && (
          <div className="flex gap-1 text-xs">
            {sinceOptions.map(([d, label]) => (
              <button
                key={d}
                onClick={() => { setSinceDays(d); setPage(0); }}
                className={`flex-1 py-1 rounded ${sinceDays === d ? 'bg-yellow-500 text-black font-bold' : 'bg-green-700 text-green-300'}`}>
                {label}
              </button>
            ))}
          </div>
          )}
          <div className="flex gap-1 text-xs">
            <button
              onClick={() => { setSort('points'); setPage(0); }}
              className={`flex-1 py-1 rounded ${sort === 'points' ? 'bg-yellow-500 text-black font-bold' : 'bg-green-700 text-green-300'}`}>{t('lb.sort.points')}</button>
            <button
              onClick={() => { setSort('games'); setPage(0); }}
              className={`flex-1 py-1 rounded ${sort === 'games' ? 'bg-yellow-500 text-black font-bold' : 'bg-green-700 text-green-300'}`}>{t('lb.sort.games')}</button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <label className="text-green-300">{t('lb.minGames')}</label>
            <input
              type="number" min={0} max={10000} value={minGames}
              onChange={e => { setMinGames(Math.max(0, Number(e.target.value) || 0)); setPage(0); }}
              className="w-20 px-2 py-1 rounded bg-green-700 text-white" />
          </div>
        </div>

        {fetchError ? (
          <div className="text-center py-4">
            <p className="text-red-400 text-sm mb-2">{t('lb.fetchError')}</p>
            <button onClick={fetchPage} className="bg-green-700 hover:bg-green-600 text-white text-sm font-bold px-4 py-2 rounded-lg transition">
              {t('lb.retry')}
            </button>
          </div>
        ) : loading ? (
          <p className="text-green-400 text-center text-sm py-4">{t('lb.loading')}</p>
        ) : entries.length === 0 ? (
          <p className="text-green-400 text-center text-sm py-4">{t('lb.empty')}</p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, i) => {
              const rank = page * PAGE_SIZE + i + 1;
              const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
              return (
                <div key={entry.uuid}
                  className={`flex items-center justify-between rounded-xl px-4 py-2.5 ${entry.uuid === myUUID ? 'ring-2 ring-yellow-400' : ''} ${rank === 1 ? 'bg-yellow-500/20 border border-yellow-400/50' : 'bg-green-700/50'}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg w-8 shrink-0">{medal}</span>
                    <div className="min-w-0">
                      <p className={`font-bold text-sm truncate ${rank === 1 ? 'text-yellow-300' : 'text-white'}`}>{entry.name}</p>
                      <p className="text-green-400 text-xs">{entry.gamesPlayed} {t('lb.gamesUnit')}</p>
                    </div>
                  </div>
                  <span className={`font-bold shrink-0 ${entry.totalPoints >= 0 ? 'text-green-300' : 'text-red-400'}`}>
                    {entry.totalPoints >= 0 ? '+' : ''}{entry.totalPoints}pt
                  </span>
                </div>
              );
            })}
            {result.myEntry && (
              <>
                <div className="flex items-center gap-2 py-1">
                  <div className="flex-1 border-t border-green-600" />
                  <span className="text-green-500 text-xs">{t('lb.yourRank')}</span>
                  <div className="flex-1 border-t border-green-600" />
                </div>
                <div className="flex items-center justify-between rounded-xl px-4 py-2.5 bg-green-700/50 ring-2 ring-yellow-400">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white w-8">{result.myEntry.rank}.</span>
                    <div>
                      <p className="font-bold text-sm text-white">{result.myEntry.name}</p>
                      <p className="text-green-400 text-xs">{result.myEntry.gamesPlayed} {t('lb.gamesUnit')}</p>
                    </div>
                  </div>
                  <span className={`font-bold ${result.myEntry.totalPoints >= 0 ? 'text-green-300' : 'text-red-400'}`}>
                    {result.myEntry.totalPoints >= 0 ? '+' : ''}{result.myEntry.totalPoints}pt
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 mt-4">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-30 rounded text-white text-sm">{t('lb.prev')}</button>
            <span className="text-green-300 text-xs">{t('lb.pageInfo', { page: page + 1, total: totalPages, count: total })}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-3 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-30 rounded text-white text-sm">{t('lb.next')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
