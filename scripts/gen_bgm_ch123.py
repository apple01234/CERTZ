# -*- coding: utf-8 -*-
"""v1.0.2-beta — 초반 1·2·3챕터 BGM 교체 (유저 지시 "초반 1,2,3챕터 브금이 별로야. 바꿔")
기존 Kevin MacLeod 트랙 3곡을 SERTZ 오리지널 합성 음원으로 교체한다.
  bgm_village1.ogg — 제1장 미드가르드 항구 마을 (D장조 96bpm, 따뜻한 목가적 테마)
  bgm_field1.ogg   — 제2장 숲의 신전 필드   (A단조 124bpm, 모험 행진곡)
  bgm_title2.ogg   — 제3장 쿠소디아 왕국    (F장조 100bpm, 위엄의 왕국 테마)
같은 파일명 덮어쓰기 → audio.ts 코드 수정 불필요(BOSS_OF 주석의 "같은 파일명 교체" 관례 계승).
합성: numpy 순수 합성(Karplus-Strong 하프·플루트·스트링·브라스·쿠아이어·드럼) + 원형 루프 무결 설계.
"""
import numpy as np
import subprocess, os, wave

SR = 48000
OUT = "/home/z/my-project/public/assets/audio"
rng = np.random.default_rng(20261004)

def m2f(m): return 440.0 * 2 ** ((m - 69) / 12)

def fftlp(x, cutoff, sr=SR):
    """FFT 저역통과 — 노트 단위라 FFT 비용 무시 가능"""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / sr)
    g = 1.0 / (1.0 + (f / max(cutoff, 1)) ** 4)  # 4차 버터워스 응답 근사
    return np.fft.irfft(X * g, len(x))

def fftbp(x, lo, hi, sr=SR):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / sr)
    g = (1 / (1 + (lo / np.maximum(f, 1)) ** 4)) * (1 / (1 + (f / max(hi, 1)) ** 4))
    return np.fft.irfft(X * g, len(x))

def adsr(n, a, d, s, r, sl=0.8):
    e = np.zeros(n)
    ai, di, ri = int(a * SR), int(d * SR), int(r * SR)
    ai, di = min(ai, n), min(di, max(n - ai, 1))
    e[:ai] = np.linspace(0, 1, max(ai, 1))
    e[ai:ai + di] = np.linspace(1, sl, di)[:max(0, min(di, n - ai))]
    rest = max(0, n - ai - di)
    e[ai + di:ai + di + rest] = sl
    if ri > 0 and rest > 0:
        e[-ri:] *= np.linspace(1, 0, ri)
    return e

def tone(freq, dur, wave="tri", vib=0.004, vibHz=5.2, a=0.02, d=0.1, s=0.8, r=0.15, lp=4200, blend=None):
    """리드 음색 — 비브라토 위상 적분 + FFT LP"""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = freq * (1 + vib * np.sin(2 * np.pi * vibHz * tt) * np.minimum(1, tt / 0.22))
    ph = 2 * np.pi * np.cumsum(f) / SR
    if wave == "tri":
        w = 2 / np.pi * np.arcsin(np.sin(ph))
    elif wave == "saw":
        w = 2 * ((ph / (2 * np.pi)) % 1) - 1
    elif wave == "sq":
        w = np.sign(np.sin(ph))
    else:
        w = np.sin(ph)
    if blend == "string":  # 부드러운 앙상블 — saw+tri 믹스
        w = 0.55 * w + 0.45 * (2 / np.pi * np.arcsin(np.sin(ph + 0.7)))
    e = adsr(n, a, d, s, r)
    return fftlp(w * e, lp)

def pluck(freq, dur, damp=0.9965):
    """Karplus-Strong 하프/루트 — 벡터화(주기 블록 반복)"""
    N = max(2, int(SR / freq)); n = int(dur * SR)
    reps = n // N + 2
    b = rng.uniform(-1, 1, N)
    b = np.convolve(b, [0.6, 0.4], mode="same")  # 순한 여기
    out = np.empty(reps * N)
    for r in range(reps):
        out[r * N:(r + 1) * N] = b
        b = damp * 0.5 * (b + np.roll(b, -1))
    return out[:n] * np.exp(-np.arange(n) / SR * 0.6)

