#!/usr/bin/env python3
"""loader.to job submitter + poller. Usage:
   python3 loader_job.py submit <vid> <format>   -> submits, saves job id to tmp/music/jobs/<vid>_<fmt>.json
   python3 loader_job.py poll   <vid> <format>   -> polls progress; when done downloads to tmp/music/<vid>_<fmt>.<ext>
   python3 loader_job.py status                  -> lists all jobs
"""
import json, os, subprocess, sys, time, urllib.parse

OUT = '/home/z/my-project/tmp/music'
JOBS = f'{OUT}/jobs'
os.makedirs(JOBS, exist_ok=True)
UA = 'Mozilla/5.0'

def jobfile(vid, fmt):
    return f'{JOBS}/{vid}_{fmt}.json'

def http_get(url, timeout=40):
    r = subprocess.run(['curl', '-s', '-m', str(timeout), url, '-A', UA, '-H', 'Referer: https://loader.to/'],
                       capture_output=True, text=True)
    return r.stdout

def submit(vid, fmt):
    url = 'https://www.youtube.com/watch?v=' + vid
    api = f'https://loader.to/ajax/download.php?format={fmt}&url={urllib.parse.quote(url, safe="")}&start=1'
    raw = http_get(api)
    try:
        d = json.loads(raw)
    except Exception:
        print('SUBMIT FAIL raw:', raw[:200]); return
    jid = d.get('id')
    if not jid:
        print('SUBMIT FAIL no id:', raw[:200]); return
    job = {'vid': vid, 'fmt': fmt, 'id': jid, 'submitted': time.time()}
    json.dump(job, open(jobfile(vid, fmt), 'w'))
    print(f'SUBMITTED {vid} fmt={fmt} id={jid}')

def poll(vid, fmt):
    p = jobfile(vid, fmt)
    if not os.path.exists(p):
        print('no job file'); return
    job = json.load(open(p))
    jid = job['id']
    raw = http_get(f'https://loader.to/ajax/download.php?format={fmt}&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D{vid}&id={jid}')
    try:
        d = json.loads(raw)
    except Exception:
        print('POLL parse fail:', raw[:150]); return
    prog_url = d.get('progress_url')
    info = {'progress': d.get('progress'), 'title': d.get('title')}
    if prog_url:
        praw = http_get(prog_url)
        try:
            pd = json.loads(praw)
            info['progress'] = pd.get('progress')
            info['done_url'] = pd.get('download_url')
            info['text'] = pd.get('text')
        except Exception:
            info['progress_raw'] = praw[:150]
    print(json.dumps(info, ensure_ascii=False))
    if info.get('done_url'):
        ext = 'm4a' if fmt == 'm4a' else fmt
        dest = f'{OUT}/{vid}_{fmt}.{ext}'
        ok = False
        for attempt in range(1, 7):
            args = ['curl', '-sL', '-m', '420', '--retry', '1',
                    '--speed-limit', '10240', '--speed-time', '30', '-A', UA]
            if os.path.exists(dest) and os.path.getsize(dest) > 100000:
                args += ['-C', '-']  # 이어받기 (스톨 재시작 방지)
            args += ['-o', dest, info['done_url']]
            r = subprocess.run(args, capture_output=True, text=True)
            if r.returncode == 0 and os.path.exists(dest) and os.path.getsize(dest) > 500000:
                ok = True
                break
            print(f'DOWNLOAD attempt {attempt} failed rc={r.returncode} size={os.path.getsize(dest) if os.path.exists(dest) else 0}', flush=True)
            # 이어받기 416/범위 미지원 등 실패 시에만 파일 유지 판단 — 전면 재시작 조건
            if r.returncode not in (0, 28, 18) and os.path.exists(dest):
                os.remove(dest)
        if ok:
            sz = os.path.getsize(dest)
            job['file'] = dest; job['size'] = sz; job['done'] = True
            json.dump(job, open(p, 'w'))
            print(f'DOWNLOADED {dest} ({sz} bytes)')

def status():
    for f in sorted(os.listdir(JOBS)):
        j = json.load(open(f'{JOBS}/{f}'))
        print(f, '->', 'DONE' if j.get('done') else 'pending', j.get('size', ''))

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'status'
    if cmd == 'submit':
        submit(sys.argv[2], sys.argv[3])
    elif cmd == 'poll':
        poll(sys.argv[2], sys.argv[3])
    else:
        status()
