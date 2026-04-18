// Web Audio API による効果音（外部ファイル不要）
// ミュート設定は localStorage で永続化

const STORAGE_KEY = '101game-mute';

let audioCtx: AudioContext | null = null;
let muted = localStorage.getItem(STORAGE_KEY) === '1';

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(v: boolean): void {
  muted = v;
  localStorage.setItem(STORAGE_KEY, v ? '1' : '0');
}

export function toggleMute(): boolean {
  setMuted(!muted);
  return muted;
}

// --- 基本音生成ユーティリティ ---

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15) {
  if (muted) return;
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

function playNoise(duration: number, volume = 0.08) {
  if (muted) return;
  try {
    const ctx = getCtx();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  } catch {}
}

// --- 効果音 ---

/** カードを出した時 */
export function playCardSound() {
  playNoise(0.12, 0.1);
  playTone(800, 0.08, 'square', 0.06);
}

/** 山札からカードを引いた時 */
export function playDrawSound() {
  playTone(400, 0.1, 'triangle', 0.08);
}

/** 自分のターンが来た時 */
export function playTurnSound() {
  playTone(523, 0.1, 'sine', 0.12);
  setTimeout(() => playTone(659, 0.15, 'sine', 0.12), 100);
}

/** 101ぴったり！ */
export function playHit101Sound() {
  const notes = [523, 659, 784, 1047]; // C E G C (高い)
  notes.forEach((f, i) => {
    setTimeout(() => playTone(f, 0.3, 'sine', 0.15), i * 120);
  });
}

/** バースト (102+) */
export function playBustSound() {
  playTone(200, 0.4, 'sawtooth', 0.12);
  setTimeout(() => playTone(150, 0.5, 'sawtooth', 0.1), 150);
  playNoise(0.3, 0.12);
}

/** ジョーカー勝利 */
export function playJokerSound() {
  const notes = [392, 494, 587, 784, 988]; // G B D G(高) B(高)
  notes.forEach((f, i) => {
    setTimeout(() => playTone(f, 0.35, 'sine', 0.13), i * 100);
  });
}

/** スキップ */
export function playSkipSound() {
  playTone(600, 0.08, 'square', 0.08);
  setTimeout(() => playTone(400, 0.12, 'square', 0.06), 80);
}

/** リターン */
export function playReturnSound() {
  playTone(500, 0.1, 'triangle', 0.1);
  setTimeout(() => playTone(600, 0.1, 'triangle', 0.1), 100);
  setTimeout(() => playTone(500, 0.1, 'triangle', 0.1), 200);
}

/** カウントアップ中の1ステップ */
export function playCountTick(value: number) {
  if (muted) return;
  const freq = 300 + Math.min(value, 101) * 5;
  playTone(freq, 0.04, 'sine', 0.04);
}