def pad_tone(freq, dur, lp=1500, a=0.55, r=0.8):
    """따뜻한 패드 — 디튠 saw 3중"""
    n = int(dur * SR); tt = np.arange(n) / SR
    w = np.zeros(n)
    for det in (1.0, 1.0035, 0.9965):
        ph = 2 * np.pi * freq * det * tt
        w += (2 * ((ph / (2 * np.pi)) % 1) - 1) / 3
    e = np.minimum(1, tt / a)
    e *= np.minimum(1, np.maximum(0, (dur - tt) / r))
    return fftlp(w * e, lp)

def choir(freq, dur, a=0.6, r=0.7):
    """아- 성부 — 배음 스택 + 슬로우 비브라토"""
    n = int(dur * SR); tt = np.arange(n) / SR
    f = freq * (1 + 0.006 * np.sin(2 * np.pi * 4.3 * tt))
    ph = 2 * np.pi * np.cumsum(f) / SR
    w = np.sin(ph) + 0.45 * np.sin(2 * ph) + 0.2 * np.sin(3 * ph) + 0.08 * np.sin(4 * ph)
    e = np.minimum(1, tt / a) * np.minimum(1, np.maximum(0, (dur - tt) / r))
    return fftlp(w * e, 2100)

def bass(freq, dur, a=0.008):
    n = int(dur * SR); tt = np.arange(n) / SR
    w = np.sin(2 * np.pi * freq * tt) * 0.8 + (2 / np.pi * np.arcsin(np.sin(2 * np.pi * freq * tt))) * 0.25
    e = np.exp(-tt * 1.1) * np.minimum(1, tt / a)
    e[-int(0.05 * SR):] *= np.linspace(1, 0, int(0.05 * SR))
    return fftlp(w * e, 900)

def kick(dur=0.22):
    n = int(dur * SR); tt = np.arange(n) / SR
    f = 130 * np.exp(-tt * 16) + 46
    w = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 13)
    w += (rng.uniform(-1, 1, n)) * np.exp(-tt * 90) * 0.4
    return fftlp(w, 3000)

def snare(dur=0.18):
    n = int(dur * SR); tt = np.arange(n) / SR
    noise = fftbp(rng.uniform(-1, 1, n), 1100, 7000) * np.exp(-tt * 21)
    tone = np.sin(2 * np.pi * 190 * tt) * np.exp(-tt * 30) * 0.5
    return (noise + tone) * np.minimum(1, tt / 0.002)

def hat(dur=0.06):
    n = int(dur * SR); tt = np.arange(n) / SR
    return fftbp(rng.uniform(-1, 1, n), 7000, 16000) * np.exp(-tt * 60)

def cymbal(dur=1.1):
    n = int(dur * SR); tt = np.arange(n) / SR
    return fftbp(rng.uniform(-1, 1, n), 4500, 15000) * np.exp(-tt * 3.2)

def tamb(dur=0.13):
    n = int(dur * SR); tt = np.arange(n) / SR
    return fftbp(rng.uniform(-1, 1, n), 5500, 14000) * np.exp(-tt * 24)

# ── 화음 사전 (root midi + 트라이어드/7th) ──
CH = {
    "D": [50, 54, 57], "Bm": [47, 50, 54], "G": [43, 47, 50], "A": [45, 49, 52],
    "A7": [45, 49, 52, 55], "Em": [40, 43, 47], "Am": [45, 48, 52], "F": [41, 45, 48],
    "C": [48, 52, 55], "E": [40, 44, 47], "E7": [40, 44, 47, 50], "Dm": [38, 41, 45],
    "Bb": [46, 50, 53], "Gm": [43, 46, 50], "C7": [48, 52, 55, 58], "Csus": [48, 53, 55],
}
ROOT = {  # 베이스 루트(낮은 옥타브)
    "D": 38, "Bm": 35, "G": 31, "A": 33, "A7": 33, "Em": 28, "Am": 33, "F": 29,
    "C": 36, "E": 28, "E7": 28, "Dm": 26, "Bb": 34, "Gm": 31, "C7": 36, "Csus": 36,
}

