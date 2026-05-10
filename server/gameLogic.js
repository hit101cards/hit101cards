const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const INITIAL_HAND_SIZE = 2;

const PTS = {
  HIT_101: 5,
  SETUP_101: -2,
  BUST: -2,
  FORCE_BUST: 3,
  JOKER_WIN: 8,
  JOKER_LOSE: -1,
};

function createDeck() {
  const cards = [];
  let id = 0;
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ id: String(id++), suit, rank });
    }
  }
  cards.push({ id: String(id++), suit: 'JOKER', rank: 'Joker' });
  cards.push({ id: String(id++), suit: 'JOKER', rank: 'Joker' });
  return cards;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getCardValue(rank, currentTotal, choice) {
  if (rank === 'A') return 1;
  if (rank === 'Joker') return currentTotal === 100 ? 1 : 50;
  if (rank === 'J') return 10;
  if (rank === 'Q') return 20;
  if (rank === 'K') return 30;
  if (rank === '10') return choice === 'plus' ? 10 : -10;
  if (rank === '8') return choice === 'plus' ? 8 : 0;
  if (rank === '9') return choice === 'plus' ? 9 : 0;
  return parseInt(rank, 10);
}

function needsChoice(rank) {
  return rank === '10' || rank === '8' || rank === '9';
}

function getNextPlayerIndex(players, currentIndex, direction, skip) {
  const n = players.length;
  let skipsRemaining = skip ? 1 : 0;
  for (let step = 1; step <= n; step++) {
    const idx = ((currentIndex + direction * step) % n + n) % n;
    // 脱落済みまたは切断タイムアウト済みはスキップ
    if (players[idx].lost) continue;
    if (skipsRemaining > 0) { skipsRemaining--; continue; }
    return idx;
  }
  return currentIndex;
}

function ensureDeck(room) {
  if (room.deck.length === 0) {
    if (room.discardPile.length > 1) {
      const last = room.discardPile.pop();
      room.deck = shuffle(room.discardPile);
      room.discardPile = [last];
    } else if (room.discardPile.length === 1) {
      // discardPile が1枚しかない場合はその1枚をデッキに戻す
      room.deck = room.discardPile.splice(0);
    }
  }
}

// ポイントはプレイヤー名をキーに管理（再接続後もIDが変わらないため）
function addPoints(room, playerName, delta) {
  room.points[playerName] = (room.points[playerName] || 0) + delta;
}

function buildPointChanges(room, changes) {
  return changes.map(({ playerName, delta }) => ({
    playerName,
    change: delta
  }));
}

function endRound(room, currentPlayer, previousPlayerName, scenario) {
  const changes = [];

  if (scenario === '101') {
    addPoints(room, currentPlayer.name, PTS.HIT_101);
    changes.push({ playerName: currentPlayer.name, delta: PTS.HIT_101 });
    if (previousPlayerName) {
      addPoints(room, previousPlayerName, PTS.SETUP_101);
      changes.push({ playerName: previousPlayerName, delta: PTS.SETUP_101 });
    }
    room.roundResult = {
      scenario,
      // 後方互換のため description はそのまま、descriptionKey + descriptionParams をクライアントで翻訳
      description: `${currentPlayer.name} がぴったり101！`,
      descriptionKey: 'round.scenario.101',
      descriptionParams: { name: currentPlayer.name },
      pointChanges: buildPointChanges(room, changes)
    };
  } else if (scenario === '102') {
    addPoints(room, currentPlayer.name, PTS.BUST);
    changes.push({ playerName: currentPlayer.name, delta: PTS.BUST });
    if (previousPlayerName) {
      addPoints(room, previousPlayerName, PTS.FORCE_BUST);
      changes.push({ playerName: previousPlayerName, delta: PTS.FORCE_BUST });
    }
    room.roundResult = {
      scenario,
      description: `${currentPlayer.name} がオーバー！`,
      descriptionKey: 'round.scenario.102',
      descriptionParams: { name: currentPlayer.name },
      pointChanges: buildPointChanges(room, changes)
    };
  } else if (scenario === 'joker101') {
    addPoints(room, currentPlayer.name, PTS.JOKER_WIN);
    changes.push({ playerName: currentPlayer.name, delta: PTS.JOKER_WIN });
    room.players.forEach(p => {
      if (p.name !== currentPlayer.name && !p.lost) {
        addPoints(room, p.name, PTS.JOKER_LOSE);
        changes.push({ playerName: p.name, delta: PTS.JOKER_LOSE });
      }
    });
    room.roundResult = {
      scenario,
      description: `${currentPlayer.name} が100でJokerを炸裂！`,
      descriptionKey: 'round.scenario.joker101',
      descriptionParams: { name: currentPlayer.name },
      pointChanges: buildPointChanges(room, changes)
    };
  }

  room.status = 'roundEnd';
  room.lastPlayedCard.scenario = scenario;

  // 次ラウンドの開始プレイヤーを決定
  // 101ちょうど: 負けた人（直前のプレイヤー）から
  // 102以上:     負けた人（出したプレイヤー）から
  // joker101:    勝った人（出したプレイヤー）から
  if (scenario === '101') {
    room.nextStartPlayerName = previousPlayerName || currentPlayer.name;
  } else if (scenario === '102') {
    room.nextStartPlayerName = currentPlayer.name;
  } else if (scenario === 'joker101') {
    room.nextStartPlayerName = currentPlayer.name;
  }

  // 投票を初期化（接続中のプレイヤー全員）
  room.votes = {};
  room.players.forEach(p => { room.votes[p.name] = null; });
}

