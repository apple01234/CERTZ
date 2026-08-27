/**
 * WebAudio 합성 사운드 (외부 리소스 0)
 * - 보스전 성능을 위해 노드 수를 최소화: 짧은 오실레이터/노이즈 버스트만 사용
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

let bgmTimer: number | null = null;
let bgmStep = 0;
let bgmPattern: "field" | "boss" | "title" | null = null;

export function initAudio() {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return;
  }
  try {
    const AC: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.16;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
}

export function setMuted(m: boolean) {
  muted = m;
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.16, ctx.currentTime, 0.02);
  if (m) stopBGM();
  else if (bgmPattern) playBGM(bgmPattern);
}

export function isMuted() {
  return muted;
}

function tone(
  type: OscillatorType,
  freq: number,
  dur: number,
  vol = 0.5,
  slideTo?: number,
  delay = 0
) {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur: number, vol = 0.4, freq = 1200, sweepTo = 300, delay = 0) {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const flt = ctx.createBiquadFilter();
  flt.type = "bandpass";
  flt.frequency.setValueAtTime(freq, t0);
  flt.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t0 + dur);
  flt.Q.value = 1.1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(flt).connect(g).connect(master);
  src.start(t0);
}

/* ---------- SFX ---------- */

export const sfx = {
  swing() {
    // 검 휘두르는 소리: 노이즈를 높은 주파수에서 낮게 스윕
    noise(0.14, 0.5, 2400, 420);
    tone("triangle", 640, 0.08, 0.12, 320);
  },
  hit() {
    noise(0.08, 0.55, 900, 180);
    tone("square", 220, 0.09, 0.3, 90);
  },
  spin() {
    noise(0.28, 0.5, 1800, 500);
    tone("sawtooth", 300, 0.25, 0.2, 700);
  },
  dash() {
    noise(0.22, 0.45, 3200, 600);
    tone("triangle", 180, 0.2, 0.25, 520);
  },
  hurt() {
    tone("sawtooth", 300, 0.18, 0.35, 110);
    noise(0.1, 0.3, 700, 200);
  },
  pickup() {
    tone("triangle", 660, 0.09, 0.35);
    tone("triangle", 880, 0.09, 0.35, undefined, 0.09);
    tone("triangle", 1320, 0.16, 0.35, undefined, 0.18);
  },
  questDone() {
    tone("triangle", 784, 0.12, 0.32);
    tone("triangle", 988, 0.12, 0.32, undefined, 0.12);
    tone("triangle", 1319, 0.22, 0.32, undefined, 0.24);
  },
  levelup() {
    [523, 659, 784, 1047].forEach((f, i) => tone("square", f, 0.13, 0.22, undefined, i * 0.1));
  },
  portal() {
    tone("sine", 300, 0.6, 0.3, 1200);
    noise(0.5, 0.2, 600, 2400);
  },
  roar() {
    tone("sawtooth", 90, 0.7, 0.5, 55);
    noise(0.6, 0.35, 300, 90);
  },
  enemyDie() {
    noise(0.16, 0.4, 800, 150);
    tone("square", 260, 0.14, 0.2, 60);
  },
  bossDie() {
    tone("sawtooth", 200, 1.0, 0.5, 40);
    noise(0.9, 0.4, 500, 80);
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      tone("triangle", f, 0.3, 0.25, undefined, 0.7 + i * 0.13)
    );
  },
};

/* ---------- BGM (경량 스케줄러) ---------- */

const N: Record<string, number> = {
  C3: 130.8, D3: 146.8, E3: 164.8, F3: 174.6, G3: 196, A3: 220, B3: 246.9,
  C4: 261.6, D4: 293.7, E4: 329.6, F4: 349.2, G4: 392, A4: 440, B4: 493.9,
  C5: 523.3, D5: 587.3, E5: 659.3, G5: 784, A5: 880,
};

// [멜로디, 베이스] 16스텝 루프
const FIELD: [number, number][] = [
  [N.C5, N.C3], [N.E5, 0], [N.G4, N.G3], [N.C5, 0],
  [N.A4, N.A3], [N.C5, 0], [N.G4, N.G3], [N.E5, 0],
  [N.F4, N.F3], [N.A4, 0], [N.C5, N.C3], [N.A4, 0],
  [N.G4, N.G3], [N.B4, 0], [N.D5, N.G3], [N.G4, 0],
];

const BOSS: [number, number][] = [
  [N.A4, N.A3], [N.C5, N.A3], [N.B4, N.G3], [N.A4, N.G3],
  [N.E5, N.A3], [N.D5, N.F3], [N.C5, N.E3], [N.B4, N.E3],
  [N.A4, N.A3], [N.C5, N.A3], [N.E5, N.F3], [N.D5, N.G3],
  [N.C5, N.A3], [N.B4, N.B3], [N.G4, N.E3], [N.A4, N.A3],
];

const TITLE: [number, number][] = [
  [N.C5, N.C3], [N.G4, 0], [N.E5, N.G3], [0, 0],
  [N.D5, N.D3], [N.G4, 0], [N.B4, N.D3], [0, 0],
  [N.C5, N.C3], [N.E5, 0], [N.G5, N.C4], [0, 0],
  [N.A4, N.F3], [N.G4, 0], [N.E4, N.G3], [0, 0],
];

export function playBGM(kind: "field" | "boss" | "title") {
  if (bgmPattern === kind && bgmTimer !== null) return;
  stopBGM();
  bgmPattern = kind;
  if (muted || !ctx) return;
  const table = kind === "field" ? FIELD : kind === "boss" ? BOSS : TITLE;
  const stepMs = kind === "boss" ? 150 : kind === "field" ? 190 : 230;
  bgmStep = 0;
  bgmTimer = window.setInterval(() => {
    if (!ctx || muted) return;
    const [mel, bass] = table[bgmStep % table.length];
    if (mel) tone(kind === "boss" ? "square" : "triangle", mel, stepMs / 1000 * 0.9, 0.2);
    if (bass) tone("sine", bass, (stepMs / 1000) * 1.4, 0.24);
    if (kind === "boss" && bgmStep % 4 === 0) noise(0.05, 0.16, 4000, 2000); // 하이햇 느낌
    bgmStep++;
  }, stepMs);
}

export function stopBGM() {
  if (bgmTimer !== null) {
    window.clearInterval(bgmTimer);
    bgmTimer = null;
  }
}
