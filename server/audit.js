const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || __dirname;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const LOG_FILE = process.env.AUDIT_LOG_PATH || path.join(DATA_DIR, 'audit.log');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB でローテート

function rotateIfNeeded() {
  try {
    const stat = fs.existsSync(LOG_FILE) ? fs.statSync(LOG_FILE) : null;
    if (stat && stat.size > MAX_LOG_SIZE) {
      // タイムスタンプ付きで前ファイルが上書きされないようにする
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const dest = LOG_FILE + '.' + ts;
      try {
        fs.renameSync(LOG_FILE, dest);
      } catch {
        // リネーム失敗時はフォールバックで.1に
        fs.renameSync(LOG_FILE, LOG_FILE + '.1');
      }
    }
  } catch {}
}

function logAudit(type, details) {
  rotateIfNeeded();
  const entry = { ts: new Date().toISOString(), type, ...details };
  try {
    const line = JSON.stringify(entry, (_, v) => typeof v === 'bigint' ? v.toString() : v);
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (err) {
    console.error('[audit] 書き込みエラー:', err);
  }
  console.warn(`[audit] ${type}`, details);
}

// バースト操作検知: 短時間に多数のアクションがあるか
// socketId -> { window: [timestamps], lastWarn }
const actionHistory = new Map();
const BURST_WINDOW_MS = 2000;
const BURST_THRESHOLD = 15; // 2秒に15アクション超は異常

function recordAction(socketId) {
  const now = Date.now();
  let h = actionHistory.get(socketId);
  if (!h) { h = { window: [], lastWarn: 0 }; actionHistory.set(socketId, h); }
  h.window.push(now);
  while (h.window.length && now - h.window[0] > BURST_WINDOW_MS) h.window.shift();
  return h.window.length;
}

function isSuspiciousBurst(socketId) {
  const h = actionHistory.get(socketId);
  if (!h) return false;
  return h.window.length > BURST_THRESHOLD;
}

function clearAction(socketId) {
  actionHistory.delete(socketId);
}

module.exports = { logAudit, recordAction, isSuspiciousBurst, clearAction };