class Loop:
    """원형 버퍼 — 테일이 끝을 넘으면 처음으로 이어붙는다(완전 무결 루프)"""
    def __init__(self, dur):
        self.n = int(dur * SR)
        self.L = np.zeros(self.n); self.R = np.zeros(self.n)
    def place(self, start, sig, gain=1.0, pan=0.0):
        gl = np.sqrt(max(0.0, 1 - pan)) * 1.15
        gr = np.sqrt(max(0.0, 1 + pan)) * 1.15
        gl = min(gl, 1.6); gr = min(gr, 1.6)
        s = sig * gain
        i = int(start * SR) % self.n
        end = i + len(s)
        if end <= self.n:
            self.L[i:end] += s * gl; self.R[i:end] += s * gr
        else:
            k = self.n - i
            self.L[i:] += s[:k] * gl; self.R[i:] += s[:k] * gr
            self.L[: end - self.n] += s[k:] * gl; self.R[: end - self.n] += s[k:] * gr
    def reverb(self, wet=0.16, tail=1.15):
        """원형 합성곱 리버브 — FFT 길이=루프 길이 → 테일이 루프 앞으로 감김(무결)"""
        n = self.n
        ir_n = int(tail * SR); tt = np.arange(ir_n) / SR
        ir = rng.uniform(-1, 1, ir_n) * np.exp(-tt * 4.2)
        ir[0] = 0
        for ch in (self.L, self.R):
            dry = ch.copy()
            conv = np.fft.irfft(np.fft.rfft(ch) * np.fft.rfft(ir, n), n)
            ch[:] = dry + conv * wet * 8.0
    def master(self):
        for ch in (self.L, self.R):
            peak = max(float(np.max(np.abs(ch))), 1e-9)
            ch *= 0.35 / peak          # 프리클립 정규화 (헤드룸 확보 — 과포화 방지)
            np.tanh(ch * 1.35, out=ch)  # 부드러운 글루 컴프레션
            ch /= max(float(np.max(np.abs(ch))), 1e-9) / 0.85  # 최종 피크 −1.4dBFS
    def save(self, path):
        pcm = np.stack([self.L, self.R], axis=1)
        pcm = (np.clip(pcm, -1, 1) * 32767).astype(np.int16)
        with wave.open(path + ".wav", "wb") as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes(pcm.tobytes())
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", path + ".wav",
                        "-c:a", "libvorbis", "-q:a", "4", "-ar", "48000", path], check=True)
        os.remove(path + ".wav")

# ═══ 곡 1 — 제1장 마을 (D장조 96bpm 32마디) ═══
def village():
    bpm, spb = 96, 60 / 96
    bars, len_s = 32, 32 * 4 * spb
    L = Loop(len_s)
    prog = ["D", "Bm", "G", "A", "D", "Bm", "G", "A",
            "G", "D", "Em", "A", "G", "D", "Em", "A",
            "D", "Bm", "G", "A", "D", "Bm", "G", "A",
            "Bm", "G", "D", "A", "Bm", "G", "Em", "A"]
    # 멜로디 (비트, 길이, midi)
    mel = [(0,1,66),(1,1,67),(2,2,74),(4,2,71),(6,2,69),(8,1,67),(9,1,69),(10,2,71),(12,3,69),
           (16,1,66),(17,1,67),(18,2,69),(20,2,71),(22,2,69),(24,1,67),(25,1,69),(26,1,71),(27,1,74),(28,4,73),
           (32,2,74),(34,2,71),(36,2,69),(38,2,66),(40,1,67),(41,1,69),(42,2,71),(44,3,73),(47,1,76),
           (48,2,74),(50,2,73),(52,2,71),(54,2,69),(56,1,71),(57,1,73),(58,2,76),(60,4,69),
           (64,1,66),(65,1,67),(66,2,69),(68,2,71),(70,2,69),(72,1,67),(73,1,69),(74,2,71),(76,4,74)]
    for b, d, m in mel:  # 플루트 리드
        L.place(b * spb, tone(m2f(m), d * spb * 0.95, wave="sine", vib=0.005, vibHz=5.4,
                              a=0.03, d=0.1, s=0.85, r=0.18, lp=3600), 0.30, pan=0.12)
        if b >= 64:  # 마지막 프레이즈 옥타브 더블링
            L.place(b * spb, tone(m2f(m - 12), d * spb * 0.95, wave="tri", lp=2500), 0.12, pan=-0.15)
    for i, ch in enumerate(prog):  # 하프 아르페지오 + 패드 + 베이스
        st = i * 4 * spb
        notes = CH[ch]
        seq = [0, 1, 2, 1, 0, 1, 2, 1] if i % 8 < 6 else [0, 1, 2, 3 if len(notes) > 3 else 2, 2, 1, 0, 1]
        for k, idx in enumerate(seq):
            m = notes[idx % len(notes)] + 12
            L.place(st + k * 0.5 * spb, pluck(m2f(m), 0.6 * spb), 0.16 if i >= 24 else 0.11, pan=(-0.3 if k % 2 else 0.3))
        L.place(st, pad_tone(m2f(notes[0]), 4 * spb, lp=1200), 0.075)
        L.place(st, bass(m2f(ROOT[ch]), 2 * spb), 0.34)
        L.place(st + 2 * spb, bass(m2f(ROOT[ch] + 7), 2 * spb), 0.22)
    for i in range(bars):  # 부드러운 탬버린 + 킥
        st = i * 4 * spb
        L.place(st + 1 * spb, tamb(), 0.11); L.place(st + 3 * spb, tamb(), 0.11)
        L.place(st, kick(), 0.14); L.place(st + 2 * spb, kick(), 0.10)
    L.reverb(0.17); L.master()
    L.save(f"{OUT}/bgm_village1.ogg")
    return len_s

