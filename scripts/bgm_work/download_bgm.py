# v3.0.21 — 실사 BGM 40트랙 다운로드(incompetech/Kevin MacLeod, CC-BY 4.0) + 검증 + OGG 트랜스코딩
import json, os, subprocess, sys, urllib.parse

PICKS = json.load(open('/home/z/my-project/scripts/bgm_work/picks.json'))
RAW = '/home/z/my-project/scripts/bgm_work/raw'
OUT = '/home/z/my-project/public/assets/audio'
os.makedirs(RAW, exist_ok=True)
BASE = "https://incompetech.com/music/royalty-free/mp3-royaltyfree/"
CAP = 130  # 초 — 회전 재생이므로 2분10초면 충분, APK 절감

def sh(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True)

def probe(path):
    r = sh(f'ffprobe -v error -show_entries format=duration -of csv=p=0 "{path}"')
    try: return float(r.stdout.strip())
    except: return -1

ok, fail = 0, []
manifest = []
for theme, recs in PICKS.items():
    for i, rec in enumerate(recs, 1):
        key = f"bgm_{theme}{i}"
        url = BASE + urllib.parse.quote(rec['filename'])
        raw = f"{RAW}/{key}.mp3"
        out = f"{OUT}/{key}.ogg"
        # 1) 다운로드 (존재·검증 통과면 스킵)
        if not (os.path.exists(raw) and probe(raw) > 30):
            r = sh(f'curl -sL --retry 2 --max-time 120 -o "{raw}" "{url}"')
            if not os.path.exists(raw) or probe(raw) < 30:
                fail.append((key, rec['filename'], 'download/probe'))
                continue
        dur = probe(raw)
        # 2) 트랜스코딩: 정규화(loudnorm) + 길이 캡 + 페이드아웃 + OGG q2 (이미 유효한 산출물이면 스킵)
        if os.path.exists(out) and probe(out) > 25:
            ok += 1
            manifest.append({"key": key, "theme": theme, "title": rec['title'], "file": rec['filename'],
                             "srcDur": round(dur), "oggKB": os.path.getsize(out)//1024})
            continue
        fade_st = max(0, min(CAP, dur) - 3)
        r = sh(
            f'ffmpeg -y -v error -i "{raw}" -t {min(CAP, dur)} '
            f'-af "loudnorm=I=-18:TP=-1.5:LRA=11,afade=t=in:d=0.35,afade=t=out:st={fade_st}:d=3" '
            f'-c:a libvorbis -q:a 2 -ar 44100 -ac 2 "{out}"'
        )
        if r.returncode != 0 or not os.path.exists(out) or probe(out) < 25:
            fail.append((key, rec['filename'], 'transcode'))
            continue
        ok += 1
        manifest.append({"key": key, "theme": theme, "title": rec['title'], "file": rec['filename'],
                         "srcDur": round(dur), "oggKB": os.path.getsize(out)//1024})
        print(f"  OK {key:16s} <- {rec['title']:30s} src {int(dur)//60}:{int(dur)%60:02d} -> {os.path.getsize(out)//1024}KB")

json.dump(manifest, open('/home/z/my-project/scripts/bgm_work/manifest.json','w'), indent=1, ensure_ascii=False)
total = sum(m['oggKB'] for m in manifest)
print(f"\n=== {ok}/40 OK, total {total//1024}MB ===")
if fail:
    print("FAILED:"); [print("  ", f) for f in fail]; sys.exit(1)
