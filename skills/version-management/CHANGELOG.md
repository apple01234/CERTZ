# CHANGELOG — version-management

버전 번호는 1씩 순차 증가. 기존 버전을 덮어쓰거나 소급 변경하지 않는다.

## v2 (2026-09-10) — N차 강화 루프 1회차
- [패턴 D] 본문 582줄 → 481줄 (500줄 한도 준수):
  - §3.4.2/3.4.3/3.4.4 (다중 진입·prototype 쌍파일·fixed-image export) → `references/delivery-variants.md` (원문 보존)
  - §5 meta.json 전체 예시·필드표 → `references/meta-json-spec.md` (원문 보존, 본문은 핵심 필드速記+포인터)
- [패턴 E] `references/faq.md` 신설 — worklog Task 71 실제 장애 3건 (스테일 산출물 커밋 / push 분기 거부 / 원격 md5 절단 다운로드)
- [구조] `evals/evals.json` 신설 (회귀 3건) · `tutorials/` 신설 (학습지향 튜토리얼 1건 + README 인덱스)
- 본문 §8 학습자산·회귀 포인터 추가. 기존 절차·결정 로직·순서 불변(틀 유지).

## v1 (2026-09-07) — 초기 상태 (태그 version-management/v1)
- 최초 확정본. 본문 582줄.