# ═══ 곡 2 — 제2장 숲의 신전 필드 (A단조 124bpm 32마디) ═══
def field():
    bpm, spb = 124, 60 / 124
    bars, len_s = 32, 32 * 4 * spb
    L = Loop(len_s)
    prog = ["Am", "F", "C", "G", "Am", "F", "Em", "E",
            "F", "G", "Am", "Am", "F", "G", "E7", "Am",
            "Am", "F", "C", "G", "Am", "F", "Em", "E",
            "Dm", "Am", "Dm", "F", "E7", "E7", "Dm", "E"]
    mel = [(0,1,76),(1,1,74),(2,1.5,72),(3.5,.5,74),(4,2,72),(6,2,69),(8,1,67),(9,1,69),(10,2,72),(12,2,74),(14,2,76),
           (16,1,76),(17,1,79),(18,2,76),(20,2,74),(22,2,72),(24,2,71),(26,2,68),(28,4,69),
           (32,2,77),(34,2,76),(36,2,74),(38,2,72),(40,1,76),(41,1,74),(42,1,72),(43,1,74),(44,4,76),
           (48,2,77),(50,2,79),(52,3,81),(55,1,79),(56,2,76),(58,1,74),(59,1,71),(60,4,69),
           (64,1,76),(65,1,74),(66,1.5,72),(67.5,.5,74),(68,2,72),(70,2,69),(72,1,67),(73,1,69),(74,2,72),(76,2,74),(78,2,76),
           (96,2,76),(98,2,77),(100,2,76),(102,2,74),(104,2,72),(106,2,71),(108,3,69),(111,1,64),(112,4,69)]
    for b, d, m in mel:  # 스트링 리드
        L.place(b * spb, tone(m2f(m), d * spb * 0.92, wave="saw", blend="string", vib=0.005,
                              a=0.04, d=0.1, s=0.8, r=0.12, lp=2600), 0.26, pan=0.1)
    horn = [(32,4,53),(36,4,57),(40,4,53),(44,4,50),(48,4,53),(52,4,57),(56,4,50),(60,4,52),
            (96,8,45),(104,8,48),(112,4,52),(116,4,50),(120,8,52)]  # B섹션+브릿지 호른 카운터
    for b, d, m in horn:
        L.place(b * spb, tone(m2f(m), d * spb * 0.95, wave="sq", a=0.12, s=0.7, r=0.2, lp=900), 0.13, pan=-0.22)
    for i, ch in enumerate(prog):  # 드라이빙 베이스(8분) + 패드
        st = i * 4 * spb; root = ROOT[ch]
        for k in range(8):
            m = root if k % 4 != 3 else root + 12
            L.place(st + k * 0.5 * spb, bass(m2f(m), 0.45 * spb), 0.20 if k % 2 == 0 else 0.13)
        L.place(st, pad_tone(m2f(CH[ch][0]), 4 * spb, lp=1100), 0.06)
    for i in range(bars):  # 행진 드럼 + 구역 말미 필
        st = i * 4 * spb
        L.place(st, kick(), 0.30); L.place(st + 2 * spb, kick(), 0.24)
        L.place(st + 1 * spb, snare(), 0.22); L.place(st + 3 * spb, snare(), 0.22)
        for k in range(8):
            L.place(st + k * 0.5 * spb, hat(), 0.085 if k % 2 == 0 else 0.05)
        if i % 8 == 7:
            for k in range(4):
                L.place(st + 3 * spb + k * 0.25 * spb, snare(0.1), 0.14)
    L.reverb(0.14); L.master()
    L.save(f"{OUT}/bgm_field1.ogg")
    return len_s

