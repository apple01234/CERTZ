#!/usr/bin/env python3
"""SERTZ v3.0.7 AI BGM builder.
- Splits YouTube AI-music mixes (어항 앞에 마우스) into individual songs using
  tracklists (description timestamps) fetched from the innertube /next API.
- Encodes each song to AAC 64kbps stereo m4a (universal decode incl. Safari).
- Writes src/game/bgm_manifest.json for the in-game AI BGM playlist system.
Credits (license — 출처 표기 필수):
  Music: 어항 앞에 마우스 (https://www.youtube.com/@어항앞에마우스) — Suno AI 제작
"""
import json, os, subprocess, sys, time

ROOT = '/home/z/my-project'
MUS = f'{ROOT}/tmp/music'
OUTDIR = f'{ROOT}/public/assets/audio'
MANIFEST = f'{ROOT}/src/game/bgm_manifest.json'
CREDITS_MD = f'{ROOT}/tmp/music/ai_bgm_credits.md'

# source video files: prefer mp3 (320k), fallback m4a
def src_path(vid):
    for cand in (f'{MUS}/{vid}_mp3.mp3', f'{MUS}/battle_1_{vid}.mp3', f'{MUS}/{vid}_m4a.m4a'):
        if os.path.exists(cand):
            return cand
    return None

VIDS = {
    'cozy':   'z4piQnisxlA',   # 아직 조금 졸리지만 하루를 시작할 시간 | Cozy Morning RPG
    'tavern': 'yBLYmXKnf-Y',   # 작은 여관과 광장이 있는 마을 저녁 | Medieval Fantasy
    'adv':    't1Ld6_ql5Ls',   # 목표를 이루고 돌아가는 길 | Adventure Route
    'boss':   '7k-zl0YNO_0',   # 공격을 피하는 것만으로도 벅찬 보스전 | RPG Boss Battle
    'clim':   'SgmbEs86h94',   # 무슨 일이 있어도 절대 포기 안 할 거니까 | Climactic RPG Battle
}

# selection: kind -> [(src, track_index)]
PLAN = {
    'title':   [('cozy', 1), ('cozy', 20)],
    'village': [('tavern', 0), ('tavern', 2), ('tavern', 7), ('cozy', 5)],
    'field':   [('adv', 1), ('adv', 8), ('adv', 14), ('adv', 19)],
    'alfheim': [('adv', 3), ('adv', 6), ('adv', 11)],
    'snow':    [('adv', 0), ('adv', 9)],
    'cave':    [('clim', 2), ('clim', 10), ('clim', 17)],
    'abyss':   [('clim', 5), ('clim', 12), ('clim', 19)],
    'boss':    [('boss', 0), ('boss', 10), ('boss', 20), ('boss', 28), ('clim', 3)],
}

# tracklists live in {vid}_tracks.json keyed by real video id
TRACK_FILES = {
    'cozy': 'z4piQnisxlA', 'tavern': 'yBLYmXKnf-Y', 'adv': 't1Ld6_ql5Ls',
    'boss': '7k-zl0YNO_0', 'clim': 'SgmbEs86h94',
}

def sh(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        raise RuntimeError(f'cmd failed: {" ".join(cmd[:6])}…\n{r.stderr[-600:]}')
    return r

def sh_detached_ffmpeg(cmd, out_path, want_dur, timeout=180):
    """ffmpeg을 분리 프로세스로 실행 후 완료 폴링.
    (이 샌드박스는 포그라운드 ffmpeg 종료 시점에 래퍼가 비정상 종료되는 문제가 있어 setsid 분리 필요)"""
    if os.path.exists(out_path):
        os.remove(out_path)
    log = open('/home/z/my-project/tmp/music/ffmpeg_last.log', 'w')
    p = subprocess.Popen(['setsid'] + cmd, stdout=log, stderr=log,
                         stdin=subprocess.DEVNULL, start_new_session=True)
    t0 = time.time()
    while time.time() - t0 < timeout:
        if os.path.exists(out_path):
            try:
                d = probe_dur(out_path)
                # 완료 판정: 예상 길이에 근접 + 프로세스 종료
                if abs(d - want_dur) < 2.5 and p.poll() is not None:
                    return d
            except Exception:
                pass
        if p.poll() is not None:
            # 조기 종료 — 로그 확인
            raise RuntimeError(f'ffmpeg exited rc={p.returncode}: {open("/home/z/my-project/tmp/music/ffmpeg_last.log").read()[-400:]}')
        time.sleep(1)
    p.kill()
    raise RuntimeError('ffmpeg timeout')

def probe_dur(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                       capture_output=True, text=True)
    return float(r.stdout.strip())

def main():
    os.makedirs(OUTDIR, exist_ok=True)
    tracks_by_src = {}
    for alias, vid in TRACK_FILES.items():
        p = f'{MUS}/{vid}_tracks.json'
        if not os.path.exists(p):
            print(f'MISSING tracklist {p}'); sys.exit(1)
        tracks_by_src[alias] = json.load(open(p))['tracks']
        if src_path(vid) is None:
            print(f'MISSING source audio for {vid} ({alias})'); sys.exit(1)

    manifest, credits_lines, total_bytes = {}, ['# AI BGM — 어항 앞에 마우스', ''], 0
    for kind, sel in PLAN.items():
        entries = []
        for i, (alias, idx) in enumerate(sel, 1):
            vid = TRACK_FILES[alias]
            tracks = tracks_by_src[alias]
            if idx >= len(tracks):
                print(f'WARN {kind}: {alias}[{idx}] out of range ({len(tracks)} tracks)'); continue
            t = tracks[idx]
            start, dur = t['start'], t['dur']
            if dur < 70:
                print(f'WARN {kind}: skip too-short {t["title"]} ({dur:.0f}s)'); continue
            dur = min(dur, 330)
            key = f'ai_{kind}_{i:02d}'
            out = f'{OUTDIR}/{key}.m4a'
            cmd = ['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
                   '-ss', f'{start:.2f}', '-t', f'{dur:.2f}', '-i', src_path(vid),
                   '-vn', '-map', '0:a:0',
                   '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
                   '-ar', '44100', '-ac', '2', '-c:a', 'aac', '-b:a', '64k',
                   '-metadata', f'title={t["title"]}', '-metadata', 'artist=어항 앞에 마우스',
                   '-metadata', 'album=SERTZ BGM (AI Music)', out]
            got = sh_detached_ffmpeg(cmd, out, min(dur, 330))
            size = os.path.getsize(out)
            if abs(got - dur) > 2.0 or size < 60000:
                print(f'WARN encode check {key}: expect {dur:.0f}s got {got:.1f}s {size}B')
            total_bytes += size
            entries.append({'key': key, 'title': t['title'], 'src': vid, 'start': round(start, 2), 'dur': round(got, 1), 'bytes': size})
            print(f'{key}: {t["title"]} ({got:.0f}s, {size//1024}KB)  <- {alias}[{idx}] @ {start:.0f}s')
        manifest[kind] = entries

    json.dump(manifest, open(MANIFEST, 'w'), ensure_ascii=False, indent=1)
    n = sum(len(v) for v in manifest.values())
    print(f'\n=== manifest written: {MANIFEST} ({n} tracks, {total_bytes/1048576:.1f} MB total)')

    for kind, entries in manifest.items():
        credits_lines.append(f'\n### {kind} ({len(entries)}곡)')
        for e in entries:
            credits_lines.append(f'- {e["title"]} — {e["src"]}')
    open(CREDITS_MD, 'w').write('\n'.join(credits_lines) + '\n')

if __name__ == '__main__':
    main()
