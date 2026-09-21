# 튜토리얼: 미니 스킬을 처음부터 만들고 구조 검증 9개 게이트 통과까지 따라 하기

> 소요 시간 약 25분 · 이 튜토리얼을 끝내면 `skill-creator` 스킬의 핵심 흐름인 "초안 작성 → 빠른 검증 → 9개 구조 게이트 보강 → 재검증 통과"를 직접 손으로 수행할 수 있다. 모든 명령과 관찰값은 2026-09-10 랩 실측 그대로다. (섹션 1: 약속)

## 대상 및 사전 요구 (섹션 2)

- 스킬 파일(SKILL.md)을 들어는 본 사람이면 충분하다. 서브에이전트·평가 뷰어 같은 고급 인프라는 다루지 않는다(본문 `references/eval-workflow.md` 참조).
- 이전에 읽을 문서: `skills/skill-creator/SKILL.md` — 이 튜토리얼은 "만들고 구조 검증까지"만 학습한다.

## 준비물 (섹션 3)

- [ ] python3 사용 가능: `python3 --version`
- [ ] 두 검증기 경로: `skills/skill-creator/scripts/quick_validate.py`(제작자 제공) · `scripts/validate_skill_structure.py`(운영 9게이트)
- [ ] 실습 샌드박스: `skills-workspace/tutorial-lab/skill-creator/` (실습 전체가 이 안에서만 일어난다)

## 단계 1 — 샌드박스 진입과 미니 스킬 디렉터리 생성 (섹션 4)

```bash
cd /home/z/my-project
mkdir -p skills-workspace/tutorial-lab/skill-creator/weekly-report
cd skills-workspace/tutorial-lab/skill-creator/weekly-report
pwd
```

→ 예상 관찰: `.../skills-workspace/tutorial-lab/skill-creator/weekly-report` 가 출력된다. **왜 스킬 디렉터리를 먼저 만드나**: 스킬은 항상 "디렉터리 + 그 안의 SKILL.md" 단위로 검증·배포되기 때문이다.

## 단계 2 — SKILL.md 초안 작성 (일부러 미달 상태로)

```bash
cat > SKILL.md <<'EOF'
---
name: weekly-report
description: 주간 보고서를 정해진 형식으로 생성한다. 사용자가 주간 보고, 주간 정산, weekly report 작성을 요청할 때 사용한다.
---

# Weekly Report

## 실행 절차
1. 이번 주 날짜 범위를 계산한다 (월요일~일요일).
2. git log에서 해당 기간 커밋을 그룹핑한다.
3. 아래 템플릿으로 보고서를 조립해 사용자에게 보여준다.

## 이유
- 매주 반복되는 수작업 조립을 없애기 위함.
EOF
python3 /home/z/my-project/skills/skill-creator/scripts/quick_validate.py .
```

→ 예상 관찰: `Skill is valid!` 와 종료 코드 0. **주의**: 제작자 검증기는 "문법이 맞는가"만 보므로 통과해도 운영 게이트는 별개다 — 다음 단계에서 드러난다.

## 단계 3 — 운영 9게이트 검증 (초안 상태)

```bash
python3 /home/z/my-project/scripts/validate_skill_structure.py . 2>&1 | tail -15
```

→ 예상 관찰: `G2_description: false`, `G3_boundary: false`, `G7_evals_valid: false`, `G8_faq_grounded: false`, `G9_tutorials_indexed: false` 와 함께 `"passed": 4, "total": 9`. 초안은 보통 4/9에서 출발한다 — 이게 정상이다.

## 중간 확인 ① (섹션 5)

- [ ] quick_validate는 통과했는데 9게이트는 4/9인 이유를 설명할 수 있다 (문법 검증 vs 구조·품질 게이트)
- [ ] 실패한 게이트 목록에 G2·G3·G7·G8·G9가 있다

## 단계 4 — description 보강 (G2: 80자 이상 + G3: 비발동 경계)

```bash
python3 - <<'EOF'
p = "SKILL.md"
src = open(p, encoding="utf-8").read()
old = "description: 주간 보고서를 정해진 형식으로 생성한다. 사용자가 주간 보고, 주간 정산, weekly report 작성을 요청할 때 사용한다."
new = "description: 주간 보고서를 정해진 형식으로 자동 생성한다. 주간 보고·주간 정산·weekly report 작성 요청에 사용한다. 단순 커밋 목록 조회나 일일 보고서에는 사용하지 않는다."
assert old in src
open(p, "w", encoding="utf-8").write(src.replace(old, new))
print("desc fixed, len =", len(new) - len("description: "))
EOF
```

→ 예상 관찰: `desc fixed, len = 96`. **3요소 규칙**: 정량 트리거 + 발화 예시 + 비발동 경계("...에는 사용하지 않는다")를 한 줄에 담는다.

