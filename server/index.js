const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { createGame, startNewRound, processPlayCard, drawFromDeck, processDrawAndPlay } = require('./gameLogic');
const { getStats, updateTotalPoints, incrementGamesPlayed, getLeaderboard } = require('./playerStats');
const { decideBotMove, decideDrawnCardChoice } = require('./botAi');
const { logAudit, isSuspiciousBurst, recordAction, clearAction } = require('./audit');

const app = express();
const httpServer = createServer(app);
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : [/^http:\/\/localhost:\d+$/, /^http:\/\/192\.168\.\d+\.\d+:\d+$/, /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/];
const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), rooms: rooms.size, queue: matchQueue.length });
});

const rooms = new Map();
const voteTimers = new Map(); // roomId → 投票タイムアウトタイマー
const botTimers = new Map(); // roomId → Bot ターン遅延タイマー
const uuidSockets = new Map(); // uuid → Set<socketId> (多重接続検知)
const matchQueue = []; // マッチメイキング待機キュー
const matchReady = new Set(); // 準備完了のソケットID
let matchCountdownTimer = null;
let matchCountdownStartTime = null;
let matchCountdownSeconds = null;

// キュー人数に応じたカウントダウン秒数 (人数が少ないほど長く待って4人目を募る)
function getCountdownSecondsForQueue(size) {
  if (size >= MATCH_SIZE) return 5;   // 満員(4人): 即開始感覚
  if (size === 3) return 10;
  return 15;                           // 2人: 最長、追加参加の余地を残す
}
// 切断タイマー管理: `${roomId}:${playerName}` -> timer
const disconnectTimers = new Map();

const MATCH_SIZE = 4;

// ─── 名前バリデーション ────────────────────────────────────────
function sanitizeName(name) {
  if (typeof name !== 'string') return '';
  return name.replace(/[\x00-\x1F\x7F]/g, '').trim(); // 制御文字除去・前後空白削除
}

function validateName(name) {
  const clean = sanitizeName(name);
  if (!clean) return { ok: false, error: '名前を入力してください' };
  if (clean.length > 20) return { ok: false, error: '名前は20文字以内にしてください' };
  return { ok: true, name: clean };
}

// ─── UUID バリデーション ──────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(uuid) {
  return typeof uuid === 'string' && UUID_RE.test(uuid);
}

// ─── レート制限: ソケットID → 最終アクション時刻 ────────────────
const socketLastAction = new Map(); // socketId -> number (timestamp)

function isRateLimited(socketId, limitMs = 300) {
  const now = Date.now();
  const last = socketLastAction.get(socketId) ?? 0;
  if (now - last < limitMs) return true;
  socketLastAction.set(socketId, now);
  return false;
}

// 迷惑行為対策: uuid -> { abortCount, bannedUntil }
const matchAbuse = new Map();

function checkMatchBan(uuid) {
  if (!uuid) return null;
  const entry = matchAbuse.get(uuid);
  if (!entry?.bannedUntil) return null;
  const remaining = Math.ceil((entry.bannedUntil - Date.now()) / 1000);
  if (remaining > 0) return remaining;
  entry.bannedUntil = null;
  return null;
}

function recordMatchAbort(uuid) {
  if (!uuid) return;
  const entry = matchAbuse.get(uuid) || { abortCount: 0, bannedUntil: null };
  entry.abortCount = (entry.abortCount || 0) + 1;
  console.log(`[matchmaking] 妨害記録: ${uuid.slice(0, 8)}... (${entry.abortCount}回目)`);
  if (entry.abortCount >= 3) {
    entry.bannedUntil = Date.now() + 60_000;
    entry.abortCount = 0;
    console.log(`[matchmaking] 迷惑行為BAN: ${uuid.slice(0, 8)}... (60秒)`);
  }
  matchAbuse.set(uuid, entry);
}

// カウントダウン中に1人抜けた後、残りで継続できるか確認して処理
function handleCountdownAfterLeave() {
  if (!matchCountdownStartTime) return; // カウントダウン中でなければ何もしない
  if (matchQueue.length >= 2 && matchReady.size >= matchQueue.length) {
    // 全員まだready → カウントダウン継続
    broadcastMatchmakingState();
  } else {
    // readyでない人がいる → カウントダウンキャンセル
    cancelMatchCountdown();
    broadcastMatchmakingState();
  }
}

const RECONNECT_TIMEOUT_MS = 60000; // 60秒以内に再接続しないと脱落
const ROOM_CLEANUP_DELAY_MS = 10 * 60 * 1000; // ゲーム終了から10分後にルーム削除
const VOTE_TIMEOUT_MS = 30 * 1000; // 最初の投票から30秒でタイムアウト

