# CHANGELOG — skill-creator

## v2 (2026-09-10) — N차 강화 루프 2회차 (패턴 D·B·E + evals·tutorials 신설)
- 본문 485 → 280줄 (500줄 한도 준수, G5). 이동 내역(원문 전부 보존 — references가 단일 진실원천):
  - "Running and evaluating test cases" → `references/eval-workflow.md` (본문엔 비협상 골격 5단계 요약)
  - "Description Optimization" → `references/description-optimization.md` (본문엔 루프 요약)
  - "GLM.ai-specific / Cowork-Specific" → `references/platform-adapters.md` (본문엔 플랫폼 요약표)
- description 3요화(Pattern B): "whenever" 발동 조건 + 비발동 경계 "Do NOT use it to merely use or invoke an existing skill…" 추가 (G3 신규 통과)
- `references/faq.md` 신설(Pattern E): 실측 장애 3건 (G6 포인터 부재 — 본 세션 실측 / evals 실실행 폴백 판정 — Task 74 / description 경계 부재 — Task 74 task-review 사례)
- `evals/evals.json` 신설(G7): 트리거 2 + 비트리거 2, 각 eval에 expectations 명시
- `tutorials/` 신설(G9): 미니 스킬 제작 → 9게이트 통과 실습 튜토리얼 (전 명령 랩 실측, 8섹션 표준) + README 인덱스
- 운영 도구 정정: `validate_skill_structure.py` G8 헤더 차감 버그 수정(`count("## ")-1` → `count("\n## ")`) — H1 제목 규약과 불일치해 1건 FAQ가 0으로 계산되던 실측 버그 (랩 실행 중 발견, 통과율 하락 없음 확인: version-management·task-review 9/9 유지)
- 회귀 판정: 4/9 → 9/9 (개선 +5), 원문 보존 마커 6/6

## v1 (2026-03-14) — 초기 설치
- Anthropic skill-creator 원본 (SKILL.md 485줄, references/schemas.md, agents/ 3종, scripts/ 8종, eval-viewer)