function playCardCore(room, currentPlayer, card, choice, fromDeck) {
  const totalBefore = room.currentTotal;
  const value = getCardValue(card.rank, totalBefore, choice);
  const newTotal = Math.max(0, totalBefore + value);

  room.discardPile.push(card);
  room.lastPlayedCard = {
    ...card,
    addedValue: value,
    playerName: currentPlayer.name,
    fromDeck: !!fromDeck,
    scenario: null
  };
  room.currentTotal = newTotal;

  const previousPlayerName = room.previousPlayerName;

  if (newTotal === 101) {
    const isJokerSpecial = card.rank === 'Joker' && totalBefore === 100;
    endRound(room, currentPlayer, previousPlayerName, isJokerSpecial ? 'joker101' : '101');
    return { success: true };
  } else if (newTotal > 101) {
    endRound(room, currentPlayer, previousPlayerName, '102');
    return { success: true };
  }

  if (!fromDeck) {
    ensureDeck(room);
    if (room.deck.length > 0) currentPlayer.hand.push(room.deck.pop());
  }

  room.previousPlayerName = currentPlayer.name;

  const shouldSkip = card.rank === '8' && choice === 'skip';
  const shouldReturn = card.rank === '9' && choice === 'return';
  if (shouldReturn) room.direction *= -1;

  room.currentPlayerIndex = getNextPlayerIndex(
    room.players, room.currentPlayerIndex, room.direction, shouldSkip
  );

  return { success: true };
}

function createGame(playerList) {
  const deck = shuffle(createDeck());
  const players = playerList.map(p => ({
    id: p.id,
    name: p.name,
    hand: [],
    lost: false,
    disconnected: false,
    isBot: !!p.isBot
  }));

  for (let i = 0; i < INITIAL_HAND_SIZE; i++) {
    for (const player of players) {
      if (deck.length > 0) player.hand.push(deck.pop());
    }
  }

  const points = {};
  players.forEach(p => { points[p.name] = 0; });

  return {
    players,
    deck,
    discardPile: [],
    currentTotal: 0,
    currentPlayerIndex: Math.floor(Math.random() * players.length),
    direction: 1,
    previousPlayerName: null,
    lastPlayedCard: null,
    pendingDrawnCard: null,
    points,
    roundResult: null,
    roundCount: 1
  };
}

function startNewRound(room) {
  const deck = shuffle(createDeck());
  // 脱落済みプレイヤーはリセットしない（退出・タイムアウトした人は復活させない）
  room.players.forEach(p => {
    if (p.lost) return;
    p.hand = [];
    // disconnected フラグは維持（再接続タイマーが継続中の可能性があるため）
  });
  for (let i = 0; i < INITIAL_HAND_SIZE; i++) {
    for (const player of room.players) {
      if (!player.lost && deck.length > 0) player.hand.push(deck.pop());
    }
  }
  room.deck = deck;
  room.discardPile = [];
  room.currentTotal = 0;
  room.direction = 1;
  room.previousPlayerName = null;

  // ラウンドごとにプレイヤー順をシャッフル
  room.players = shuffle(room.players);

  // 次ラウンドの開始プレイヤーを設定（脱落済みはスキップ）
  let startIndex = -1;
  if (room.nextStartPlayerName) {
    const candidateIdx = room.players.findIndex(p => p.name === room.nextStartPlayerName);
    if (candidateIdx >= 0 && !room.players[candidateIdx].lost) {
      startIndex = candidateIdx;
    } else if (candidateIdx >= 0) {
      // 候補が脱落済みなら次の非脱落プレイヤーへ
      const n = room.players.length;
      for (let step = 1; step < n; step++) {
        const idx = (candidateIdx + step) % n;
        if (!room.players[idx].lost) { startIndex = idx; break; }
      }
    }
  }
  room.currentPlayerIndex = startIndex >= 0 ? startIndex : 0;
  room.nextStartPlayerName = null;
  room.lastPlayedCard = null;
  room.pendingDrawnCard = null;
  room.roundResult = null;
  room.roundCount += 1;
  room.votes = {};
  room.status = 'playing';
}

function processPlayCard(room, playerId, cardId, choice) {
  const currentPlayer = room.players[room.currentPlayerIndex];
  if (currentPlayer.id !== playerId) return { success: false, error: 'あなたのターンではありません' };
  const cardIndex = currentPlayer.hand.findIndex(c => c.id === cardId);
  if (cardIndex === -1) return { success: false, error: 'カードが見つかりません' };
  const card = currentPlayer.hand[cardIndex];
  if (needsChoice(card.rank) && !choice) return { success: false, error: '選択が必要です' };
  currentPlayer.hand.splice(cardIndex, 1);
  return playCardCore(room, currentPlayer, card, choice, false);
}

function drawFromDeck(room, playerId) {
  const currentPlayer = room.players[room.currentPlayerIndex];
  if (currentPlayer.id !== playerId) return { success: false, error: 'あなたのターンではありません' };
  if (room.pendingDrawnCard) return { success: false, error: 'すでにカードを引いています' };
  ensureDeck(room);
  if (room.deck.length === 0) return { success: false, error: '山札がありません' };
  const card = room.deck.pop();
  room.pendingDrawnCard = card;
  return { success: true, card, needsChoice: needsChoice(card.rank) };
}

function processDrawAndPlay(room, playerId, choice) {
  const currentPlayer = room.players[room.currentPlayerIndex];
  if (currentPlayer.id !== playerId) return { success: false, error: 'あなたのターンではありません' };
  if (!room.pendingDrawnCard) return { success: false, error: '引いたカードがありません' };
  const card = room.pendingDrawnCard;
  if (needsChoice(card.rank) && !choice) return { success: false, error: '選択が必要です' };
  room.pendingDrawnCard = null;
  return playCardCore(room, currentPlayer, card, choice, true);
}

module.exports = { createGame, startNewRound, processPlayCard, drawFromDeck, processDrawAndPlay };
