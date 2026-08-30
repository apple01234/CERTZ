#!/usr/bin/env python3
"""itch.io 무료 에셋 팩 다운로더 (no-login free flow)"""
import re, json, sys, subprocess, urllib.parse

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

def curl(url, jar=None, data=None, referer=None, out=None):
    cmd = ["curl", "-sL", "-A", UA, "--max-time", "120", "-w", "\n%{http_code}"]
    if jar:
        cmd += ["-b", jar, "-c", jar]
    if referer:
        cmd += ["-e", referer]
    if data:
        cmd += ["--data", data]
    if out:
        cmd += ["-o", out]
    cmd.append(url)
    r = subprocess.run(cmd, capture_output=True, text=True)
    body, _, code = r.stdout.rpartition("\n")
    return code.strip(), body

def get_pack(url, outdir):
    slug = url.rstrip("/").split("/")[-1]
    user = url.split("//")[1].split(".")[0]
    jar = f"/tmp/itch_{user}.jar"
    print(f"\n=== {url} ===")
    code, html = curl(url, jar=jar)
    if code != "200":
        print(f"  page fetch fail {code}")
        return
    # csrf token
    m = re.search(r'name="csrf_token"\s+value="([^"]+)"', html) or re.search(r'csrf_token["\']?\s*[:=]\s*["\']([^"\']+)', html)
    csrf = m.group(1) if m else None
    print(f"  csrf: {'yes' if csrf else 'NO'}")
    # upload ids — check page then /download
    ids = re.findall(r'data-upload_id="(\d+)"', html)
    if not ids:
        ids = re.findall(r'"upload_id":\s*(\d+)', html)
    if not ids:
        code2, dhtml = curl(f"{url}/download", jar=jar, referer=url)
        ids = re.findall(r'data-upload_id="(\d+)"', dhtml)
        if not ids:
            ids = re.findall(r'/file/(\d+)', dhtml)
        if not ids:
            ids = re.findall(r'/download/(\d+)', dhtml)
    if not ids:
        print("  no upload ids found")
        # debug dump candidates
        for pat in [r'data-upload[^>]*', r'file/\d+', r'download/\d+']:
            f = re.findall(pat, html) + re.findall(pat, dhtml if not ids else "")
            if f: print("  debug:", f[:5])
        return
    ids = sorted(set(ids))
    print(f"  uploads: {ids}")
    for uid in ids:
        # POST to /file/<id>
        code3, resp = curl(f"{url}/file/{uid}", jar=jar, data=f"csrf_token={csrf}", referer=url)
        try:
            j = json.loads(resp)
        except Exception:
            print(f"  upload {uid}: POST fail code={code3} resp={resp[:120]}")
            continue
        dl = j.get("url") or j.get("cdn_url")
        if not dl:
            print(f"  upload {uid}: no url in json: {str(j)[:150]}")
            continue
        # filename from response or url
        fname = j.get("filename") or urllib.parse.unquote(dl.split("?")[0].rstrip("/").split("/")[-1])
        # itch CDN returns in json: {"url": "...", ...} with msg maybe
        print(f"  downloading: {fname}")
        code4, _ = curl(dl, jar=jar, out=f"{outdir}/{fname}", referer=dl.split("?")[0])
        print(f"    -> {code4}")
        # verify size
        r = subprocess.run(["du", "-h", f"{outdir}/{fname}"], capture_output=True, text=True)
        print(f"    size: {r.stdout.strip()}")

if __name__ == "__main__":
    outdir = "/home/z/my-project/assets-src"
    subprocess.run(["mkdir", "-p", outdir])
    for u in sys.argv[1:]:
        get_pack(u, outdir)
