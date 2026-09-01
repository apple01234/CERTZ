'use client';
// 아뜰란티스 — WebAudio 신디사이저 SFX (파일 없이 생성)
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
    } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setSfxEnabled(v:boolean){ enabled = v; if(master) master.gain.value = v?0.22:0; }
export function sfxEnabled(){ return enabled; }

function tone(freq:number, dur:number, type:OscillatorType='square', vol=0.5, slide=0, delay=0){
  const c = ac(); if(!c||!master||!enabled) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide), t0+dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0+dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0+dur+0.02);
}

function noise(dur:number, vol=0.4, delay=0, lp=1200){
  const c = ac(); if(!c||!master||!enabled) return;
  const t0 = c.currentTime + delay;
  const len = Math.max(1, Math.floor(c.sampleRate*dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for(let i=0;i<len;i++) data[i] = (Math.random()*2-1)*(1-i/len);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type='lowpass'; f.frequency.value = lp;
  const g = c.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0);
}

export const sfx = {
  hit(){ noise(0.08, 0.5, 0, 2400); tone(180, 0.06, 'square', 0.25, -60); },
  crit(){ noise(0.12, 0.6, 0, 3200); tone(320, 0.1, 'square', 0.3, -160); },
  hurt(){ tone(160, 0.18, 'sawtooth', 0.35, -90); },
  shoot(){ tone(700, 0.08, 'square', 0.2, -350); },
  pulse(){ tone(400, 0.25, 'sine', 0.3, 300); },
  pickup(){ tone(660, 0.07, 'square', 0.3); tone(880, 0.1, 'square', 0.3, 0, 0.07); },
  gold(){ tone(988, 0.05, 'square', 0.25); tone(1319, 0.08, 'square', 0.25, 0, 0.05); },
  potion(){ tone(500, 0.1, 'sine', 0.3, 200); tone(700, 0.15, 'sine', 0.3, 200, 0.1); },
  levelup(){ [523,659,784,1047].forEach((f,i)=>tone(f,0.12,'square',0.3,0,i*0.09)); },
  relic(){ [392,523,659,784,1047].forEach((f,i)=>tone(f,0.14,'triangle',0.32,0,i*0.08)); },
  gem(){ [784,988,1175,1568].forEach((f,i)=>tone(f,0.12,'sine',0.3,0,i*0.07)); },
  portal(){ tone(200, 0.5, 'sine', 0.3, 500); noise(0.4, 0.15, 0, 800); },
  boss(){ tone(80, 0.6, 'sawtooth', 0.5, -30); noise(0.5, 0.4, 0, 400); },
  die(){ tone(300, 0.5, 'sawtooth', 0.4, -260); },
  dialog(){ tone(600, 0.03, 'square', 0.15); },
  gate(){ tone(150, 0.3, 'sawtooth', 0.35, 100); noise(0.3, 0.25, 0, 600); },
  error(){ tone(220, 0.12, 'square', 0.3, -60); tone(180, 0.15, 'square', 0.3, -40, 0.1); },
  heal(){ tone(520, 0.12, 'sine', 0.3, 260); tone(780, 0.18, 'sine', 0.25, 260, 0.1); },
  step(){},
};
