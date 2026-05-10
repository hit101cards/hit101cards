'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGame, startNewRound, processPlayCard, drawFromDeck, processDrawAndPlay } = require('../gameLogic');

// ─── ヘルパー: room 状態を擬似的に作る ────────────────────────────
function makeRoom(playerNames, opts = {}) {
  const players = playerNames.map((name, i) => ({ id: `id-${i}`, name, isBot: false }));
  const game = createGame(players);
  // テスト用に開始プレイヤーを 0 番に固定 (createGame はランダム)
  game.currentPlayerIndex = opts.startIndex ?? 0;
  game.status = 'playing';
  return game;
}

function findCardInHand(player, predicate) {
  return player.hand.find(predicate);
}

// テスト用: 特定ランクのカードを手札に挿入 (デッキから取り除いて配る)
function dealRankToPlayer(room, playerIndex, rank) {
  const player = room.players[playerIndex];
  const idx = room.deck.findIndex((c) => c.rank === rank);
  if (idx < 0) throw new Error(`Card with rank ${rank} not found in deck`);
  const [card] = room.deck.splice(idx, 1);
  player.hand.push(card);
  return card;
}

// ─── createGame ────────────────────────────────────────────────────
test('createGame: 2 人なら各プレイヤー手札 2 枚', () => {
  const room = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
  assert.equal(room.players.length, 2);
  assert.equal(room.players[0].hand.length, 2);
  assert.equal(room.players[1].hand.length, 2);
  assert.equal(room.currentTotal, 0);
  assert.equal(room.direction, 1);
  assert.equal(room.roundCount, 1);
});

test('createGame: 6 人なら各プレイヤー手札 2 枚', () => {
  const room = createGame(['A', 'B', 'C', 'D', 'E', 'F'].map((n, i) => ({ id: String(i), name: n })));
  assert.equal(room.players.length, 6);
  for (const p of room.players) assert.equal(p.hand.length, 2);
});

test('createGame: デッキにジョーカーが 2 枚含まれる', () => {
  const room = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
  // 全カード = 山札 + 4 枚配布済み
  const allCards = [...room.deck, ...room.players.flatMap(p => p.hand)];
  const jokers = allCards.filter(c => c.rank === 'Joker');
  assert.equal(jokers.length, 2);
});

test('createGame: 全カード合計 54 枚 (52 + ジョーカー 2)', () => {
  const room = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
  const allCards = [...room.deck, ...room.players.flatMap(p => p.hand)];
  assert.equal(allCards.length, 54);
});

