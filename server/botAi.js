// Bot AI: 手札とゲーム状態から次の手を決定する
// 戻り値: { action: 'play', cardId, choice } | { action: 'draw' }

function cardValue(rank, currentTotal, choice) {
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

// カード+選択肢ごとの候補を列挙
function enumerateChoices(card) {
  if (card.rank === '10') return [{ choice: 'plus' }, { choice: 'minus' }];
  if (card.rank === '8')  return [{ choice: 'plus' }, { choice: 'skip' }];
  if (card.rank === '9')  return [{ choice: 'plus' }, { choice: 'return' }];
  return [{ choice: null }];
}

// 1候補のスコア（高いほど良い）
function scoreOption(card, currentTotal, choice) {
  const val = cardValue(card.rank, currentTotal, choice);
  const newTotal = Math.max(0, currentTotal + val);

  // 100 時の Joker は特殊勝利
  if (card.rank === 'Joker' && currentTotal === 100) return 1200;

  if (newTotal === 101) return 1000;
  if (newTotal > 101)   return -1000 - (newTotal - 101);

  let score = 0;
  if (newTotal === 100) score -= 30;
  else if (newTotal >= 95) score -= 10;
  else if (newTotal <= 50) score += 5;

  // 可能なら強カードは後半用に温存したいので、値の絶対値が小さい方を微優先
  score -= Math.abs(val) * 0.1;

  return score + Math.random() * 0.5;
}

// 相手が次にバーストしやすいかを評価（2手先読み）
// newTotal を渡したとき、相手が困る度合いを返す（高いほど攻撃的に良い）
function opponentDifficultyScore(newTotal) {
  if (newTotal >= 95 && newTotal < 101) {
    // 相手が使えるカードが少なくなる（Aや10-、8skip、9return 程度）
    // 95-100 に追い込むほど有利
    const dist = 101 - newTotal;
    if (dist <= 1) return 15; // 100: Aで101されるリスクはあるが、ほとんどの手でバースト
    if (dist <= 3) return 10;
    if (dist <= 5) return 6;
    return 3;
  }
  return 0;
}

// 手札の戦略的価値を考慮したスコア補正
function handPreservationBonus(card, hand) {
  // 手札に10（±10）がある場合は温存価値が高い
  if (card.rank === '10') return -3;
  // スキップ・リターンは終盤で価値が高い
  if (card.rank === '8' || card.rank === '9') return -1.5;
  // Jokerは最強カード、温存
  if (card.rank === 'Joker') return -5;
  return 0;
}

function decideBotMove(hand, currentTotal, playerCount) {
  if (!hand || hand.length === 0) {
    return { action: 'draw' };
  }

  let best = null;
  for (const card of hand) {
    for (const { choice } of enumerateChoices(card)) {
      let s = scoreOption(card, currentTotal, choice);

      // 2手先読み: 相手を困らせるボーナス
      const val = cardValue(card.rank, currentTotal, choice);
      const newTotal = Math.max(0, currentTotal + val);
      if (newTotal < 101) {
        s += opponentDifficultyScore(newTotal);
      }

      // 手札温存ボーナス（手札が3枚以上あるときのみ温存を考慮）
      if (hand.length >= 3) {
        s += handPreservationBonus(card, hand);
      }

      // プレイヤー数が少ない場合はアグレッシブに
      if (playerCount && playerCount <= 2 && newTotal >= 90 && newTotal < 101) {
        s += 2; // 1対1では高い数値に追い込む方が有利
      }

      if (!best || s > best.score) {
        best = { score: s, cardId: card.id, choice, rank: card.rank };
      }
    }
  }

  // 手札が全部バーストしかない場合は山札から引く
  if (best.score <= -1000) {
    return { action: 'draw' };
  }

  return { action: 'play', cardId: best.cardId, choice: best.choice };
}

// 引いたカードの扱い: 選択が必要なときのみ呼ばれる
function decideDrawnCardChoice(card, currentTotal) {
  let best = null;
  for (const { choice } of enumerateChoices(card)) {
    const s = scoreOption(card, currentTotal, choice);
    if (!best || s > best.score) best = { score: s, choice };
  }
  return best ? best.choice : 'plus';
}

module.exports = { decideBotMove, decideDrawnCardChoice };
