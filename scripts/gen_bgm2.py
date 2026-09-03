#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v3.0.20 #10 — 신규 BGM 8트랙 절차 합성 (사용자: "브금좀 여러개 써(좋은걸로)")

기존 8종(bgm_field/boss/title/village/alfheim/cave/snow/abyss)에 1:1 대응하는
제2 변주 트랙 8종을 추가한다 — 같은 분위기, 다른 곡 (인게임에서 로테이션 재생).

작곕 설계 (곡마다 다른 키/진행/리듬 — 시드 고정 재현 가능):
  - 코드 진행 로마순표기 → 실제 화음, 4마디 단위 A/B 섹션 (AABB 루프)
  - 리드: 펄스 오실레이터 + 비브라토 + 피드백 딜레이, 모티프 반복+변형 (무작위 난사 방지)
  - 베이스: 서브 사인 + 톱니 혼합, 진행 루트 8분 워킹
  - 패드: 디튠 톱니 2중 + 1폴 LPF
  - 드럼: 킥(사인 피치드롭) / 스네어(노이즈+톤) / 햇(HP 노이즈) — 곡 성격별 패턴
  - 마스터: 소프트클립 + 루프 페이드, OGG(libvorbis q4) 인코딩
"""
import numpy as np
from scipy.signal import lfilter
import subprocess, os

SR = 44100
OUT = "/home/z/my-project/public/assets/audio"
os.makedirs(OUT, exist_ok=True)

# ---------- 음악 이론 유틸 ----------
MAJ = [0, 2, 4, 5, 7, 9, 11]
MIN = [0, 2, 3, 5, 7, 8, 10]

def scale_note(root, scale, degree, octave=0):
    """degree: 0-based 스케일 인덱스 (음역 넘기면 옥타브 자동)"""
    o = octave + (degree // len(scale))
    return root + scale[degree % len(scale)] + 12 * o

def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)

# ---------- 신스 보이스 ----------
def env(n, a, d, s, r, s_level=0.7):
    """ADSR (초 단위)"""
    a_i, d_i, r_i = int(a * SR), int(d * SR), int(r * SR)
    s_i = max(0, n - a_i - d_i - r_i)
    e = np.concatenate([
        np.linspace(0, 1, max(a_i, 1)),
        np.linspace(1, s_level, max(d_i, 1)),
        np.full(s_i, s_level),
        np.linspace(s_level, 0, max(r_i, 1)),
    ])
    if len(e) < n:
        e = np.pad(e, (0, n - len(e)))
    return e[:n]

def osc_pulse(freq, n, duty=0.5):
    t = np.arange(n) / SR
    return np.where((t * freq) % 1.0 < duty, 1.0, -1.0)

def osc_saw(freq, n):
    t = np.arange(n) / SR
    return 2.0 * ((t * freq) % 1.0) - 1.0

def osc_tri(freq, n):
    t = np.arange(n) / SR
    return 2.0 * np.abs(2.0 * ((t * freq) % 1.0) - 1.0) - 1.0

def lowpass(x, cutoff):
    """1폴 LPF"""
    rc = 1.0 / (2 * np.pi * cutoff)
    dt = 1.0 / SR
    alpha = dt / (rc + dt)
    y = lfilter([alpha], [1, alpha - 1], x)
    return y

def note_voice(freq, n, kind="pulse", vol=0.2, duty=0.4, a=0.005, d=0.08, s=0.6, r=0.1, vib=0.0, cutoff=None):
    t = np.arange(n) / SR
    f = freq * (1.0 + (vib * 0.006) * np.sin(2 * np.pi * 5.5 * t)) if vib > 0 else freq
    if kind == "pulse":
        x = osc_pulse(f, n, duty)
    elif kind == "saw":
        x = osc_saw(f, n)
    elif kind == "tri":
        x = osc_tri(f, n)
    else:
        x = np.sin(2 * np.pi * f * t)
    x *= env(n, a, d, s, r)
    if cutoff:
        x = lowpass(x, cutoff)
    return x * vol

def kick(n):
    t = np.arange(n) / SR
    f = 120 * np.exp(-t * 22) + 42
    ph = np.cumsum(2 * np.pi * f / SR)
    x = np.sin(ph) * np.exp(-t * 9)
    return x * 0.9

def snare(n):
    rng = np.random.default_rng(7)
    noise = rng.uniform(-1, 1, n)
    noise = lowpass(noise, 5200) - lowpass(noise, 900) * 0.6
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
    return (noise * np.exp(-t * 16) * 0.8 + tone * 0.35)

def hat(n, open_=False):
    rng = np.random.default_rng(11)
    noise = rng.uniform(-1, 1, n)
    noise = noise - lowpass(noise, 7500)
    t = np.arange(n) / SR
    return noise * np.exp(-t * (14 if open_ else 70)) * 0.35

# ---------- 시퀀서 ----------
def place(buf, start_i, sig, gain=1.0):
    i0 = start_i
    i1 = min(len(buf), i0 + len(sig))
    if i1 > i0:
        buf[i0:i1] += sig[: i1 - i0] * gain

def render_track(cfg):
    """cfg: dict(name, bpm, bars, root, scale, prog, prog_b, style)"""
    bpm = cfg["bpm"]
    beat = 60.0 / bpm
    sub = int(beat * SR / 4)  # 16분음표
    bars = cfg["bars"]
    total = int(bars * 4 * beat * SR)
    lead = np.zeros(total)
    bass = np.zeros(total)
    pad = np.zeros(total)
    arp = np.zeros(total)
    dr = np.zeros(total)
    scale = cfg["scale"]
    root = cfg["root"]
    st = cfg["style"]

    rng = np.random.default_rng(cfg.get("seed", 42))
    prog = cfg["prog"]
    prog_b = cfg.get("prog_b", prog)

    # 리드 모티프: A섹션 2마디 모티프 → 반복+꼬리 변형 (멜로디 일관성)
    def make_rhythm(bars_n, density):
        rh = []
        for b in range(bars_n * 8):
            p = density if b % 8 not in (3, 7) else density * 0.55
            if b % 8 == 0:
                rh.append(True)
            else:
                rh.append(rng.random() < p)
        return rh

    motif_deg = [rng.integers(0, 7) for _ in range(8)]
    motif_oct = [int(rng.integers(0, 3)) for _ in range(8)]

    def lead_section(chords, bars_n, motif, dens):
        rh = make_rhythm(bars_n, dens)
        step = 0
        for b in range(bars_n):
            ch = chords[b % len(chords)]
            for e in range(8):
                idx = b * 8 + e
                if not rh[idx]:
                    continue
                dur16 = 2 if (idx + 1 < len(rh) and not rh[idx + 1]) else 1
                n = int(sub * dur16 * 0.92)
                # 모티프 인덱스 순환 + 화음음 우선
                mi = step % len(motif)
                deg = motif[mi]
                if e in (0, 4):
                    deg = ch + (0 if rng.random() < 0.5 else 2)
                step += 1
                octv = motif_oct[mi % len(motif_oct)]
                midi = scale_note(root, scale, deg, octv)
                f = hz(midi)
                place(lead, idx * sub, note_voice(
                    f, n, kind=st["lead_kind"], vol=0.16, duty=st["lead_duty"],
                    a=0.006, d=0.09, s=0.55, r=0.09, vib=st.get("vib", 1),
                ))

    def pad_chord(ch, n):
        midi_r = scale_note(root, scale, ch, 4)
        third = scale_note(root, scale, ch + 2, 4)
        fifth = scale_note(root, scale, ch + 4, 4)
        out = np.zeros(n)
        for m, gv in ((midi_r, 1.0), (third, 0.8), (fifth, 0.7)):
            f = hz(m - 12)
            out += (osc_saw(f * 1.003, n) + osc_saw(f * 0.997, n)) * gv
        out = lowpass(out, st["pad_cut"])
        e = np.linspace(0, 1, min(n, int(0.12 * SR))) ** 2
        out[: len(e)] *= e
        tail = np.linspace(1, 0, min(n, int(0.18 * SR))) ** 1.5
        out[-len(tail):] *= tail
        return out * st["pad_vol"] / 2.5

    def bass_section(chords, bars_n, pattern):
        for b in range(bars_n):
            ch = chords[b % len(chords)]
            root_m = scale_note(root, scale, ch, 3)
            fifth_m = scale_note(root, scale, ch + 4, 3)
            for e, m, gv in pattern:
                idx = b * 8 + e
                if idx >= bars_n * 8:
                    continue
                f = hz(m == 5 and fifth_m or root_m)
                n = int(sub * (1.6 if e in (6, 7) else 0.92))
                x = note_voice(f, n, kind=st["bass_kind"], vol=st["bass_vol"], a=0.004, d=0.06, s=0.5, r=0.07, cutoff=420)
                place(bass, idx * sub, x, gv)

    def drums_section(bars_n, kit):
        for b in range(bars_n):
            for e, what in kit:
                idx = b * 8 + e
                n = int(sub * 1.2)
                if what == "K":
                    place(dr, idx * sub, kick(n), 0.95)
                elif what == "S":
                    place(dr, idx * sub, snare(n), 0.8)
                elif what == "H":
                    place(dr, idx * sub, hat(int(sub * 0.5)), 0.7)
                elif what == "O":
                    place(dr, idx * sub, hat(int(sub * 1.4), True), 0.6)

    def arp_section(chords, bars_n):
        for b in range(bars_n):
            ch = chords[b % len(chords)]
            for e in range(8):
                deg = ch + (0, 2, 4, 2)[e % 4] + (1 if e >= 4 else 0)
                midi = scale_note(root, scale, deg, 5)
                n = int(sub * 0.8)
                place(arp, (b * 8 + e) * sub, note_voice(hz(midi), n, kind="tri", vol=st["arp_vol"], a=0.003, d=0.05, s=0.3, r=0.08))

    half = bars // 2
    rest = bars - half
    A, A2 = prog, prog
    B = prog_b
    secs = [(A, half), (A2, half // 2), (B, rest - half // 2)]
    dens = st["mel_dens"]
    off = 0
    for chords, bn in secs:
        lead_section(chords, bn, motif_deg, dens)
        off += bn

    # 베이스/드럼/패드/아르페지오 — A/A2/B 전체
    all_chords = []
    for chords, bn in secs:
        all_chords += [chords[i % len(chords)] for i in range(bn)]
    nbars = len(all_chords)
    bass_section(all_chords, nbars, st["bass_pat"])
    drums_section(nbars, st["kit"])
    for b, ch in enumerate(all_chords):
        place(pad, b * 8 * sub, pad_chord(ch, 8 * sub))
    if st.get("arp_vol", 0):
        arp_section(all_chords, nbars)

    # ---------- 믹스 ----------
    # 리드 딜레이 (3/16 피드백)
    d_i = int(sub * 3)
    dl = lead.copy()
    dl[d_i:] += lead[:-d_i] * 0.32
    dl[2 * d_i:] += lead[:-2 * d_i] * 0.13

    mix = lead * 0 + dl + bass + pad + arp + dr
    # 스테레오 (햐스 확장: 패드/아르페지오 ±12ms)
    off_i = int(0.012 * SR)
    padw = np.zeros(total + off_i)
    padw[off_i:] += pad
    padw[:-off_i] += arp * 0.9
    left = dl + bass * 1.02 + padw[:total] * 0.5 + dr
    right = dl * 0.96 + bass + padw[off_i:off_i + total] * 0.5 + dr * 0.94

    # 소프트 클립 + 정규화
    for chn in (left, right):
        peak = np.max(np.abs(chn)) or 1.0
        chn /= peak * 1.15
        np.tanh(chn * 1.25, out=chn)
        chn *= 0.85
    stereo = np.stack([left, right], axis=1)
    # 루프 페이드 (15ms)
    f = int(0.015 * SR)
    ramp = np.linspace(0, 1, f)[:, None]
    stereo[:f] *= ramp
    stereo[-f:] *= ramp[::-1]
    return stereo

# ---------- 스타일 테이블 ----------
P4 = 4  # 4분음표 = 8개 16분

TRACKS = [
    dict(name="bgm_title2", bpm=118, bars=32, root=57, scale=MAJ,
         prog=[0, 4, 5, 3], prog_b=[3, 4, 0, 5], seed=201,
         style=dict(lead_kind="pulse", lead_duty=0.42, vib=1, pad_cut=1600, pad_vol=0.30,
                    bass_kind="saw", bass_vol=0.30, mel_dens=0.62, arp_vol=0.10,
                    bass_pat=[(0, 1, 1.0), (3, 1, 0.7), (4, 5, 0.8), (6, 1, 0.75)],
                    kit=[(0, "K"), (2, "H"), (4, "S"), (6, "H"), (7, "H")])),
    dict(name="bgm_field2", bpm=132, bars=32, root=62, scale=MAJ,
         prog=[0, 5, 3, 4], prog_b=[5, 3, 4, 0], seed=202,
         style=dict(lead_kind="pulse", lead_duty=0.36, vib=1, pad_cut=1800, pad_vol=0.26,
                    bass_kind="saw", bass_vol=0.32, mel_dens=0.68, arp_vol=0.12,
                    bass_pat=[(0, 1, 1.0), (2, 1, 0.6), (4, 5, 0.85), (5, 1, 0.6), (6, 1, 0.7), (7, 5, 0.6)],
                    kit=[(0, "K"), (1, "H"), (2, "H"), (4, "S"), (5, "H"), (6, "H"), (7, "O")])),
    dict(name="bgm_boss2", bpm=152, bars=32, root=50, scale=MIN,
         prog=[0, 0, 5, 4], prog_b=[0, 3, 4, 4], seed=203,
         style=dict(lead_kind="pulse", lead_duty=0.25, vib=1, pad_cut=1400, pad_vol=0.24,
                    bass_kind="saw", bass_vol=0.40, mel_dens=0.72, arp_vol=0.14,
                    bass_pat=[(0, 1, 1.0), (1, 1, 0.55), (2, 1, 0.8), (3, 1, 0.55), (4, 5, 0.85), (5, 1, 0.55), (6, 1, 0.8), (7, 1, 0.6)],
                    kit=[(0, "K"), (2, "S"), (3, "H"), (4, "K"), (6, "S"), (7, "O")])),
    dict(name="bgm_village2", bpm=96, bars=24, root=60, scale=MAJ,
         prog=[0, 3, 4, 4], prog_b=[0, 4, 3, 4], seed=204,
         style=dict(lead_kind="tri", lead_duty=0.5, vib=2, pad_cut=1300, pad_vol=0.30,
                    bass_kind="sine", bass_vol=0.30, mel_dens=0.5, arp_vol=0.16,
                    bass_pat=[(0, 1, 1.0), (4, 5, 0.8), (6, 1, 0.6)],
                    kit=[(0, "K"), (4, "S"), (2, "H"), (6, "H")])),
    dict(name="bgm_alfheim2", bpm=88, bars=24, root=64, scale=MAJ,
         prog=[0, 2, 5, 4], prog_b=[2, 0, 4, 5], seed=205,
         style=dict(lead_kind="tri", lead_duty=0.5, vib=2, pad_cut=1200, pad_vol=0.34,
                    bass_kind="sine", bass_vol=0.26, mel_dens=0.45, arp_vol=0.20,
                    bass_pat=[(0, 1, 1.0), (4, 1, 0.7), (6, 5, 0.6)],
                    kit=[(0, "K"), (4, "S"), (2, "H"), (5, "H"), (6, "H"), (7, "O")])),
    dict(name="bgm_cave2", bpm=100, bars=24, root=50, scale=MIN,
         prog=[0, 5, 2, 4], prog_b=[0, 2, 5, 5], seed=206,
         style=dict(lead_kind="pulse", lead_duty=0.3, vib=2, pad_cut=900, pad_vol=0.30,
                    bass_kind="saw", bass_vol=0.34, mel_dens=0.42, arp_vol=0.12,
                    bass_pat=[(0, 1, 1.0), (3, 1, 0.6), (6, 1, 0.7)],
                    kit=[(0, "K"), (4, "S"), (2, "H"), (7, "H")])),
    dict(name="bgm_snow2", bpm=76, bars=24, root=65, scale=MAJ,
         prog=[0, 3, 5, 4], prog_b=[3, 0, 4, 5], seed=207,
         style=dict(lead_kind="tri", lead_duty=0.5, vib=2, pad_cut=1400, pad_vol=0.36,
                    bass_kind="sine", bass_vol=0.24, mel_dens=0.4, arp_vol=0.22,
                    bass_pat=[(0, 1, 1.0), (4, 5, 0.7)],
                    kit=[(0, "K"), (4, "H"), (2, "H"), (6, "H"), (7, "O")])),
    dict(name="bgm_abyss2", bpm=86, bars=24, root=45, scale=MIN,
         prog=[0, 1, 5, 4], prog_b=[0, 5, 1, 4], seed=208,
         style=dict(lead_kind="saw", lead_duty=0.5, vib=2, pad_cut=700, pad_vol=0.32,
                    bass_kind="saw", bass_vol=0.38, mel_dens=0.38, arp_vol=0.10,
                    bass_pat=[(0, 1, 1.0), (2, 1, 0.6), (4, 1, 0.8), (6, 5, 0.6)],
                    kit=[(0, "K"), (4, "S"), (6, "H")])),
]

for i, cfg in enumerate(TRACKS):
    print(f"[{i+1}/{len(TRACKS)}] {cfg['name']} 합성중…", flush=True)
    audio = render_track(cfg)
    wav_path = f"/tmp/{cfg['name']}.wav"
    import wave
    pcm = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
    with wave.open(wav_path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    ogg_path = f"{OUT}/{cfg['name']}.ogg"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav_path,
                    "-c:a", "libvorbis", "-q:a", "4", ogg_path], check=True)
    sz = os.path.getsize(ogg_path) / 1024 / 1024
    dur = len(audio) / SR
    print(f"  → {ogg_path} {sz:.1f}MB {dur:.1f}s", flush=True)

print("ALL BGM DONE")
