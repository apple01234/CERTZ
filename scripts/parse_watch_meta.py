#!/usr/bin/env python3
"""Extract ytInitialPlayerResponse / ytInitialData from web-reader HTML dump."""
import json, re, sys

src = sys.argv[1] if len(sys.argv) > 1 else 'tmp/music/reader_watch.json'
out_prefix = sys.argv[2] if len(sys.argv) > 2 else 'tmp/music/watchmeta'

d = json.load(open(src))
data = d.get('data', d)
h = data.get('html') or data.get('text') or ''
print('html len:', len(h))

dec = json.JSONDecoder()

def grab(name):
    idx = h.find(name + ' = ')
    if idx < 0:
        idx = h.find(name + ':')
    if idx < 0:
        return None
    pos = h.index('{', idx)
    try:
        obj, _ = dec.raw_decode(h[pos:])
        return obj
    except Exception as e:
        print(name, 'parse fail:', e)
        return None

pr = grab('ytInitialPlayerResponse')
if pr:
    json.dump(pr, open(f'{out_prefix}_pr.json', 'w'), ensure_ascii=False)
    vd = pr.get('videoDetails', {})
    desc = vd.get('shortDescription', '')
    print('== PLAYER RESPONSE ==')
    print('title:', vd.get('title'))
    print('duration(s):', vd.get('lengthSeconds'))
    print('desc len:', len(desc))
    print('--- description (first 2500) ---')
    print(desc[:2500])
else:
    print('no player response')

yd = grab('ytInitialData')
if yd:
    json.dump(yd, open(f'{out_prefix}_yd.json', 'w'), ensure_ascii=False)
    print('== YT INITIAL DATA saved, macroMarkers:', h.count('macroMarkersListRenderer'))