// ゲーム終了後のルーム自動削除
function scheduleRoomCleanup(roomId) {
  setTimeout(() => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      // ルームに紐づく切断タイマーをすべてクリア
      if (room) {
        for (const p of room.players) {
          const timerKey = `${roomId}:${p.name}`;
          if (disconnectTimers.has(timerKey)) {
            clearTimeout(disconnectTimers.get(timerKey));
            disconnectTimers.delete(timerKey);
          }
        }
      }
      rooms.delete(roomId);
      if (botTimers.has(roomId)) { clearTimeout(botTimers.get(roomId)); botTimers.delete(roomId); }
      if (voteTimers.has(roomId)) { clearTimeout(voteTimers.get(roomId)); voteTimers.delete(roomId); }
      console.log(`[cleanup] ルーム削除: ${roomId}`);
    }
  }, ROOM_CLEANUP_DELAY_MS);
}

function genRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function publicState(room, viewerId) {
  return {
    roomId: room.id,
    hostId: room.hostId,
    status: room.status,
    currentTotal: room.currentTotal,
    currentPlayerIndex: room.currentPlayerIndex,
    direction: room.direction,
    lastPlayedCard: room.lastPlayedCard,
    deckCount: room.deck.length,
    points: room.points,
    roundResult: room.roundResult,
    roundCount: room.roundCount || 0,
    votes: room.votes || {},
    voteDeadline: room.voteDeadline ?? null,
    isMatchmaking: !!room.isMatchmaking,
    cumulativeStats: room.isMatchmaking ? (room.cumulativeStats || {}) : null,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      handCount: p.hand.length,
      hand: p.id === viewerId ? p.hand : null,
      lost: p.lost,
      disconnected: p.disconnected,
      isBot: !!p.isBot
    }))
  };
}

function broadcastToRoom(room) {
  room.players.forEach(p => {
    if (!p.disconnected && !p.isBot) {
      io.to(p.id).emit('game-update', publicState(room, p.id));
    }
  });
  scheduleBotTurnIfNeeded(room);
  scheduleBotVotesIfNeeded(room);
}

// ─── Bot ────────────────────────────────────────────────────────
function scheduleBotTurnIfNeeded(room) {
  if (room.status !== 'playing') return;
  const current = room.players[room.currentPlayerIndex];
  if (!current?.isBot || current.lost) return;
  if (botTimers.has(room.id)) return;
  const timer = setTimeout(() => {
    botTimers.delete(room.id);
    doBotTurn(room.id);
  }, 1500);
  botTimers.set(room.id, timer);
}

function scheduleBotVotesIfNeeded(room) {
  if (room.status !== 'roundEnd') return;
  const pending = room.players.filter(p => p.isBot && !p.lost && room.votes[p.name] !== 'continue');
  if (pending.length === 0) return;
  setTimeout(() => {
    if (room.status !== 'roundEnd') return;
    pending.forEach(p => { room.votes[p.name] = 'continue'; });
    const activePlayers = room.players.filter(p => !p.disconnected && !p.lost);
    const allVoted = activePlayers.every(p => room.votes[p.name] !== null);
    if (allVoted) { resolveVotes(room); } else { broadcastToRoom(room); }
  }, 800);
}

function doBotTurn(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.status !== 'playing') return;
  const player = room.players[room.currentPlayerIndex];
  if (!player?.isBot || player.lost) return;

  try {
    if (room.pendingDrawnCard) {
      const choice = decideDrawnCardChoice(room.pendingDrawnCard, room.currentTotal);
      processDrawAndPlay(room, player.id, choice);
    } else {
      const activePlayers = room.players.filter(p => !p.lost);
      const move = decideBotMove(player.hand, room.currentTotal, activePlayers.length);
      if (move.action === 'play') {
        processPlayCard(room, player.id, move.cardId, move.choice);
      } else {
        const draw = drawFromDeck(room, player.id);
        if (draw.success) {
          if (!draw.needsChoice) {
            processDrawAndPlay(room, player.id, null);
          } else {
            const choice = decideDrawnCardChoice(draw.card, room.currentTotal);
            processDrawAndPlay(room, player.id, choice);
          }
        }
      }
    }
    applyRoundEndStats(room);
    broadcastToRoom(room);
  } catch (err) {
    console.error(`[bot] エラー(${roomId}):`, err);
  }
}

function genBotName(room) {
  const used = new Set(room.players.map(p => p.name));
  for (let i = 1; i <= 99; i++) {
    const name = `Bot ${i}`;
    if (!used.has(name)) return name;
  }
  return `Bot ${Math.floor(Math.random() * 1000)}`;
}

