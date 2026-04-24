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
    last_seen TEXT
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
`);

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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

// 管理者用: 全プレイヤーの統計を返す (フィルタなし、降順)
function getAllStats() {
  return db.prepare(`
    SELECT uuid, name, total_points AS totalPoints, games_played AS gamesPlayed, last_seen AS lastSeen
    FROM player_stats
    ORDER BY total_points DESC, games_played DESC
  `).all();
}

module.exports = { getStats, updateTotalPoints, incrementGamesPlayed, getLeaderboard, getAllStats };
