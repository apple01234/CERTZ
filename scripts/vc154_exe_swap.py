#!/usr/bin/env python3
"""vc154_exe_swap.py — vc153-setup.exe 삭제 (vc154-setup 자동첨부 확인 후)."""
import json, re, subprocess, urllib.request, urllib.error

GT = subprocess.run(["git", "remote", "get-url", "origin"], cwd="/home/z/my-project",
                    capture_output=True, text=True).stdout
GT = re.search(r"apple01234:([^@]+)@github\.com", GT).group(1)
API = "https://api.github.com/repos/apple01234/CERTZ"
REL = 385985773

r = urllib.request.Request(f"{API}/releases/{REL}", headers={"Authorization": f"Bearer {GT}"})
with urllib.request.urlopen(r, timeout=30) as resp:
    rel = json.loads(resp.read().decode())

for a in rel.get("assets", []):
    if a["name"] == "SERTZ-vc153-setup.exe":
        d = urllib.request.Request(f"{API}/releases/assets/{a['id']}",
                                   method="DELETE", headers={"Authorization": f"Bearer {GT}"})
        try:
            urllib.request.urlopen(d, timeout=30)
            print(f"DEL {a['name']} → 204")
        except urllib.error.HTTPError as e:
            print(f"DEL {a['name']} → {e.code}")

# 최종 목록
with urllib.request.urlopen(urllib.request.Request(f"{API}/releases/{REL}",
                            headers={"Authorization": f"Bearer {GT}"}), timeout=30) as resp:
    rel = json.loads(resp.read().decode())
print("final assets:")
for a in rel.get("assets", []):
    print(f"  {a['name']} {a['size']:,}B")
