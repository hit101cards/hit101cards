const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || __dirname;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = process.env.DB_PATH || path.join(DATA_DIR, 'playerStats.sqlite');
const LEGACY_JSON = path.join(__dirname, 'playerStats.json');

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS player_stats (
    uuid TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    total_points INTEGER NOT NULL DEFAULT 0,
    games_played INTEGER NOT NULL DEFAULT 0,
    last_seen TEXT,
    last_bonus_date TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_total_points ON player_stats(total_points DESC);
  CREATE INDEX IF NOT EXISTS idx_last_seen ON player_stats(last_seen);

  CREATE TABLE IF NOT EXISTS monthly_stats (
    uuid TEXT NOT NULL,
    month TEXT NOT NULL,
    name TEXT NOT NULL,
    total_points INTEGER NOT NULL DEFAULT 0,
    games_played INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (uuid, month)
  );
  CREATE INDEX IF NOT EXISTS idx_monthly_rank ON monthly_stats(month, total_points DESC);

  CREATE TABLE IF NOT EXISTS banned_uuids (
    uuid TEXT PRIMARY KEY,
    reason TEXT,
    banned_at TEXT NOT NULL,
    last_name TEXT
  );

  CREATE TABLE IF NOT EXISTS card_usage (
    rank TEXT PRIMARY KEY,
    plays INTEGER NOT NULL DEFAULT 0,
    hit_101 INTEGER NOT NULL DEFAULT 0,
    burst INTEGER NOT NULL DEFAULT 0,
    joker_100 INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS hourly_activity (
    hour TEXT PRIMARY KEY,
    game_starts INTEGER NOT NULL DEFAULT 0,
    card_plays INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS player_type_stats (
    type TEXT PRIMARY KEY,
    wins INTEGER NOT NULL DEFAULT 0,
    bursts INTEGER NOT NULL DEFAULT 0,
    card_plays INTEGER NOT NULL DEFAULT 0
  );
`);

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function todayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 既存DBに last_bonus_date カラムが無ければ追加 (マイグレーション)
try {
  const cols = db.prepare("PRAGMA table_info(player_stats)").all();
  if (!cols.some(c => c.name === 'last_bonus_date')) {
    db.exec(`ALTER TABLE player_stats ADD COLUMN last_bonus_date TEXT`);
  }
} catch (err) {
  console.error('[stats] migration last_bonus_date failed:', err.message);
}

// 当日のデイリーボーナスをまだ受け取っていなければ true を返し、受領済として記録する
function claimDailyBonusIfEligible(uuid) {
  const today = todayDateString();
  const row = db.prepare('SELECT last_bonus_date FROM player_stats WHERE uuid = ?').get(uuid);
  if (!row) return false; // プレイヤー未登録
  if (row.last_bonus_date === today) return false;
  db.prepare('UPDATE player_stats SET last_bonus_date = ? WHERE uuid = ?').run(today, uuid);
  return true;
}

// 初回のみ playerStats.json から移行
(function migrateLegacy() {
  try {
    const row = db.prepare('SELECT COUNT(*) AS c FROM player_stats').get();
    if (row.c > 0) return;
    if (!fs.existsSync(LEGACY_JSON)) return;
    const data = JSON.parse(fs.readFileSync(LEGACY_JSON, 'utf-8'));
    const insert = db.prepare(`INSERT OR REPLACE INTO player_stats
      (uuid, name, total_points, games_played, last_seen) VALUES (?, ?, ?, ?, ?)`);
    const tx = db.transaction((entries) => {
      for (const [uuid, s] of entries) {
        insert.run(uuid, s.name || 'Player', s.totalPoints || 0, s.gamesPlayed || 0, s.lastSeen || null);
      }
    });
    tx(Object.entries(data));
    fs.renameSync(LEGACY_JSON, LEGACY_JSON + '.migrated');
    console.log(`[stats] playerStats.json → SQLite 移行完了 (${Object.keys(data).length}件)`);
  } catch (err) {
    console.error('[stats] 移行エラー:', err);
  }
})();

const selectByUUID = db.prepare('SELECT uuid, name, total_points AS totalPoints, games_played AS gamesPlayed, last_seen AS lastSeen FROM player_stats WHERE uuid = ?');
const upsertPoints = db.prepare(`
  INSERT INTO player_stats (uuid, name, total_points, games_played, last_seen)
    VALUES (@uuid, @name, @delta, 0, @lastSeen)
  ON CONFLICT(uuid) DO UPDATE SET
    name = @name,
    total_points = total_points + @delta,
    last_seen = @lastSeen
`);
const upsertGames = db.prepare(`
  INSERT INTO player_stats (uuid, name, total_points, games_played, last_seen)
    VALUES (@uuid, @name, 0, 1, @lastSeen)
  ON CONFLICT(uuid) DO UPDATE SET
    name = @name,
    games_played = games_played + 1,
    last_seen = @lastSeen
`);

const upsertMonthlyPoints = db.prepare(`
  INSERT INTO monthly_stats (uuid, month, name, total_points, games_played)
    VALUES (@uuid, @month, @name, @delta, 0)
  ON CONFLICT(uuid, month) DO UPDATE SET
    name = @name,
    total_points = total_points + @delta
`);
const upsertMonthlyGames = db.prepare(`
  INSERT INTO monthly_stats (uuid, month, name, total_points, games_played)
    VALUES (@uuid, @month, @name, 0, 1)
  ON CONFLICT(uuid, month) DO UPDATE SET
    name = @name,
    games_played = games_played + 1
`);
const selectMonthlyByUUID = db.prepare(`
  SELECT uuid, month, name, total_points AS totalPoints, games_played AS gamesPlayed
  FROM monthly_stats WHERE uuid = ? AND month = ?
`);

function getStats(uuid) {
  if (!uuid) return null;
  const row = selectByUUID.get(uuid);
  return row || null;
}

function updateTotalPoints(uuid, name, pointsDelta) {
  if (!uuid) return null;
  const lastSeen = new Date().toISOString();
  const month = currentMonth();
  upsertPoints.run({ uuid, name, delta: pointsDelta, lastSeen });
  upsertMonthlyPoints.run({ uuid, month, name, delta: pointsDelta });
  return selectByUUID.get(uuid);
}

function incrementGamesPlayed(uuid, name) {
  if (!uuid) return;
  const lastSeen = new Date().toISOString();
  const month = currentMonth();
  upsertGames.run({ uuid, name, lastSeen });
  upsertMonthlyGames.run({ uuid, month, name });
}

// ページング & フィルタ対応
// opts: { limit, offset, minGames, sinceDays, myUUID, sort, period, month }
// period: 'all' (default) or 'month'
function getLeaderboard(opts = {}) {
  // 旧API互換: 数値が渡されたら limit として解釈
  if (typeof opts === 'number') opts = { limit: opts };
  const limit = Math.min(Math.max(parseInt(opts.limit, 10) || 20, 1), 100);
  const offset = Math.max(parseInt(opts.offset, 10) || 0, 0);
  const minGames = Math.max(parseInt(opts.minGames, 10) || 0, 0);
  const sinceDays = parseInt(opts.sinceDays, 10) || 0;
  const myUUID = opts.myUUID || null;
  const sort = opts.sort === 'games' ? 'games_played DESC, total_points DESC'
              : 'total_points DESC, games_played DESC';
  const period = opts.period === 'month' ? 'month' : 'all';
  const month = (period === 'month') ? (opts.month || currentMonth()) : null;

  if (period === 'month') {
    const where = ['month = ?', 'games_played >= ?'];
    const params = [month, minGames];
    const whereSQL = 'WHERE ' + where.join(' AND ');

    const countRow = db.prepare(`SELECT COUNT(*) AS c FROM monthly_stats ${whereSQL}`).get(...params);
    const total = countRow.c;

    const entries = db.prepare(`
      SELECT uuid, name, total_points AS totalPoints, games_played AS gamesPlayed
      FROM monthly_stats ${whereSQL}
      ORDER BY ${sort}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    let myEntry = null;
    if (myUUID) {
      const me = selectMonthlyByUUID.get(myUUID, month);
      if (me && me.gamesPlayed >= minGames) {
        const rankRow = db.prepare(`
          SELECT COUNT(*) + 1 AS rank FROM monthly_stats
          ${whereSQL} AND (total_points > ? OR (total_points = ? AND games_played > ?))
        `).get(...params, me.totalPoints, me.totalPoints, me.gamesPlayed);
        const rank = rankRow.rank;
        const onPage = entries.some(e => e.uuid === myUUID);
        if (!onPage) {
          myEntry = { uuid: myUUID, name: me.name, totalPoints: me.totalPoints, gamesPlayed: me.gamesPlayed, rank };
        }
      }
    }
    return { entries, top: entries, total, limit, offset, myEntry, period, month };
  }

  // period === 'all'
  const where = ['games_played >= ?'];
  const params = [minGames];
  if (sinceDays > 0) {
    const cutoff = new Date(Date.now() - sinceDays * 86400_000).toISOString();
    where.push('last_seen >= ?');
    params.push(cutoff);
  }
  const whereSQL = 'WHERE ' + where.join(' AND ');

  const countRow = db.prepare(`SELECT COUNT(*) AS c FROM player_stats ${whereSQL}`).get(...params);
  const total = countRow.c;

  const entries = db.prepare(`
    SELECT uuid, name, total_points AS totalPoints, games_played AS gamesPlayed
    FROM player_stats ${whereSQL}
    ORDER BY ${sort}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  let myEntry = null;
  if (myUUID) {
    const me = selectByUUID.get(myUUID);
    if (me && me.gamesPlayed >= minGames) {
      const rankRow = db.prepare(`
        SELECT COUNT(*) + 1 AS rank FROM player_stats
        ${whereSQL} AND (total_points > ? OR (total_points = ? AND games_played > ?))
      `).get(...params, me.totalPoints, me.totalPoints, me.gamesPlayed);
      const rank = rankRow.rank;
      const onPage = entries.some(e => e.uuid === myUUID);
      if (!onPage) {
        myEntry = { uuid: myUUID, name: me.name, totalPoints: me.totalPoints, gamesPlayed: me.gamesPlayed, rank };
      }
    }
  }

  return { entries, top: entries, total, limit, offset, myEntry, period: 'all' };
}

// 管理者用: サマリー指標 (総ゲーム数、アクティブプレイヤー数)
function getSummaryStats() {
  const totals = db.prepare(`
    SELECT
      COUNT(*) AS totalPlayers,
      COALESCE(SUM(games_played), 0) AS totalPlayerGames,
      COALESCE(SUM(total_points), 0) AS totalPointsSum
    FROM player_stats
  `).get();
  const cutoff1d = new Date(Date.now() - 86400_000).toISOString();
  const cutoff7d = new Date(Date.now() - 7 * 86400_000).toISOString();
  const active1d = db.prepare('SELECT COUNT(*) AS c FROM player_stats WHERE last_seen >= ?').get(cutoff1d).c;
  const active7d = db.prepare('SELECT COUNT(*) AS c FROM player_stats WHERE last_seen >= ?').get(cutoff7d).c;
  return {
    totalPlayers: totals.totalPlayers,
    totalPlayerGames: totals.totalPlayerGames,
    totalPointsSum: totals.totalPointsSum,
    active1d,
    active7d,
  };
}

// 管理者用: 全プレイヤーの統計を返す (フィルタなし、降順)
function getAllStats() {
  return db.prepare(`
    SELECT uuid, name, total_points AS totalPoints, games_played AS gamesPlayed, last_seen AS lastSeen
    FROM player_stats
    ORDER BY total_points DESC, games_played DESC
  `).all();
}

// 管理者用: 全プレイヤーのポイントと試合数をリセット
// mode: 'all' (両テーブル削除) | 'monthly' (monthly_stats のみ)
function resetAllStats(mode = 'all') {
  const tx = db.transaction(() => {
    let totalDeleted = 0;
    let monthlyDeleted = 0;
    if (mode === 'all') {
      totalDeleted = db.prepare('DELETE FROM player_stats').run().changes;
    }
    monthlyDeleted = db.prepare('DELETE FROM monthly_stats').run().changes;
    return { totalDeleted, monthlyDeleted };
  });
  return tx();
}

// 管理者用: 特定プレイヤーの統計のみリセット
function resetPlayerStats(uuid) {
  if (!uuid) return { totalDeleted: 0, monthlyDeleted: 0 };
  const tx = db.transaction(() => {
    const totalDeleted = db.prepare('DELETE FROM player_stats WHERE uuid = ?').run(uuid).changes;
    const monthlyDeleted = db.prepare('DELETE FROM monthly_stats WHERE uuid = ?').run(uuid).changes;
    return { totalDeleted, monthlyDeleted };
  });
  return tx();
}

// 管理者用: BAN 追加・削除・確認
function banUUID(uuid, reason, lastName) {
  if (!uuid) return false;
  db.prepare(`INSERT OR REPLACE INTO banned_uuids (uuid, reason, banned_at, last_name) VALUES (?, ?, ?, ?)`)
    .run(uuid, reason || null, new Date().toISOString(), lastName || null);
  return true;
}
function unbanUUID(uuid) {
  if (!uuid) return 0;
  return db.prepare('DELETE FROM banned_uuids WHERE uuid = ?').run(uuid).changes;
}
function isBanned(uuid) {
  if (!uuid) return false;
  return !!db.prepare('SELECT uuid FROM banned_uuids WHERE uuid = ?').get(uuid);
}
function getBannedList() {
  return db.prepare('SELECT uuid, reason, banned_at AS bannedAt, last_name AS lastName FROM banned_uuids ORDER BY banned_at DESC').all();
}

// ─── カード使用統計 ─────────────────────────────────────────
const upsertCardPlay = db.prepare(`
  INSERT INTO card_usage (rank, plays, hit_101, burst, joker_100)
    VALUES (@rank, 1, @hit101, @burst, @joker100)
  ON CONFLICT(rank) DO UPDATE SET
    plays = plays + 1,
    hit_101 = hit_101 + @hit101,
    burst = burst + @burst,
    joker_100 = joker_100 + @joker100
`);
const upsertHourlyPlay = db.prepare(`
  INSERT INTO hourly_activity (hour, card_plays, game_starts) VALUES (?, 1, 0)
  ON CONFLICT(hour) DO UPDATE SET card_plays = card_plays + 1
`);
const upsertHourlyStart = db.prepare(`
  INSERT INTO hourly_activity (hour, card_plays, game_starts) VALUES (?, 0, 1)
  ON CONFLICT(hour) DO UPDATE SET game_starts = game_starts + 1
`);
const upsertTypeStats = db.prepare(`
  INSERT INTO player_type_stats (type, wins, bursts, card_plays)
    VALUES (@type, @wins, @bursts, 1)
  ON CONFLICT(type) DO UPDATE SET
    wins = wins + @wins,
    bursts = bursts + @bursts,
    card_plays = card_plays + 1
`);

function currentHourUTC() {
  const d = new Date();
  return d.toISOString().slice(0, 13); // 'YYYY-MM-DDTHH'
}

// scenario: '101' | 'joker101' | '102' | null (通常プレイ)
function recordCardPlay(rank, scenario, isBot) {
  if (!rank) return;
  const hit101 = scenario === '101' ? 1 : 0;
  const burst = scenario === '102' ? 1 : 0;
  const joker100 = scenario === 'joker101' ? 1 : 0;
  const wins = (scenario === '101' || scenario === 'joker101') ? 1 : 0;
  const type = isBot ? 'bot' : 'human';
  const tx = db.transaction(() => {
    upsertCardPlay.run({ rank, hit101, burst, joker100 });
    upsertHourlyPlay.run(currentHourUTC());
    upsertTypeStats.run({ type, wins, bursts: burst });
  });
  tx();
}

function recordGameStart() {
  upsertHourlyStart.run(currentHourUTC());
}

function getCardUsageStats() {
  return db.prepare(`
    SELECT rank, plays, hit_101 AS hit101, burst, joker_100 AS joker100
    FROM card_usage
    ORDER BY plays DESC
  `).all();
}

// 過去 N 時間 (default 24) の 1時間バケットを返す (欠損は0埋め、古い→新しい順)
function getHourlyActivity(hours = 24) {
  const now = new Date();
  now.setUTCMinutes(0, 0, 0);
  const buckets = [];
  for (let i = hours - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 3600_000);
    const hour = d.toISOString().slice(0, 13);
    const row = db.prepare('SELECT game_starts AS gameStarts, card_plays AS cardPlays FROM hourly_activity WHERE hour = ?').get(hour);
    buckets.push({ hour, gameStarts: row ? row.gameStarts : 0, cardPlays: row ? row.cardPlays : 0 });
  }
  return buckets;
}

function getTypeStats() {
  const rows = db.prepare('SELECT type, wins, bursts, card_plays AS cardPlays FROM player_type_stats').all();
  const byType = { bot: { wins: 0, bursts: 0, cardPlays: 0 }, human: { wins: 0, bursts: 0, cardPlays: 0 } };
  for (const r of rows) {
    if (byType[r.type]) byType[r.type] = { wins: r.wins, bursts: r.bursts, cardPlays: r.cardPlays };
  }
  return byType;
}

module.exports = {
  getStats, updateTotalPoints, incrementGamesPlayed, getLeaderboard,
  getAllStats, resetAllStats, getSummaryStats, resetPlayerStats,
  banUUID, unbanUUID, isBanned, getBannedList,
  recordCardPlay, recordGameStart, getCardUsageStats, getHourlyActivity, getTypeStats,
  claimDailyBonusIfEligible,
};
