# 튜토리얼: 완료한 작업 하나를 재사용 가능한 스킬로 승격하기

> 소요 시간 약 20분 · 이 튜토리얼을 끝내면 worklog에 남은 운영 경험 하나를 직접 골라, SKILL.md + evals + tutorials 인덱스를 갖춘 정식 스킬 디렉터리로 만들고 구조 검증기 9개 게이트를 모두 통과시킬 수 있다. (섹션 1: 약속)

## 대상 및 사전 요구 (섹션 2)

- 에이전트 운영 환경에서 반복 작업을 해 본 사람. 프로그래밍 지식은 필요 없다.
- 이전에 읽을 문서: `skills/task-review/SKILL.md` (원본 절차), 이 튜토리얼은 그 절차를 손으로 따라 하는 학습용이다.

## 준비물 (섹션 3)

- [ ] `skills/` 디렉터리 존재 확인: `ls skills/ | head`
- [ ] 공유 작업 기록 존재 확인: `test -f worklog.md && echo 있음`
- [ ] 구조 검증기 존재 확인: `test -f scripts/validate_skill_structure.py && echo 있음`
- [ ] 실습용 샌드박스는 `skills-workspace/tutorial-lab/` 아래에 만든다. 실제 서비스 `skills/`에는 마지막 단계까지 아무것도 쓰지 않는다.

## 단계 1 — 소재 발굴: worklog에서 반복된 경험 고르기 (섹션 4)

worklog에서 두 번 이상 나타난 교훈을 찾는다. 한 번만 나타난 경험은 스킬 재료로 이르다.

```bash
cd /home/z/my-project
rg -c "사일런트|백그라운드.*빌드" worklog.md
```

→ 예상 관찰: `6` 이 출력된다(worklog.md 내 출현 횟수). 2 이상이면 반복된 교훈 = 좋은 소재다.

## 단계 2 — 중복 확인: 이미 같은 스킬이 있는지 검색

새로 만들기 전에 반드시 기존 스킬을 검색한다. 이유: 유사 스킬이 늘면 트리거 판단 노이즈가 커지기 때문이다.

```bash
rg -il "foreground|빌드.*포그라운드" skills/ | head -5
ls skills-workspace/tutorial-lab 2>/dev/null || mkdir -p skills-workspace/tutorial-lab
```

→ 예상 관찰: 매칭이 없거나(신규 주제) 무관한 스킬만 나온다. 샌드박스 디렉터리가 만들어진다.

## 중간 확인 ① (섹션 5)

여기서 `skills-workspace/tutorial-lab` 이 보이지 않으면 준비물 체크리스트의 `cd /home/z/my-project` 부터 다시 실행한다.

## 단계 3 — SKILL.md 초안 작성 (description 3요소 포함)

```bash
mkdir -p skills-workspace/tutorial-lab/long-build-fg
cat > skills-workspace/tutorial-lab/long-build-fg/SKILL.md <<'EOF'
---
name: long-build-fg
description: 10분 이상 걸리는 빌드·대량 변환을 안정적으로 완수하는 절차. gradle/next 빌드가 백그라운드에서 조용히 죽는 환경에서 "빌드해줘", "apk 만들어줘" 요청에 사용한다. 1분 미만의 즉시 명령이나, 이미 포그라운드 실행 중인 세션에서는 사용하지 않는다.
---

## 실행 절차

1. 빌드를 `setsid` 없이 포그라운드 단일 호출로 실행하고, 로그를 파일로 리다이렉트한다.
2. 30초 간격으로 로그 파일을 폴링해 진행을 확인한다.
3. 종료 코드를 확인하고, 산출물에 이번 입력의 특징 문자열이 들어 있는지 검출한다.

## 이유

- 백그라운드 장시간 프로세스는 이 환경에서 사일런트 사망할 수 있다. 로그가 남으면 원인 추적이 가능하다.

## 踩坑记录

- 2026-09-09 · 백그라운드 빌드 3회 연속 사일런트 사망(로그 0바이트) → 포그라운드 전환으로 해결(worklog Task 69)
EOF
test -f skills-workspace/tutorial-lab/long-build-fg/SKILL.md && echo "작성됨"
```

→ 예상 관찰: `작성됨`이 출력된다. description에는 "무엇을 / 언제 발동 / 언제 안 하는지"가 모두 들어 있다.

## 단계 4 — evals(회귀 테스트 세트) 추가

```bash
mkdir -p skills-workspace/tutorial-lab/long-build-fg/evals
cat > skills-workspace/tutorial-lab/long-build-fg/evals/evals.json <<'EOF'
{
  "skill_name": "long-build-fg",
  "evals": [
    {
      "id": 1,
      "prompt": "APK 빌드 좀 해줘, 시간 좀 걸릴 거야",
      "expected_output": "포그라운드 단일 호출 + 로그 리다이렉트로 실행하고 산출물 특징 문자열 검출까지 수행",
      "expectations": ["백그라운드(&, nohup)로 실행하지 않는다", "로그 파일 경로를 안내한다"]
    },
    {
      "id": 2,
      "prompt": "이 파일 몇 줄인지 세줘",
      "expected_output": "스킬 미발동 — 즉시 명령",
      "expectations": ["빌드 절차를 수행하지 않는다"]
    }
  ]
}
EOF
python3 -c "import json; json.load(open('skills-workspace/tutorial-lab/long-build-fg/evals/evals.json'))" && echo "JSON 정상"
```

