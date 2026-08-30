#!/bin/bash
# SERTZ 프로젝트 백업 — 소스/에셋/설정만 (node_modules/.next 제외)
# 사용: bash scripts/backup.sh  → /home/z/my-project/backups/에 타임스탬프 tar.gz 생성 (최근 10개 유지)
set -e
cd /home/z/my-project
mkdir -p backups
STAMP=$(date +%Y%m%d_%H%M%S)
OUT="backups/sertz_backup_${STAMP}.tar.gz"
tar -czf "$OUT" \
  --exclude="node_modules" \
  --exclude=".next" \
  --exclude=".next-apk" \
  --exclude="backups" \
  --exclude="dev.log" \
  --exclude="tsconfig.tsbuildinfo" \
  src public scripts capacitor.config.ts next.config.ts package.json tsconfig.json eslint.config.mjs prisma Caddyfile 2>/dev/null || true
SIZE=$(du -h "$OUT" | cut -f1)
echo "backup: $OUT ($SIZE)"
# 최근 10개만 유지
ls -t backups/sertz_backup_*.tar.gz 2>/dev/null | tail -n +11 | xargs -r rm -f
echo "total backups: $(ls backups/sertz_backup_*.tar.gz 2>/dev/null | wc -l)"
