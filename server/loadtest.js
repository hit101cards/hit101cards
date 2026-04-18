// 簡易負荷テスト: N 個のクライアントを生成して create-room/join-room/add-bot → start-game を回す
// 使い方: node loadtest.js [clients=30] [roomsPerGroup=5] [durationSec=60] [serverUrl=http://localhost:3001]
const { io } = require('socket.io-client');

const CLIENTS    = parseInt(process.argv[2], 10) || 30;
const GROUP_SIZE = parseInt(process.argv[3], 10) || 3; // 1ルームあたりの人間プレイヤー数
const DURATION   = parseInt(process.argv[4], 10) || 60;
const URL        = process.argv[5] || 'http://localhost:3001';

const stats = {
  connected: 0, disconnected: 0, roomsCreated: 0, roomsJoined: 0,
  gamesStarted: 0, errors: 0, actions: 0, gameUpdates: 0,
};

function randomName() { return 'Load' + Math.floor(Math.random() * 100000); }

function pickMove(state, myId) {
  const me = state.players.find(p => p.id === myId);
  if (!me || !me.hand || me.hand.length === 0) return { type: 'draw' };
  const card = me.hand[Math.floor(Math.random() * me.hand.length)];
  const specials = { '10': 'plus', '8': 'plus', '9': 'plus' };
  return { type: 'play', cardId: card.id, choice: specials[card.rank] || null };
}

function spawnClient(groupIdx, isHost) {
  return new Promise((resolve) => {
    const sock = io(URL, { reconnection: false });
    const name = randomName();
    let roomId = null;
    let myId = null;
    let alive = true;

    sock.on('connect', () => {
      stats.connected++;
      myId = sock.id;
      if (isHost) {
        sock.emit('create-room', { playerName: name }, (res) => {
          if (res?.success) {
            stats.roomsCreated++;
            roomId = res.roomId;
            sharedRooms[groupIdx] = roomId;
            // Bot を追加してゲームを速やかに回せるようにする
            setTimeout(() => sock.emit('add-bot', { roomId }, () => {}), 300);
            setTimeout(() => sock.emit('add-bot', { roomId }, () => {}), 500);
            setTimeout(() => sock.emit('start-game', { roomId }, () => { stats.gamesStarted++; }), 2000);
          } else { stats.errors++; }
        });
      } else {
        const waitForRoom = setInterval(() => {
          if (sharedRooms[groupIdx]) {
            clearInterval(waitForRoom);
            roomId = sharedRooms[groupIdx];
            sock.emit('join-room', { playerName: name, roomId }, (res) => {
              if (res?.success) stats.roomsJoined++; else stats.errors++;
            });
          }
        }, 100);
        setTimeout(() => clearInterval(waitForRoom), 5000);
      }
    });

    sock.on('disconnect', () => { stats.disconnected++; alive = false; });

    sock.on('game-update', (state) => {
      stats.gameUpdates++;
      if (state.status !== 'playing' || !alive) return;
      const current = state.players[state.currentPlayerIndex];
      if (!current || current.id !== myId) return;

      // ランダムな小遅延のあと操作
      setTimeout(() => {
        if (!alive) return;
        const move = pickMove(state, myId);
        stats.actions++;
        if (move.type === 'draw') {
          sock.emit('draw-from-deck', { roomId }, (res) => {
            if (res?.needsChoice) {
              sock.emit('play-drawn-card', { roomId, choice: 'plus' }, () => {});
            }
          });
        } else {
          sock.emit('play-card', { roomId, cardId: move.cardId, choice: move.choice }, () => {});
        }
      }, 200 + Math.floor(Math.random() * 400));
    });

    resolve(sock);
  });
}

const sharedRooms = [];

(async () => {
  console.log(`[loadtest] ${CLIENTS}クライアント, ${GROUP_SIZE}人/ルーム, ${DURATION}秒 @ ${URL}`);
  const sockets = [];
  const groupCount = Math.ceil(CLIENTS / GROUP_SIZE);
  for (let g = 0; g < groupCount; g++) {
    sharedRooms[g] = null;
    const inGroup = Math.min(GROUP_SIZE, CLIENTS - g * GROUP_SIZE);
    for (let i = 0; i < inGroup; i++) {
      sockets.push(await spawnClient(g, i === 0));
      await new Promise(r => setTimeout(r, 50));
    }
  }

  const start = Date.now();
  const interval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - start) / 1000);
    console.log(`[${elapsed}s] connected=${stats.connected} rooms=${stats.roomsCreated} joined=${stats.roomsJoined} games=${stats.gamesStarted} actions=${stats.actions} updates=${stats.gameUpdates} errors=${stats.errors}`);
  }, 5000);

  setTimeout(() => {
    clearInterval(interval);
    console.log('\n[loadtest] 終了 — 切断します');
    sockets.forEach(s => s.close());
    console.log('[loadtest] 最終統計:', stats);
    process.exit(0);
  }, DURATION * 1000);
})();
