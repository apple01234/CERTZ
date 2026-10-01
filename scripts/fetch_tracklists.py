#!/usr/bin/env python3
"""Fetch YouTube /next API metadata → extract tracklist (timestamps+titles) per video."""
import json, re, subprocess, sys, os

OUT = '/home/z/my-project/tmp/music'
API = "https://www.youtube.com/youtubei/v1/next?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"
UA = "Mozilla/5.0"

VIDEOS = {
    # theme: [(vid, label), ...]
    'battle':    [('SgmbEs86h94', 'climactic_rpg_battle'), ('7k-zl0YNO_0', 'boss_battle')],
    'peace':     [('z4piQnisxlA', 'cozy_morning'), ('yBLYmXKnf-Y', 'town_evening')],
    'adventure': [('t1Ld6_ql5Ls', 'adventure_route'), ('y78z7210kvE', 'forest_stage')],
}

def to_sec(ts):
    parts = [int(x) for x in ts.split(':')]
    s = 0
    for p in parts:
        s = s * 60 + p
    return s

def fetch_next(vid):
    body = json.dumps({"context": {"client": {"clientName": "WEB", "clientVersion": "2.20260831.00.00", "hl": "ko"}}, "videoId": vid})
    r = subprocess.run(['curl', '-s', '-m', '40', '-X', 'POST', API, '-H', 'Content-Type: application/json', '-A', UA, '-d', body],
                       capture_output=True, text=True)
    return r.stdout

def walk_strings(o):
    if isinstance(o, dict):
        if 'attributedDescription' in o and isinstance(o['attributedDescription'], dict):
            yield o['attributedDescription'].get('content', '')
        for v in o.values():
            yield from walk_strings(v)
    elif isinstance(o, list):
        for v in o:
            yield from walk_strings(v)

def parse_tracks(desc, total_dur):
    # lines like "00:00 Title" or "0:00 Title"
    pat = re.compile(r'^\s*(\d{1,2}:\d{2}(?::\d{2})?)\s+(.{2,80}?)\s*$', re.M)
    tracks = []
    for m in pat.finditer(desc):
        ts, title = m.group(1), m.group(2).strip()
        if re.match(r'^[\d\s:]+$', title):
            continue
        tracks.append({'start': to_sec(ts), 'title': title})
    tracks.sort(key=lambda t: t['start'])
    for i, t in enumerate(tracks):
        end = tracks[i + 1]['start'] if i + 1 < len(tracks) else (total_dur or t['start'] + 200)
        t['end'] = end
        t['dur'] = end - t['start']
    return tracks

def main():
    result = {}
    for theme, vids in VIDEOS.items():
        for vid, label in vids:
            raw = fetch_next(vid)
            try:
                d = json.loads(raw)
            except Exception:
                print(f'[{vid}] next api FAIL', file=sys.stderr)
                continue
            desc = next(walk_strings(d), '')
            title = ''
            def find_title(o):
                if isinstance(o, dict):
                    if 'videoPrimaryInfoRenderer' in o:
                        pass
                    for k, v in o.items():
                        if k == 'title' and isinstance(v, dict) and 'simpleText' in v:
                            return v['simpleText']
                        r = find_title(v)
                        if r: return r
                elif isinstance(o, list):
                    for v in o:
                        r = find_title(v)
                        if r: return r
                return None
            title = find_title(d) or vid
            # duration from videoPrimaryInfoRenderer not present; use approximate from tracks
            tracks = parse_tracks(desc, None)
            out = {'vid': vid, 'theme': theme, 'label': label, 'video_title': title, 'tracks': tracks}
            path = f'{OUT}/{vid}_tracks.json'
            json.dump(out, open(path, 'w'), ensure_ascii=False, indent=1)
            print(f'[{theme}] {vid} ({label}): {len(tracks)} tracks — {title[:50]}')
            for i, t in enumerate(tracks[:4]):
                print(f'   {i+1}. {t["start"]//60}:{t["start"]%60:02d} {t["title"][:40]} ({t["dur"]:.0f}s)')
            result[vid] = len(tracks)
    print('SUMMARY:', json.dumps(result))

if __name__ == '__main__':
    main()