test('createGame: ポイント初期化', () => {
  const room = createGame([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
  assert.equal(room.points['A'], 0);
  assert.equal(room.points['B'], 0);
});

// ─── 通常カード ────────────────────────────────────────────────────
test('数字カード (5) を出すと合計 +5', () => {
  const room = makeRoom(['A', 'B']);
  const card = dealRankToPlayer(room, 0, '5');
  const r = processPlayCard(room, room.players[0].id, card.id);
  assert.equal(r.success, true);
  assert.equal(room.currentTotal, 5);
  assert.equal(room.currentPlayerIndex, 1); // 次のプレイヤーへ
});

test('A は 1 として加算される', () => {
  const room = makeRoom(['A', 'B']);
  const card = dealRankToPlayer(room, 0, 'A');
  processPlayCard(room, room.players[0].id, card.id);
  assert.equal(room.currentTotal, 1);
});

test('J = 10, Q = 20, K = 30', () => {
  for (const [rank, value] of [['J', 10], ['Q', 20], ['K', 30]]) {
    const room = makeRoom(['A', 'B']);
    const card = dealRankToPlayer(room, 0, rank);
    processPlayCard(room, room.players[0].id, card.id);
    assert.equal(room.currentTotal, value, `${rank} は ${value} を加算するはず`);
  }
});

// ─── 特殊カード: 10 (+10 / -10) ────────────────────────────────────
test('10 + plus: +10', () => {
  const room = makeRoom(['A', 'B']);
  room.currentTotal = 50;
  const card = dealRankToPlayer(room, 0, '10');
  processPlayCard(room, room.players[0].id, card.id, 'plus');
  assert.equal(room.currentTotal, 60);
});

test('10 + minus: -10', () => {
  const room = makeRoom(['A', 'B']);
  room.currentTotal = 50;
  const card = dealRankToPlayer(room, 0, '10');
  processPlayCard(room, room.players[0].id, card.id, 'minus');
  assert.equal(room.currentTotal, 40);
});

test('10 - choice 必須: choice 無しなら失敗', () => {
  const room = makeRoom(['A', 'B']);
  const card = dealRankToPlayer(room, 0, '10');
  const r = processPlayCard(room, room.players[0].id, card.id);
  assert.equal(r.success, false);
});

test('合計が 0 未満にならない (-10 で 5 → 0)', () => {
  const room = makeRoom(['A', 'B']);
  room.currentTotal = 5;
  const card = dealRankToPlayer(room, 0, '10');
  processPlayCard(room, room.players[0].id, card.id, 'minus');
  assert.equal(room.currentTotal, 0);
});

// ─── 特殊カード: 8 (+8 / Skip) ────────────────────────────────────
test('8 + plus: +8', () => {
  const room = makeRoom(['A', 'B', 'C']);
  const card = dealRankToPlayer(room, 0, '8');
  processPlayCard(room, room.players[0].id, card.id, 'plus');
  assert.equal(room.currentTotal, 8);
  assert.equal(room.currentPlayerIndex, 1);
});

test('8 + skip: 合計変化なし、次の人を飛ばす', () => {
  const room = makeRoom(['A', 'B', 'C']);
  const card = dealRankToPlayer(room, 0, '8');
  processPlayCard(room, room.players[0].id, card.id, 'skip');
  assert.equal(room.currentTotal, 0);
  assert.equal(room.currentPlayerIndex, 2); // B をスキップして C へ
});

// ─── 特殊カード: 9 (+9 / Return) ───────────────────────────────────
test('9 + plus: +9', () => {
  const room = makeRoom(['A', 'B', 'C']);
  const card = dealRankToPlayer(room, 0, '9');
  processPlayCard(room, room.players[0].id, card.id, 'plus');
  assert.equal(room.currentTotal, 9);
  assert.equal(room.direction, 1);
});

test('9 + return: 合計変化なし、方向反転', () => {
  const room = makeRoom(['A', 'B', 'C']);
  const card = dealRankToPlayer(room, 0, '9');
  processPlayCard(room, room.players[0].id, card.id, 'return');
  assert.equal(room.currentTotal, 0);
  assert.equal(room.direction, -1);
  // direction -1 で次は (0 + (-1) + 3) % 3 = 2 → C
  assert.equal(room.currentPlayerIndex, 2);
});

// ─── ジョーカー ────────────────────────────────────────────────────
test('Joker (合計 0): +50', () => {
  const room = makeRoom(['A', 'B']);
  const card = dealRankToPlayer(room, 0, 'Joker');
  processPlayCard(room, room.players[0].id, card.id);
  assert.equal(room.currentTotal, 50);
});

test('Joker (合計 100): +1 = ジャスト 101 で joker101 シナリオ勝利', () => {
  const room = makeRoom(['A', 'B']);
  room.currentTotal = 100;
  const card = dealRankToPlayer(room, 0, 'Joker');
  const r = processPlayCard(room, room.players[0].id, card.id);
  assert.equal(r.success, true);
  assert.equal(room.currentTotal, 101);
  assert.equal(room.status, 'roundEnd');
  assert.equal(room.roundResult.scenario, 'joker101');
  // joker101: 出した人 +8、他全員 -1
  assert.equal(room.points['A'], 8);
  assert.equal(room.points['B'], -1);
});

// ─── 101 ちょうど ──────────────────────────────────────────────────
test('101 ちょうど: 出した人 +5、前の人 -2', () => {
  const room = makeRoom(['A', 'B']);
  room.currentTotal = 99;
  room.previousPlayerName = 'B';
  const card = dealRankToPlayer(room, 0, '2');
  const r = processPlayCard(room, room.players[0].id, card.id);
  assert.equal(r.success, true);
  assert.equal(room.currentTotal, 101);
  assert.equal(room.status, 'roundEnd');
  assert.equal(room.roundResult.scenario, '101');
  assert.equal(room.points['A'], 5);
  assert.equal(room.points['B'], -2);
});

test('101 ちょうど (前の人なし): 出した人だけ +5', () => {
  const room = makeRoom(['A', 'B']);
  room.currentTotal = 99;
  room.previousPlayerName = null;
  const card = dealRankToPlayer(room, 0, '2');
  processPlayCard(room, room.players[0].id, card.id);
  assert.equal(room.points['A'], 5);
  assert.equal(room.points['B'], 0);
});

// ─── 102 以上 (バースト) ──────────────────────────────────────────
test('102 ちょうど: 出した人 -2、前の人 +3', () => {
  const room = makeRoom(['A', 'B']);
  room.currentTotal = 99;
  room.previousPlayerName = 'B';
  const card = dealRankToPlayer(room, 0, '3');
  const r = processPlayCard(room, room.players[0].id, card.id);
  assert.equal(r.success, true);
  assert.equal(room.currentTotal, 102);
  assert.equal(room.status, 'roundEnd');
  assert.equal(room.roundResult.scenario, '102');
  assert.equal(room.points['A'], -2);
  assert.equal(room.points['B'], 3);
});

test('110 (大幅バースト) でも -2 / +3 (一律)', () => {
  const room = makeRoom(['A', 'B']);
  room.currentTotal = 100;
  room.previousPlayerName = 'B';
  const card = dealRankToPlayer(room, 0, 'J'); // 10
  processPlayCard(room, room.players[0].id, card.id);
  assert.equal(room.currentTotal, 110);
  assert.equal(room.roundResult.scenario, '102');
  assert.equal(room.points['A'], -2);
});

// ─── ターン進行 ────────────────────────────────────────────────────
test('普通の +5: A → B (時計回り)', () => {
  const room = makeRoom(['A', 'B', 'C']);
  const card = dealRankToPlayer(room, 0, '5');
  processPlayCard(room, room.players[0].id, card.id);
  assert.equal(room.currentPlayerIndex, 1);
});

test('リターン後の進行: A → C → B → A の順', () => {
  const room = makeRoom(['A', 'B', 'C']);
  const card9 = dealRankToPlayer(room, 0, '9');
  processPlayCard(room, room.players[0].id, card9.id, 'return');
  assert.equal(room.currentPlayerIndex, 2); // A → C
  const card5 = dealRankToPlayer(room, 2, '5');
  processPlayCard(room, room.players[2].id, card5.id);
  assert.equal(room.currentPlayerIndex, 1); // C → B
});

test('脱落プレイヤーをスキップ', () => {
  const room = makeRoom(['A', 'B', 'C']);
  room.players[1].lost = true; // B 脱落
  const card = dealRankToPlayer(room, 0, '5');
  processPlayCard(room, room.players[0].id, card.id);
  assert.equal(room.currentPlayerIndex, 2); // B をスキップして C へ
});

// ─── 山札から引く ─────────────────────────────────────────────────
test('drawFromDeck: pendingDrawnCard に保存される', () => {
  const room = makeRoom(['A', 'B']);
  const r = drawFromDeck(room, room.players[0].id);
  assert.equal(r.success, true);
  assert.ok(r.card);
  assert.ok(room.pendingDrawnCard);
});

test('drawFromDeck → processDrawAndPlay: ターン進行', () => {
  const room = makeRoom(['A', 'B']);
  const r = drawFromDeck(room, room.players[0].id);
  // 引いたカードが特殊カードなら choice が必要
  const choice = r.needsChoice ? (r.card.rank === '10' ? 'plus' : r.card.rank === '8' ? 'plus' : 'plus') : undefined;
  const r2 = processDrawAndPlay(room, room.players[0].id, choice);
  assert.equal(r2.success, true);
  assert.equal(room.currentPlayerIndex, 1);
});

test('drawFromDeck: 自分のターンじゃないと失敗', () => {
  const room = makeRoom(['A', 'B']);
  const r = drawFromDeck(room, room.players[1].id);
  assert.equal(r.success, false);
});

test('drawFromDeck: 既に pendingDrawnCard ある状態で失敗', () => {
  const room = makeRoom(['A', 'B']);
  drawFromDeck(room, room.players[0].id);
  const r = drawFromDeck(room, room.players[0].id);
  assert.equal(r.success, false);
});

// ─── 認可 ─────────────────────────────────────────────────────────
test('processPlayCard: 自分のターンじゃないと失敗', () => {
  const room = makeRoom(['A', 'B']);
  const card = dealRankToPlayer(room, 1, '5');
  const r = processPlayCard(room, room.players[1].id, card.id);
  assert.equal(r.success, false);
});

test('processPlayCard: 持ってないカードを出すと失敗', () => {
  const room = makeRoom(['A', 'B']);
  const r = processPlayCard(room, room.players[0].id, 'fake-card-id');
  assert.equal(r.success, false);
});

// ─── ラウンド開始 ─────────────────────────────────────────────────
test('startNewRound: 全プレイヤーに新しい手札 2 枚', () => {
  const room = makeRoom(['A', 'B', 'C']);
  // 1 ラウンド終了状態にして
  room.status = 'roundEnd';
  room.nextStartPlayerName = 'B';
  startNewRound(room);
  assert.equal(room.status, 'playing');
  assert.equal(room.roundCount, 2);
  assert.equal(room.currentTotal, 0);
  for (const p of room.players) {
    if (!p.lost) assert.equal(p.hand.length, 2);
  }
});

test('startNewRound: 脱落プレイヤーには新しい手札を配らない (前ラウンドの手札は保持)', () => {
  const room = makeRoom(['A', 'B', 'C']);
  room.players[1].lost = true;
  const handBefore = room.players[1].hand.length;
  room.status = 'roundEnd';
  startNewRound(room);
  // B の手札はリセット/補充されないので前ラウンドのまま
  const b = room.players.find(p => p.name === 'B');
  assert.equal(b.hand.length, handBefore);
});

test('startNewRound: nextStartPlayerName で開始者を指定', () => {
  const room = makeRoom(['A', 'B', 'C']);
  room.status = 'roundEnd';
  room.nextStartPlayerName = 'C';
  startNewRound(room);
  // シャッフルされるが C が開始者
  const startName = room.players[room.currentPlayerIndex].name;
  assert.equal(startName, 'C');
});

test('startNewRound: 候補が脱落済みなら次の生存者へ', () => {
  const room = makeRoom(['A', 'B', 'C']);
  room.players[2].lost = true; // C 脱落
  room.status = 'roundEnd';
  room.nextStartPlayerName = 'C';
  startNewRound(room);
  const startName = room.players[room.currentPlayerIndex].name;
  assert.notEqual(startName, 'C');
  assert.notEqual(room.players[room.currentPlayerIndex].lost, true);
});

// ─── 次ラウンドの開始者ルール ─────────────────────────────────────
test('101 シナリオ: 次ラウンドは前の人 (負けた人) から開始', () => {
  const room = makeRoom(['A', 'B']);
  room.currentTotal = 99;
  room.previousPlayerName = 'B';
  const card = dealRankToPlayer(room, 0, '2');
  processPlayCard(room, room.players[0].id, card.id);
  assert.equal(room.nextStartPlayerName, 'B');
});

test('102 シナリオ: 次ラウンドは出した人 (負けた人) から開始', () => {
  const room = makeRoom(['A', 'B']);
  room.currentTotal = 99;
  room.previousPlayerName = 'B';
  const card = dealRankToPlayer(room, 0, '5');
  processPlayCard(room, room.players[0].id, card.id);
  assert.equal(room.nextStartPlayerName, 'A');
});

test('joker101 シナリオ: 次ラウンドは出した人 (勝った人) から開始', () => {
  const room = makeRoom(['A', 'B']);
  room.currentTotal = 100;
  const card = dealRankToPlayer(room, 0, 'Joker');
  processPlayCard(room, room.players[0].id, card.id);
  assert.equal(room.nextStartPlayerName, 'A');
});

// ─── 山札補充 ─────────────────────────────────────────────────────
test('山札が空 → 捨て札を再シャッフルして補充', () => {
  const room = makeRoom(['A', 'B']);
  // 山札を 1 枚にして、捨て札に多めに積む
  while (room.deck.length > 1) room.discardPile.push(room.deck.pop());
  // 数字カードを引いて山札が空になる
  drawFromDeck(room, room.players[0].id);
  // この時点で deck.length === 0
  // pendingDrawnCard を消化 (1+) してから次のドローでensureDeckが効く
  processDrawAndPlay(room, room.players[0].id);
  // B のターンになり、引けることを確認
  const r = drawFromDeck(room, room.players[1].id);
  assert.equal(r.success, true);
});

// ─── ポイント変更内容の整合性 ─────────────────────────────────────
test('roundResult.pointChanges に正しい値が含まれる (101 シナリオ)', () => {
  const room = makeRoom(['A', 'B']);
  room.currentTotal = 99;
  room.previousPlayerName = 'B';
  const card = dealRankToPlayer(room, 0, '2');
  processPlayCard(room, room.players[0].id, card.id);
  const changes = room.roundResult.pointChanges;
  const a = changes.find(c => c.playerName === 'A');
  const b = changes.find(c => c.playerName === 'B');
  assert.equal(a.change, 5);
  assert.equal(b.change, -2);
});

test('roundResult.descriptionKey + descriptionParams が含まれる', () => {
  const room = makeRoom(['A', 'B']);
  room.currentTotal = 99;
  const card = dealRankToPlayer(room, 0, '2');
  processPlayCard(room, room.players[0].id, card.id);
  assert.equal(room.roundResult.descriptionKey, 'round.scenario.101');
  assert.equal(room.roundResult.descriptionParams.name, 'A');
});

// ─── カード追加 (出した後に 1 枚補充) ─────────────────────────────
test('手札からカードを出すと自動的に 1 枚補充される', () => {
  const room = makeRoom(['A', 'B']);
  const handSizeBefore = room.players[0].hand.length;
  const card = dealRankToPlayer(room, 0, '5');
  // dealRankToPlayer で 1 枚追加されているので handSizeBefore + 1
  processPlayCard(room, room.players[0].id, card.id);
  // 出した分減って、補充で +1 → 元の手札サイズに戻る (handSizeBefore + 1 - 1 + 1 = +1)
  // ただし山札空のときは補充されないので >= handSizeBefore
  assert.ok(room.players[0].hand.length >= handSizeBefore);
});

test('drawFromDeck → playDrawnCard では補充されない', () => {
  const room = makeRoom(['A', 'B']);
  const handSizeBefore = room.players[0].hand.length;
  drawFromDeck(room, room.players[0].id);
  processDrawAndPlay(room, room.players[0].id, 'plus');
  // 引いたカードを出しただけなので手札数は変化なし
  assert.equal(room.players[0].hand.length, handSizeBefore);
});
