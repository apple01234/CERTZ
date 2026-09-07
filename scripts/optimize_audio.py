#!/usr/bin/env python3
# scripts/optimize_audio.py — v4.1.6 성능 최적화 Phase 2 (보고서 3.2 개선안 ②)
#  - BGM 40트랙: libvorbis -q:a 2 (보고서 권장 96kbps 상당, 원본 sr/ch 유지)
#  - SFX 12종 (sfx_*): 모노 -q:a 3 (기존 스테레오 ~377kbps PCM급 → 모노)
#  - skl_* 27종: 유지 (이미 모노 ~89kbps)
#  - 2-step WAV 경유: 소스 OGG의 비정상 DTS(iTunes 인코딩)로 ffmpeg muxer 큐가
#    무한 누적 → OOM SIGKILL 되는 문제 회피 (실측: 직접 인코딩 시 3.3s CPU 지점 사망)
#  - 재개 가능: scripts/_a2b/ 출력이 존재하면 스킵. 검증(디코드+길이 ±0.6s) 통과분만 반영.
import subprocess, os, sys, glob, json

AUD = "/home/z/my-project/public/assets/audio"
TMP = "/home/z/my-project/scripts/_a2b"
STATE = f"{TMP}/state.json"
os.makedirs(TMP, exist_ok=True)

def sh(args):
    r = subprocess.run(args, capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        raise RuntimeError(f"FAIL {' '.join(args[:6])}: {r.stderr[-400:]}")

def dur(p):
    r = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p],
                       capture_output=True, text=True)
    return float(r.stdout.strip())

done = {}
if os.path.exists(STATE):
    done = json.load(open(STATE))

bgm = sorted(glob.glob(f"{AUD}/bgm_*.ogg"))
sfx = sorted(glob.glob(f"{AUD}/sfx_*.ogg"))
rows = []
for p in bgm + sfx:
    name = os.path.basename(p)
    if name in done:
        rows.append((name, done[name][0], done[name][1]))
        continue
    b = os.path.getsize(p)
    mid = f"{TMP}/{name}.wav"
    out = f"{TMP}/{name}"
    sh(["ffmpeg","-y","-v","error","-i",p, mid])
    if name.startswith("bgm_"):
        sh(["ffmpeg","-y","-v","error","-i",mid,"-c:a","libvorbis","-q:a","2", out])
    else:
        sh(["ffmpeg","-y","-v","error","-i",mid,"-c:a","libvorbis","-q:a","3","-ac","1", out])
    os.remove(mid)
    # 검증: 길이 오차 ±0.6s 이내
    d0, d1 = dur(p), dur(out)
    if abs(d0 - d1) > 0.6:
        print(f"SKIP(길이불일치 {d0:.1f}->{d1:.1f}) {name}", flush=True)
        continue
    a = os.path.getsize(out)
    done[name] = [b, a]
    rows.append((name, b, a))
    json.dump(done, open(STATE,"w"))
    print(f"{name}: {b//1024}KB -> {a//1024}KB ({100*a//b}%)", flush=True)

tb = sum(r[1] for r in rows); ta = sum(r[2] for r in rows)
print(f"진행 {len(rows)}/{len(bgm)+len(sfx)} | 총량: {tb//1048576}MB -> {ta//1048576}MB ({100*ta//tb}%)", flush=True)
if "--apply" in sys.argv and len(rows) == len(bgm)+len(sfx):
    for name, b, a in rows:
        os.replace(f"{TMP}/{name}", f"{AUD}/{name}")
    print("APPLIED — 원본 교체 완료", flush=True)
elif "--apply" in sys.argv:
    print(f"미반영: {len(bgm)+len(sfx)-len(rows)}개 미완료 — 재실행 후 apply", flush=True)