# ═══ 곡 3 — 제3장 쿠소디아 왕국 (F장조 100bpm 32마디) ═══
def kingdom():
    bpm, spb = 100, 60 / 100
    bars, len_s = 32, 32 * 4 * spb
    L = Loop(len_s)
    prog = ["F", "C", "Dm", "Bb", "F", "Bb", "C", "C7",
            "Bb", "F", "Gm", "C", "Bb", "Gm", "Csus", "C7",
            "F", "C", "Dm", "Bb", "F", "Bb", "C", "C7",
            "Dm", "Bb", "Gm", "C", "Dm", "Bb", "Csus", "C7"]
    mel = [(0,1,72),(1,1,74),(2,1,72),(3,1,69),(4,2,67),(6,2,69),(8,1,65),(9,1,67),(10,2,69),(12,3,70),(15,1,69),
           (16,1,65),(17,1,69),(18,2,72),(20,2,74),(22,2,72),(24,1,70),(25,1,72),(26,2,74),(28,4,72),
           (32,2,74),(34,2,72),(36,2,69),(38,2,72),(40,1,70),(41,1,72),(42,2,74),(44,2,76),(46,2,77),
           (48,3,77),(51,1,76),(52,2,74),(54,2,72),(56,2,70),(58,2,67),(60,4,69),
           (64,1,72),(65,1,74),(66,1,72),(67,1,69),(68,2,67),(70,2,69),(72,1,65),(73,1,67),(74,2,69),(76,3,70),(79,1,72),
           (96,2,74),(98,2,72),(100,2,74),(102,2,76),(104,2,74),(106,2,72),(108,2,70),(110,2,69),(112,4,70)]
    for b, d, m in mel:  # 브라스 리드
        L.place(b * spb, tone(m2f(m), d * spb * 0.94, wave="saw", vib=0.003, vibHz=4.6,
                              a=0.06, d=0.08, s=0.85, r=0.14, lp=2800), 0.30, pan=0.08)
        if b >= 64:  # A' 옥타브 더블 — 위엄 강조
            L.place(b * spb, tone(m2f(m + 12), d * spb * 0.94, wave="saw", a=0.06, lp=3200), 0.10, pan=-0.12)
    for i, ch in enumerate(prog):  # 쿠아이어 패드 + 튜바 베이스
        st = i * 4 * spb; notes = CH[ch]
        L.place(st, choir(m2f(notes[0] + 12), 4 * spb), 0.085)
        L.place(st, choir(m2f(notes[1] + 12), 4 * spb), 0.06, pan=0.25)
        L.place(st, bass(m2f(ROOT[ch]), 3 * spb), 0.30)
        L.place(st + 3 * spb, bass(m2f(ROOT[ch]), 1 * spb), 0.20)
    for i in range(bars):  # 행진 드럼 + 섹션 시작 심벌
        st = i * 4 * spb
        L.place(st, kick(), 0.30); L.place(st + 2 * spb, kick(), 0.22)
        L.place(st + 1 * spb, snare(), 0.24); L.place(st + 3 * spb, snare(), 0.24)
        if i % 8 == 0:
            L.place(st, cymbal(), 0.10)
        if i > 0:
            for k in range(4):  # 스네어 롤 → 다음 마디 다운비트로 이어짐
                L.place(st + (3 + k * 0.25) * spb, snare(0.09), 0.09)
    L.reverb(0.20); L.master()
    L.save(f"{OUT}/bgm_title2.ogg")
    return len_s

if __name__ == "__main__":
    import sys
    os.makedirs(OUT, exist_ok=True)
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    if which in ("all", "village"):
        print(f"village {village():.1f}s 생성 완료")
    if which in ("all", "field"):
        print(f"field {field():.1f}s 생성 완료")
    if which in ("all", "kingdom"):
        print(f"kingdom {kingdom():.1f}s 생성 완료")
    for f in ("bgm_village1.ogg", "bgm_field1.ogg", "bgm_title2.ogg"):
        p = f"{OUT}/{f}"
        if os.path.exists(p):
            print(f, os.path.getsize(p), "bytes")