function broadcastMatchmakingState() {
  const players = matchQueue.map(p => ({
    name: p.name,
    stats: p.uuid ? getStats(p.uuid) : null,
  }));
  matchQueue.forEach(p => {
    io.to(p.id).emit('matchmaking-update', {
      count: matchQueue.length,
      readyCount: matchReady.size,
      countdownStartedAt: matchCountdownStartTime,
      countdownSeconds: matchCountdownSeconds,
      players,
    });
  });
}

function cancelMatchCountdown() {
  if (matchCountdownTimer) {
    clearTimeout(matchCountdownTimer);
    matchCountdownTimer = null;
  }
  matchCountdownStartTime = null; // タイマーの有無に関わらず常にリセット
  matchCountdownSeconds = null;
}

function startMatchCountdown() {
  cancelMatchCountdown(); // 既存タイマーを必ずリセットしてから新規開始
  matchCountdownStartTime = Date.now();
  matchCountdownSeconds = getCountdownSecondsForQueue(matchQueue.length);
  broadcastMatchmakingState();
  matchCountdownTimer = setTimeout(() => {
    matchCountdownTimer = null;
    matchCountdownStartTime = null;
    matchCountdownSeconds = null;
    if (matchQueue.length >= 2 && matchReady.size >= matchQueue.length) {
      const matched = matchQueue.splice(0, matchQueue.length);
      matchReady.clear();
      const roomId = genRoomId();
      const gameState = createGame(matched.map(p => ({ id: p.id, name: p.name })));
      const uuidMap = {};
      const cumulativeStats = {};
      matched.forEach(p => {
        uuidMap[p.name] = p.uuid;
        const s = p.uuid ? getStats(p.uuid) : null;
        cumulativeStats[p.name] = s ? { totalPoints: s.totalPoints, gamesPlayed: s.gamesPlayed } : { totalPoints: 0, gamesPlayed: 0 };
      });
      const room = {
        id: roomId, hostId: matched[0].id, status: 'playing',
        ...gameState, votes: {}, roundCount: 1,
        isMatchmaking: true, uuidMap, cumulativeStats, voteDeadline: null,
      };
      rooms.set(roomId, room);
      matched.forEach(p => {
        const sock = io.sockets.sockets.get(p.id);
        if (!sock) return;
        sock.join(roomId);
        sock.data.roomId = roomId;
        sock.data.playerName = p.name;
        sock.data.inMatchmaking = false;
        io.to(p.id).emit('matchmaking-matched', { roomId, state: publicState(room, p.id) });
      });
      console.log(`マッチング成立 (手動開始): ${roomId}`);
    }
  }, matchCountdownSeconds * 1000);
}

// 重複なし gamesPlayed カウント（退出・自動終了・投票終了の全パスで使用）
function recordGamesPlayedOnce(room, playerName) {
  if (!room.isMatchmaking) return;
  if (!room._recordedPlayers) room._recordedPlayers = new Set();
  if (room._recordedPlayers.has(playerName)) return;
  room._recordedPlayers.add(playerName);
  const uuid = room.uuidMap?.[playerName];
  if (uuid) incrementGamesPlayed(uuid, playerName);
}

// ゲーム終了時に全プレイヤーのgamesPlayedを記録
function finalizeGamePlayed(room) {
  room.players.forEach(p => recordGamesPlayedOnce(room, p.name));
}

// 投票を解決する（全員投票 or タイムアウト時に呼ばれる）
function resolveVotes(room) {
  // タイマーをクリア
  if (voteTimers.has(room.id)) {
    clearTimeout(voteTimers.get(room.id));
    voteTimers.delete(room.id);
  }
  room.voteDeadline = null;

  const activePlayers = room.players.filter(p => !p.disconnected && !p.lost);
  const continuePlayers = activePlayers.filter(p => room.votes[p.name] === 'continue');
  const leavePlayers   = activePlayers.filter(p => room.votes[p.name] !== 'continue'); // quit or 未投票

  if (leavePlayers.length === 0) {
    // 全員続ける → 次のラウンド開始
    startNewRound(room);
    broadcastToRoom(room);
    return;
  }

  // ルームを終了状態にする（UUID重複チェックでブロックされないようにする）
  room.status = 'ended';
  finalizeGamePlayed(room);

  // やめる/未投票のプレイヤーにロビー戻りを通知してルームから除外
  for (const p of leavePlayers) {
    const sock = io.sockets.sockets.get(p.id);
    if (sock) {
      sock.emit('return-to-lobby');
      sock.leave(room.id);
    }
  }

  // 続けるプレイヤーはマッチメイキングキューへ
  for (const p of continuePlayers) {
    const sock = io.sockets.sockets.get(p.id);
    if (sock) {
      sock.emit('return-to-matchmaking', { playerName: p.name });
      sock.leave(room.id);
    }
  }
  console.log(`[vote] ${continuePlayers.length}人をマッチメイキングへ, ${leavePlayers.length}人はロビーへ: ${room.id}`);
  scheduleRoomCleanup(room.id);
}