→ 예상 관찰: `JSON 정상`이 출력된다.

## 단계 5 — tutorials 인덱스 + 첫 학습 문서 골격

```bash
mkdir -p skills-workspace/tutorial-lab/long-build-fg/tutorials
cat > skills-workspace/tutorial-lab/long-build-fg/tutorials/tutorial-first-fg-build-2026-09-10.md <<'EOF'
# 튜토리얼: 첫 포그라운드 빌드 따라 하기
> 약속: 이 문서를 끝내면 10분 넘는 빌드를 포그라운드+로그 폴링으로 안전하게 돌릴 수 있다.
## 단계 1 — 포그라운드 실행
./gradlew assembleRelease --no-daemon 2>&1 | tee build.log
→ 예상 관찰: BUILD SUCCESSFUL 이 로그에 나타난다.
## 완성물 확인
로그 파일에 BUILD SUCCESSFUL 이 있고 산출물 특징 문자열 검출이 통과한다.
## 문제 해결
로그가 멈춘 것 같으면 폴링하라. 사일런트 사망 경험은 踩坑记录 참고.
EOF
printf '# tutorials 인덱스\n\n| 제목 | 대상 | 소요 | 갱신일 |\n|---|---|---|---|\n| [첫 포그라운드 빌드 따라 하기](tutorial-first-fg-build-2026-09-10.md) | 초보 | 10분 | 2026-09-10 |\n' > skills-workspace/tutorial-lab/long-build-fg/tutorials/README.md
ls skills-workspace/tutorial-lab/long-build-fg/tutorials
```

→ 예상 관찰: `README.md  tutorial-first-fg-build-2026-09-10.md` 두 파일이 나온다. 미니 튜토리얼에도 약속→단계→관찰→완성물→문제 해결 뼈대가 들어간다.

## 중간 확인 ②

여기까지 파일 트리가 아래와 같은지 확인한다. 다르면 해당 단계를 반복한다.

```bash
find skills-workspace/tutorial-lab/long-build-fg -type f | sort
```

→ 예상 관찰: `SKILL.md`, `evals/evals.json`, `tutorials/README.md` 3개가 나온다.

## 단계 6 — 구조 검증기로 9개 게이트 통과 확인

```bash
python3 scripts/validate_skill_structure.py skills-workspace/tutorial-lab/long-build-fg
```

→ 예상 관찰: JSON 출력에서 `"passed": 9` 를 볼 수 있다. `passed`가 9보다 작으면 실패한 `G*` 항목의 이름이 알려주는 게이트를 고친다.

## 완성물 확인 (섹션 6)

- 검증기 결과 `"passed": 9, "total": 9` 이고 `"preserve_ok"` 관련 실패가 없다.
- `SKILL.md`의 description에 3요소(무엇/발동/비발동)가 모두 있다.
- evals에 "발동해야 할" 사례와 "발동하면 안 되는" 사례가 최소 1개씩 있다.

이 상태면 승격 준비 완료다. 실제 서비스에 반영하려면 같은 구조 그대로 `skills/{스킬명}/` 에 복사한다(운영 승인 후). 샌드박스 실습만으로도 학습 목표는 달성된다.

## 다음 학습 경로 (섹션 7)

- 이미 있는 스킬을 고치고 싶다 → `skills/task-review/SKILL.md`의 "快照与回归" 섹션 (스냅샷 → 편집 → 회귀 순서)
- 버전 기록 남기기 → `skills/version-management/tutorials/` 의 튜토리얼
- 검증기 상세 → `scripts/validate_skill_structure.py` 상단 주석

## 문제 해결 (섹션 8)

- Q. 검증기에서 `G3_boundary: false` → description에 "사용하지 않는다 / 금지" 같은 비발동 경계 문장이 없다는 뜻이다. 경계 문장을 한 줄 추가한다.
- Q. 검증기에서 `G8_faq_grounded: false` → 踩坑记录(또는 references/faq.md)에 날짜가 적힌 실제 기록이 없거나 "暂无"가 남아 있다는 뜻이다. 추측성 기록을 채우지 말고, 실제 겪은 장애만 증상/원인/해결/재발 방지 형식으로 적는다.
- Q. 스킬을 만들었는데 발동하지 않는 것 같다 → 2026-09-10 실측 사례: description에 정량 기준과 비발동 경계가 없어 판단이 애매했다. `evals/evals.json`의 트리거用例를 먼저 통과시키고 description을 다듬는다.
- Q. 샌드박스를 처음 상태로 돌리고 싶다 → `rm -rf skills-workspace/tutorial-lab/long-build-fg` 후 단계 3부터 반복한다.