## 단계 5 — evals·faq·tutorials 보강 (G7·G8·G9)

```bash
mkdir -p evals references tutorials
cat > evals/evals.json <<'EOF'
{
  "skill_name": "weekly-report",
  "evals": [
    {
      "id": 1,
      "prompt": "이번 주간 보고서 만들어줘",
      "expected_output": "트리거: 날짜 범위 계산 → 커밋 그룹핑 → 템플릿 조립 순서로 실행",
      "expectations": ["월~일 날짜 범위를 명시한다", "템플릿 형식을 유지한다"]
    },
    {
      "id": 2,
      "prompt": "어제 커밋 목록 보여줘",
      "expected_output": "비트리거: 일회성 조회 — 주간 보고서 생성 루프를 시작하지 않음",
      "expectations": ["보고서 템플릿을 생성하지 않는다", "요청한 목록만 보여준다"]
    }
  ]
}
EOF
cat > references/faq.md <<'EOF'
# 故障·解决记录（FAQ 源）

## 2026-09-10 · 커밋 없는 주간에 빈 보고서 생성
- 症状：해당 주 커밋이 0건일 때 빈 섹션만 있는 보고서가 생성됨
- 原因：빈 주 처리 분기가 절차에 없었음
- 解决："커밋 0건이면 이전 주 대비 요약으로 대체" 규칙을 절차 2단계에 추가
- 复发防止：새 절차 추가 시 엣지 케이스(빈 입력)를 함께 정의
EOF
cat > tutorials/README.md <<'EOF'
# tutorials 인덱스 — weekly-report

| 제목 | 대상 | 소요 시간 | 최종 갱신일 |
|---|---|---|---|
| [주간 보고서 스킬 첫 실행 따라 하기](tutorial-first-run-2026-09-10.md) | 운영 입문자 | 약 10분 | 2026-09-10 |
EOF
printf '# 튜토리얼: 주간 보고서 스킬 첫 실행\n\n(내용)\n' > tutorials/tutorial-first-run-2026-09-10.md
```

→ 예상 관찰: 명령 출력 없이 파일 4개 생성. G7은 `skill_name` + 각 eval의 `id`·`prompt`·`expectations` 필드를 요구한다(빈 객체·주석 불가).

## 단계 6 — 재검증: 9/9 도달

```bash
python3 /home/z/my-project/scripts/validate_skill_structure.py . 2>&1 | python3 -c "
import json,sys
d=json.load(sys.stdin)[0]
for k,v in d['checks'].items(): print(f'{k}: {\"PASS\" if v else \"FAIL\"}')
print('→', d['passed'], '/', d['total'])"
```

→ 예상 관찰: 9개 전부 PASS, `→ 9 / 9`. (2026-09-10 실측: 검증기 G8 헤더 차감 버그 수정 후 1건짜리 faq.md도 통과)

## 완성물 확인 (섹션 6)

```bash
find . -type f | sort
```

→ 예상 관찰:
```
./SKILL.md
./evals/evals.json
./references/faq.md
./tutorials/README.md
./tutorials/tutorial-first-run-2026-09-10.md
```

- [ ] SKILL.md의 description이 80자 이상 + 비발동 경계 포함
- [ ] evals.json에 트리거/비트리거 예가 최소 1쌍 있다
- [ ] faq.md에 실제 장애 1건이 4항목(症状/原因/解决/复发防止) 형식으로 있다

## 다음 학습 경로 (섹션 7)

- 런 병렬 스폰·채점·평가 뷰어: 본 스킬 `SKILL.md` → `references/eval-workflow.md`
- description 트리거 최적화 자동 루프: `references/description-optimization.md`
- 기존 스킬 개선 시에는 반드시 먼저 스냅샷: `cp -r <skill> <workspace>/skill-snapshot/` 후 편집 (순서 불변)

## 문제 해결 (섹션 8)

- **`Skill is valid!`인데 9게이트가 실패한다** → 정상. quick_validate는 문법만 본다. 9게이트는 구조·품질을 본다.
- **G8이 1건 FAQ에서 FAIL** → 2026-09-10 이전 검증기는 `count("## ") - 1`로 첫 헤더를 잘라 1건을 0으로 계산했다. 최신 검증기로 재실행할 것 (본 튜토리얼 실측에서 발견·수정된 실제 버그).
- **G6 포인터 FAIL** → 본문이 언급한 `references/…`·`evals/…` 경로 중 실재하지 않는 파일이 있다는 뜻. 파일을 만들거나 문구를 지운다 (먼저 쓰고 나중 만들기 금지).
- **한글 대신 물음표가 보인다** → 터미널 UTF-8 확인. 검증기는 UTF-8 파일을 전제로 한다.