// プレイヤー脱落後に残り人数・投票状況を確認して自動終了/ラウンド進行
function checkAfterPlayerLost(room) {
  const activePlayers = room.players.filter(p => !p.disconnected && !p.lost);
  const activeHumans = activePlayers.filter(p => !p.isBot);

  // 人間プレイヤーがいなくなったら即終了（Botだけ残っても意味がない）
  if (activeHumans.length === 0 && (room.status === 'playing' || room.status === 'roundEnd')) {
    if (voteTimers.has(room.id)) {
      clearTimeout(voteTimers.get(room.id));
      voteTimers.delete(room.id);
    }
    if (botTimers.has(room.id)) {
      clearTimeout(botTimers.get(room.id));
      botTimers.delete(room.id);
    }
    room.status = 'ended';
    finalizeGamePlayed(room);
    scheduleRoomCleanup(room.id);
    console.log(`[game] 人間プレイヤー不在のため終了: ${room.id}`);
    return;
  }

  if (activePlayers.length <= 1) {
    if (room.status === 'playing' || room.status === 'roundEnd') {
      // 投票タイマーもクリア
      if (voteTimers.has(room.id)) {
        clearTimeout(voteTimers.get(room.id));
        voteTimers.delete(room.id);
      }
      room.status = 'ended';
      finalizeGamePlayed(room);
      scheduleRoomCleanup(room.id);
      console.log(`[game] 残り1人以下のため自動終了: ${room.id}`);
    }
    return;
  }

  // roundEnd中は全員投票済みか確認
  if (room.status === 'roundEnd') {
    const allVoted = activePlayers.every(p => room.votes[p.name] !== null);
    if (allVoted) {
      resolveVotes(room);
    }
  }
}

// 退出・タイムアウトペナルティ (-2pt) を適用して脱落処理
function applyLeavePenalty(room, player) {
  const playerName = player.name;

  // -2pt ペナルティ
  room.points[playerName] = (room.points[playerName] || 0) - 2;

  // ランダムマッチは累計にも即時反映
  if (room.isMatchmaking) {
    const uuid = room.uuidMap?.[playerName];
    if (uuid) {
      const updated = updateTotalPoints(uuid, playerName, -2);
      if (updated) room.cumulativeStats[playerName] = { totalPoints: updated.totalPoints, gamesPlayed: updated.gamesPlayed };
    }
  }

  // 脱落処理
  player.lost = true;
  player.disconnected = false;
  if (player.hand) { room.discardPile.push(...player.hand); player.hand = []; }

  // 切断タイマーのクリア
  const timerKey = `${room.id}:${playerName}`;
  if (disconnectTimers.has(timerKey)) {
    clearTimeout(disconnectTimers.get(timerKey));
    disconnectTimers.delete(timerKey);
  }

  // 退出者のgamesPlayedを即時記録（自動終了時の二重カウントはrecordGamesPlayedOnceで防止）
  recordGamesPlayedOnce(room, playerName);

  advanceTurnIfNeeded(room, player);
  checkAfterPlayerLost(room);
}

// 切断プレイヤーを脱落扱いにする（ペナルティあり）
function handlePlayerTimeout(room, playerName) {
  const player = room.players.find(p => p.name === playerName);
  if (!player || !player.disconnected) return;

  console.log(`[game] タイムアウト脱落: ${playerName} (ペナルティ -2pt)`);
  applyLeavePenalty(room, player);
  broadcastToRoom(room);
}

function advanceTurnIfNeeded(room, lostPlayer) {
  if (room.status !== 'playing') return;
  if (room.players[room.currentPlayerIndex]?.name !== lostPlayer.name) return;

  const n = room.players.length;
  let next = (room.currentPlayerIndex + 1) % n;
  let tried = 0;
  while (room.players[next].lost && tried < n) {
    next = (next + 1) % n;
    tried++;
  }
  room.currentPlayerIndex = next;
}

// ラウンド終了時に累計ポイントを即時反映
function applyRoundEndStats(room) {
  if (!room.isMatchmaking || room.status !== 'roundEnd' || !room.roundResult) return;
  for (const { playerName, change } of room.roundResult.pointChanges) {
    const uuid = room.uuidMap?.[playerName];
    if (!uuid) {
      console.log(`[stats] UUID未設定のためスキップ: ${playerName}`);
      continue;
    }
    const updated = updateTotalPoints(uuid, playerName, change);
    if (updated) {
      room.cumulativeStats[playerName] = { totalPoints: updated.totalPoints, gamesPlayed: updated.gamesPlayed };
      console.log(`[stats] ${playerName}: ${change >= 0 ? '+' : ''}${change} → 累計${updated.totalPoints}pt`);
    }
  }
}

