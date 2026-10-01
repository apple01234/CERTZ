#!/usr/bin/env python3
"""나무위키 메이플 문서 2개에서 전직/직업 체계 관련 텍스트 추출"""
import json, re, html

def load_text(path):
    with open(path, encoding="utf-8") as f:
        d = json.load(f)
    h = d.get("html") or d.get("data", {}).get("html") or ""
    # 태그 제거 + 공백 정리
    t = re.sub(r"<script[\s\S]*?</script>|<style[\s\S]*?</style>", " ", h)
    t = re.sub(r"<[^>]+>", "\n", t)
    t = html.unescape(t)
    t = re.sub(r"\n{2,}", "\n", t)
    t = re.sub(r"[ \t]{2,}", " ", t)
    return t

jobs = load_text("/home/z/my-project/tool-results/maple-jobs.json")
main = load_text("/home/z/my-project/tool-results/maple-main.json")
print("JOBS text len:", len(jobs), "| MAIN text len:", len(main))

with open("/home/z/my-project/tool-results/maple-jobs.txt", "w", encoding="utf-8") as f:
    f.write(jobs)
with open("/home/z/my-project/tool-results/maple-main.txt", "w", encoding="utf-8") as f:
    f.write(main)

# 전직 관련 키워드 라인 발췌
pat = re.compile(r"(전직|1차|2차|3차|4차|레벨\s?\d+이상|레벨\s?\d+ 이상)")
lines = [ln.strip() for ln in jobs.split("\n") if ln.strip()]
hits = [ln for ln in lines if pat.search(ln)]
print("--- JOBS: 전직 키워드 라인 (앞 80개) ---")
for h in hits[:80]:
    print(h[:160])
