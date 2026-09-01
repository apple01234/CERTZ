#!/bin/bash
# 에셋 팩 인벤토리 — unzip -l 기반 (쓰기 없음, 빠름)
cd /home/z/my-project/upload
OUT=/home/z/my-project/upload/INVENTORY.md
: > "$OUT"
for z in *.zip; do
  echo "## $z" >> "$OUT"
  unzip -l "$z" 2>/dev/null | awk 'NR>3 && $4 != "" {print $4}' > /tmp/ziplist.txt
  total=$(wc -l < /tmp/ziplist.txt)
  pngs=$(rg -c "\.png$" /tmp/ziplist.txt 2>/dev/null || echo 0)
  metas=$(rg -c "\.meta$" /tmp/ziplist.txt 2>/dev/null || echo 0)
  echo "- files: $total (png: $pngs, meta: $metas)" >> "$OUT"
  # 상위 2단계 디렉터리 구조
  awk -F/ '{print $1"/"$2}' /tmp/ziplist.txt | sort -u | head -25 | sed 's/^/  /' >> "$OUT"
  echo "" >> "$OUT"
done
echo "inventory done"