io.on('connection', (socket) => {
  console.log('接続:', socket.id);

  socket.on('create-room', ({ playerName }, cb) => {
    const v = validateName(playerName);
    if (!v.ok) return cb({ success: false, error: v.error });
    const name = v.name;
    const roomId = genRoomId();
    const room = {
      id: roomId,
      hostId: socket.id,
      status: 'waiting',
      players: [{ id: socket.id, name, hand: [], lost: false, disconnected: false }],
      deck: [], discardPile: [],
      currentTotal: 0, currentPlayerIndex: 0, direction: 1,
      previousPlayerName: null, lastPlayedCard: null, pendingDrawnCard: null,
      points: { [name]: 0 },
      roundResult: null, roundCount: 0, votes: {}, voteDeadline: null,
    };
    rooms.set(roomId, room);
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.playerName = name;
    cb({ success: true, roomId, state: publicState(room, socket.id) });
  });

  socket.on('join-room', ({ roomId, playerName }, cb) => {
    if (typeof roomId !== 'string' || !/^[A-Z0-9]{4,8}$/i.test(roomId)) return cb({ success: false, error: '無効なルームIDです' });
    roomId = roomId.toUpperCase();
    const v = validateName(playerName);
    if (!v.ok) return cb({ success: false, error: v.error });
    const name = v.name;
    const room = rooms.get(roomId);
    if (!room) return cb({ success: false, error: 'ルームが見つかりません' });
    if (room.status !== 'waiting') return cb({ success: false, error: 'ゲームはすでに開始されています' });
    if (room.players.length >= 6) return cb({ success: false, error: 'ルームが満員です（最大6人）' });
    if (room.players.find(p => p.name === name)) return cb({ success: false, error: 'その名前はすでに使われています' });

    room.players.push({ id: socket.id, name, hand: [], lost: false, disconnected: false });
    room.points[name] = 0;
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.playerName = name;
    broadcastToRoom(room);
    cb({ success: true, roomId, state: publicState(room, socket.id) });
  });

  // リロード後の再接続
  socket.on('reconnect-game', ({ roomId, playerName }, cb) => {
    const v = validateName(playerName);
    if (!v.ok) return cb({ success: false, error: v.error });
    playerName = v.name;

    const room = rooms.get(roomId);
    if (!room) return cb({ success: false, error: 'ルームが見つかりません' });

    const player = room.players.find(p => p.name === playerName);
    if (!player) return cb({ success: false, error: 'プレイヤーが見つかりません' });
    if (player.lost) return cb({ success: false, error: 'すでに脱落しています' });

    // 切断タイマーをキャンセル
    const timerKey = `${roomId}:${playerName}`;
    if (disconnectTimers.has(timerKey)) {
      clearTimeout(disconnectTimers.get(timerKey));
      disconnectTimers.delete(timerKey);
    }

    // ソケットIDを更新
    const oldId = player.id;
    player.id = socket.id;
    player.disconnected = false;
    if (room.hostId === oldId) room.hostId = socket.id;

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.playerName = playerName;

    broadcastToRoom(room);
    cb({ success: true, roomId, state: publicState(room, socket.id) });
    console.log(`再接続: ${playerName} (${roomId})`);
  });

  socket.on('join-matchmaking', ({ playerName, uuid }, cb) => {
    // 名前バリデーション
    const v = validateName(playerName);
    if (!v.ok) return cb?.({ success: false, error: v.error });
    const name = v.name;

    // すでにキューにいる場合は無視
    // すでにキューにいる場合は一度削除して再登録（return-to-matchmaking後の重複対策）
    const existingIdx = matchQueue.findIndex(p => p.id === socket.id);
    if (existingIdx !== -1) matchQueue.splice(existingIdx, 1);

    // UUID フォーマット検証
    if (uuid && !isValidUUID(uuid)) return cb?.({ success: false, error: '無効なアカウント情報です。ページを再読み込みしてください' });

    // BAN確認
    const banLeft = checkMatchBan(uuid);
    if (banLeft) return cb?.({ success: false, error: `迷惑行為のため${banLeft}秒間マッチングを利用できません` });

    // 満員(4人)でカウントダウン中は参加不可 (それ未満なら受け入れる)
    if (matchCountdownStartTime && matchQueue.length >= MATCH_SIZE) {
      return cb?.({ success: false, error: 'まもなくゲームが始まります。少し待ってから参加してください' });
    }

    // 多重接続検知: 同じUUIDが既にマッチキューまたはゲーム中の場合
    if (uuid) {
      const existingInQueue = matchQueue.find(p => p.uuid === uuid);
      if (existingInQueue) {
        logAudit('uuid-multi-queue', { uuid: uuid.slice(0, 8), socketId: socket.id, existing: existingInQueue.id });
        return cb?.({ success: false, error: '同じアカウントは同時にマッチできません' });
      }
      // 進行中のルームでまだアクティブ(非lost・非disconnected)な場合のみブロック
      let inGame = null;
      for (const room of rooms.values()) {
        if (!room.isMatchmaking || !room.uuidMap) continue;
        if (room.status !== 'playing' && room.status !== 'roundEnd') continue;
        for (const [n, u] of Object.entries(room.uuidMap)) {
          if (u !== uuid) continue;
          const player = room.players.find(p => p.name === n);
          if (player && !player.lost && !player.disconnected) {
            inGame = { roomId: room.id, name: n };
          }
          break;
        }
        if (inGame) break;
      }
      if (inGame) {
        logAudit('uuid-already-ingame', { uuid: uuid.slice(0, 8), socketId: socket.id, roomId: inGame.roomId });
        return cb?.({ success: false, error: '既に別の端末でプレイ中です' });
      }
    }
    matchQueue.push({ id: socket.id, name, uuid: uuid || null });
    console.log(`[matchmaking] 参加: ${name} (uuid: ${uuid ? uuid.slice(0, 8) + '...' : 'なし'})`);
    socket.data.inMatchmaking = true;
    socket.data.playerName = name;
    socket.data.matchUUID = uuid || null;

    // 新規参加者がいるのでカウントダウンをキャンセルして通知
    cancelMatchCountdown();
    broadcastMatchmakingState();
    cb?.({ success: true, count: matchQueue.length });

    // 4人揃ったら5秒カウントダウン後にゲーム開始
    if (matchQueue.length >= MATCH_SIZE) {
      matchQueue.forEach(p => matchReady.add(p.id));
      startMatchCountdown();
      console.log(`マッチング満員: カウントダウン開始`);
    }
  });

  socket.on('ready-matchmaking', (cb) => {
    if (!matchQueue.find(p => p.id === socket.id)) return cb?.({ success: false, error: 'マッチングに参加していません' });
    matchReady.add(socket.id);
    broadcastMatchmakingState();
    // カウントダウン中は再起動しない（スパム連打でリセットされるのを防ぐ）
    if (!matchCountdownStartTime && matchQueue.length >= 2 && matchReady.size >= matchQueue.length) {
      startMatchCountdown();
    }
    cb?.({ success: true });
  });

  socket.on('unready-matchmaking', (cb) => {
    // カウントダウン中はunready不可
    if (matchCountdownStartTime) {
      return cb?.({ success: false, error: 'カウントダウン中は準備を取り消せません' });
    }
    matchReady.delete(socket.id);
    cancelMatchCountdown();
    broadcastMatchmakingState();
    cb?.({ success: true });
  });

  socket.on('leave-matchmaking', (cb) => {
    const idx = matchQueue.findIndex(p => p.id === socket.id);
    if (idx !== -1) {
      const wasInCountdown = !!matchCountdownStartTime;
      const player = matchQueue[idx];
      matchQueue.splice(idx, 1);
      matchReady.delete(socket.id);
      socket.data.inMatchmaking = false;
      if (wasInCountdown) {
        recordMatchAbort(player.uuid);
        handleCountdownAfterLeave();
      } else {
        cancelMatchCountdown();
        broadcastMatchmakingState();
      }
    }
    cb?.({ success: true });
  });

  socket.on('leave-game', (cb) => {
    cb?.(); // 即座にack
    const roomId = socket.data?.roomId;
    const playerName = socket.data?.playerName;
    if (!roomId || !playerName) return;

    const room = rooms.get(roomId);
    if (!room) return;
    if (room.status !== 'playing' && room.status !== 'roundEnd') return;

    const player = room.players.find(p => p.name === playerName);
    if (!player || player.lost) return;

    console.log(`[game] 退出: ${playerName} (ペナルティ -2pt)`);
    applyLeavePenalty(room, player);
    broadcastToRoom(room);

    socket.data.roomId = null;
    socket.data.playerName = null;
  });

  socket.on('add-bot', ({ roomId }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ success: false, error: 'ルームが見つかりません' });
    if (room.isMatchmaking) return cb?.({ success: false, error: 'マッチング中はBotを追加できません' });
    if (room.hostId !== socket.id) return cb?.({ success: false, error: 'ホストのみBotを追加できます' });
    if (room.status !== 'waiting') return cb?.({ success: false, error: '待機中のみ追加できます' });
    if (room.players.length >= 6) return cb?.({ success: false, error: 'ルームが満員です' });
    const name = genBotName(room);
    const id = `bot:${roomId}:${Date.now()}:${Math.floor(Math.random() * 1000)}`;
    room.players.push({ id, name, hand: [], lost: false, disconnected: false, isBot: true });
    room.points[name] = 0;
    broadcastToRoom(room);
    cb?.({ success: true });
  });

  socket.on('remove-bot', ({ roomId, botName }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ success: false, error: 'ルームが見つかりません' });
    if (room.hostId !== socket.id) return cb?.({ success: false, error: 'ホストのみ操作できます' });
    if (room.status !== 'waiting') return cb?.({ success: false, error: '待機中のみ操作できます' });
    const idx = room.players.findIndex(p => p.isBot && p.name === botName);
    if (idx === -1) return cb?.({ success: false, error: 'Botが見つかりません' });
    room.players.splice(idx, 1);
    delete room.points[botName];
    broadcastToRoom(room);
    cb?.({ success: true });
  });

  socket.on('start-game', ({ roomId }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ success: false, error: 'ルームが見つかりません' });
    if (room.hostId !== socket.id) return cb?.({ success: false, error: 'ホストのみゲームを開始できます' });
    if (room.players.length < 2) return cb?.({ success: false, error: '2人以上必要です' });

    const gameState = createGame(room.players);
    Object.assign(room, gameState, { status: 'playing' });
    broadcastToRoom(room);
    cb?.({ success: true });
  });

  socket.on('vote', ({ roomId, vote }, cb) => {
    if (isRateLimited(socket.id, 200)) return cb?.({ success: false, error: '操作が早すぎます' });
    const room = rooms.get(roomId);
    if (!room || room.status !== 'roundEnd') return cb?.({ success: false, error: 'ラウンド終了中ではありません' });

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.lost) return cb?.({ success: false, error: 'プレイヤーが見つかりません' });

    room.votes[player.name] = vote; // 'continue' or 'quit'

    const activePlayers = room.players.filter(p => !p.disconnected && !p.lost);

    // 初めての投票 → 30秒カウントダウン開始
    const votedCount = activePlayers.filter(p => room.votes[p.name] !== null).length;
    if (votedCount === 1 && !voteTimers.has(room.id)) {
      const deadline = Date.now() + VOTE_TIMEOUT_MS;
      room.voteDeadline = deadline;
      const timer = setTimeout(() => {
        voteTimers.delete(room.id);
        if (room.status === 'roundEnd') resolveVotes(room);
      }, VOTE_TIMEOUT_MS);
      voteTimers.set(room.id, timer);
    }

    // 全員投票済み → ブロードキャスト後に即時解決
    const allVoted = activePlayers.every(p => room.votes[p.name] !== null);
    broadcastToRoom(room);
    if (allVoted) {
      resolveVotes(room);
    }
    cb?.({ success: true });
  });

  socket.on('play-card', ({ roomId, cardId, choice }, cb) => {
    recordAction(socket.id);
    if (isSuspiciousBurst(socket.id)) {
      logAudit('burst', { socketId: socket.id, uuid: socket.data?.matchUUID, roomId, event: 'play-card' });
    }
    if (isRateLimited(socket.id)) return cb?.({ success: false, error: '操作が早すぎます' });
    const room = rooms.get(roomId);
    if (!room || room.status !== 'playing') return cb?.({ success: false, error: 'ゲームが進行中ではありません' });
    const result = processPlayCard(room, socket.id, cardId, choice);
    if (!result.success) {
      logAudit('play-invalid', { socketId: socket.id, uuid: socket.data?.matchUUID, roomId, cardId, choice, error: result.error });
      return cb?.({ success: false, error: result.error });
    }
    applyRoundEndStats(room);
    broadcastToRoom(room);
    cb?.({ success: true });
  });

  socket.on('draw-from-deck', ({ roomId }, cb) => {
    recordAction(socket.id);
    if (isSuspiciousBurst(socket.id)) {
      logAudit('burst', { socketId: socket.id, uuid: socket.data?.matchUUID, roomId, event: 'draw-from-deck' });
    }
    if (isRateLimited(socket.id)) return cb?.({ success: false, error: '操作が早すぎます' });
    const room = rooms.get(roomId);
    if (!room || room.status !== 'playing') return cb?.({ success: false, error: 'ゲームが進行中ではありません' });
    const result = drawFromDeck(room, socket.id);
    if (!result.success) {
      logAudit('draw-invalid', { socketId: socket.id, uuid: socket.data?.matchUUID, roomId, error: result.error });
      return cb?.({ success: false, error: result.error });
    }

    if (!result.needsChoice) {
      const playResult = processDrawAndPlay(room, socket.id, null);
      if (!playResult.success) return cb?.({ success: false, error: playResult.error });
      applyRoundEndStats(room);
    }

    broadcastToRoom(room);
    cb?.({ success: true, card: result.card, needsChoice: result.needsChoice });
  });

  socket.on('play-drawn-card', ({ roomId, choice }, cb) => {
    recordAction(socket.id);
    if (isRateLimited(socket.id)) return cb?.({ success: false, error: '操作が早すぎます' });
    const room = rooms.get(roomId);
    if (!room || room.status !== 'playing') return cb?.({ success: false, error: 'ゲームが進行中ではありません' });
    const result = processDrawAndPlay(room, socket.id, choice);
    if (!result.success) {
      logAudit('play-drawn-invalid', { socketId: socket.id, uuid: socket.data?.matchUUID, roomId, choice, error: result.error });
      return cb?.({ success: false, error: result.error });
    }
    applyRoundEndStats(room);
    broadcastToRoom(room);
    cb?.({ success: true });
  });

  socket.on('get-player-stats', ({ uuid }, cb) => {
    cb?.(getStats(uuid));
  });

  socket.on('get-leaderboard', (data, cb) => {
    // 旧API: string or { uuid } → 新API: { uuid, limit, offset, minGames, sinceDays, sort }
    let opts;
    if (typeof data === 'string') opts = { myUUID: data };
    else opts = {
      myUUID: data?.uuid ?? null,
      limit: data?.limit ?? 20,
      offset: data?.offset ?? 0,
      minGames: data?.minGames ?? 0,
      sinceDays: data?.sinceDays ?? 0,
      sort: data?.sort ?? 'points',
      period: data?.period ?? 'all',
      month: data?.month ?? null,
    };
    cb?.(getLeaderboard(opts));
  });

  socket.on('disconnect', () => {
    console.log('切断:', socket.id);
    socketLastAction.delete(socket.id); // レート制限エントリのクリーンアップ
    clearAction(socket.id);

    // マッチメイキングキューから削除
    const qIdx = matchQueue.findIndex(p => p.id === socket.id);
    if (qIdx !== -1) {
      const wasInCountdown = !!matchCountdownStartTime;
      const player = matchQueue[qIdx];
      matchQueue.splice(qIdx, 1);
      matchReady.delete(socket.id);
      if (wasInCountdown) {
        recordMatchAbort(player.uuid);
        handleCountdownAfterLeave();
      } else {
        cancelMatchCountdown();
        broadcastMatchmakingState();
      }
    }

    const roomId = socket.data?.roomId;
    const playerName = socket.data?.playerName;
    if (!roomId || !playerName) return;
    const room = rooms.get(roomId);
    if (!room) return;

    if (room.status === 'waiting') {
      // 待機中は即削除
      room.players = room.players.filter(p => p.id !== socket.id);
      delete room.points[playerName];
      // 人間がいなくなったらルーム削除（Botだけで残すと誰も操作できない）
      const hasHuman = room.players.some(p => !p.isBot);
      if (!hasHuman) {
        rooms.delete(roomId);
        if (botTimers.has(roomId)) { clearTimeout(botTimers.get(roomId)); botTimers.delete(roomId); }
        return;
      }
      if (room.hostId === socket.id) {
        const nextHost = room.players.find(p => !p.isBot);
        if (nextHost) room.hostId = nextHost.id;
      }
      broadcastToRoom(room);
    } else {
      // ゲーム中は切断フラグを立てて60秒待つ
      const player = room.players.find(p => p.name === playerName);
      if (!player || player.lost) return;

      player.disconnected = true;
      console.log(`切断待機中: ${playerName} (${RECONNECT_TIMEOUT_MS / 1000}秒以内に再接続してください)`);
      broadcastToRoom(room); // disconnected フラグを他プレイヤーに通知

      // ターンが来ていた場合は次へ進める
      advanceTurnIfNeeded(room, player);
      broadcastToRoom(room);

      // タイムアウト後に脱落（既存タイマーがあれば先にクリア）
      const timerKey = `${roomId}:${playerName}`;
      if (disconnectTimers.has(timerKey)) {
        clearTimeout(disconnectTimers.get(timerKey));
      }
      const timer = setTimeout(() => {
        disconnectTimers.delete(timerKey);
        handlePlayerTimeout(room, playerName);
        console.log(`脱落: ${playerName} (タイムアウト)`);
      }, RECONNECT_TIMEOUT_MS);
      disconnectTimers.set(timerKey, timer);
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`サーバー起動: http://localhost:${PORT}`));
