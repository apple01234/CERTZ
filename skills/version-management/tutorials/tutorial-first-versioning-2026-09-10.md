# 튜토리얼: 웹 프로젝트 버전 수명주기 처음부터 끝까지 따라 하기 (V1 생성 → 수정 → 복원)

> 소요 시간 약 25분 · 이 튜토리얼을 끝내면 `version-management` 스킬의 핵심 흐름인 "프로젝트 생성(V1) → 수정(V2) → 과거 버전 복원(V3)"을 직접 손으로 수행하고, 태그·meta.json·git 로그로 각 단계를 검증할 수 있다. (섹션 1: 약속)

## 대상 및 사전 요구 (섹션 2)

- git 기본 개념(commit, tag)을 들어는 본 사람이면 충분하다. 고급 지식 불필요.
- 이전에 읽을 문서: `skills/version-management/SKILL.md` (원본 절차) — 이 튜토리얼은 학습지향이며, 실무 특수 규칙(prototype 쌍파일 등)은 다루지 않는다.

## 준비물 (섹션 3)

- [ ] git 사용 가능: `git --version`
- [ ] 실습 샌드박스 위치: `skills-workspace/tutorial-lab/versioning/` (실습 전체가 이 안에서만 일어난다)
- [ ] 아래 명령의 `{...}` 부분은 예시 값이다. 그대로 복붙해도 동작하게 실제 값을 넣어 두었다.

## 단계 1 — 샌드박스 진입과 프로젝트 디렉터리 생성 (섹션 4)

```bash
cd /home/z/my-project
git --version
TUTROOT=/home/z/my-project/skills-workspace/tutorial-lab/versioning
mkdir -p "$TUTROOT/我的项目/데모블로그/assets" && cd "$TUTROOT/我的项目/데모블로그"
pwd
```

→ 예상 관찰: `/home/z/my-project/skills-workspace/tutorial-lab/versioning/我的项目/데모블로그` 가 출력된다. **왜 미리 디렉터리를 만드나**: 스킬의 최상위 규칙은 "첫 파일을 쓰기 전에 프로젝트 디렉터리가 존재해야 한다"이기 때문이다.

## 단계 2 — 첫 입구 파일을 프로젝트 안에 직접 작성 (V1 재료)

```bash
cat > index.html <<'EOF'
<!doctype html><html><head><meta charset="utf-8"><title>데모블로그 V1</title></head>
<body><h1>데모블로그</h1><p>첫 버전입니다.</p></body></html>
EOF
printf 'img\n' > assets/README.txt
ls
```

→ 예상 관찰: `assets  index.html` 이 출력된다. 파일이 대화창 코드블록에만 있고 디스크에 없으면 스킬 위반(미납입)이다.

## 단계 3 — V1 생성: git init + 커밋 + 태그

```bash
git init -q
printf 'meta.json\n' > .gitignore
git add .
git commit -qm "V1: 최초 블로그 페이지"
git tag v1
git tag -l
```

→ 예상 관찰: `v1` 하나만 출력된다. 커밋 메시지 규칙은 `V{번호}: {한 줄 요약}`.

## 단계 4 — meta.json 생성 (순서 불변: 커밋+태그 먼저, meta.json 나중)

```bash
cat > meta.json <<'EOF'
{"project_name": "데모블로그", "latest_version": "v1", "versions": [
  {"id": "v1", "timestamp": "2026-09-10T12:00:00+09:00", "based_on": null, "summary": "최초 블로그 페이지"}
]}
EOF
python3 -c "import json;d=json.load(open('meta.json'));print(d['latest_version'])"
```

→ 예상 관찰: `v1` 이 출력된다. meta.json은 `.gitignore`로 버전 이력에서 제외됨을 확인: `git check-ignore -q meta.json && echo 제외됨` 이 `제외됨`을 출력한다.

## 중간 확인 ① (섹션 5)

```bash
git log --oneline | wc -l && git tag -l | wc -l
```

→ 예상 관찰: `1` 과 `1`. 여기서 1/1이 아니면 단계 3부터 다시.

## 단계 5 — 수정하고 V2 생성 (스킬 §3.3 명령 그대로)

```bash
sed -i 's/첫 버전입니다/수정된 본문입니다/' index.html
LATEST_TAG=$(git tag --sort=-v:refname | head -n 1)
NEXT_NUM=$((${LATEST_TAG#v} + 1))
NEXT_TAG="v${NEXT_NUM}"
git add .
git commit -qm "V${NEXT_NUM}: 본문 문구 수정"
git tag $NEXT_TAG
git tag -l
```

→ 예상 관찰: `v1`, `v2` 두 태그가 출력된다. 명령을 손으로 계산하지 않고 태그에서 다음 번호를 계산하는 것이 핵심 습관이다.

## 단계 6 — V1로 복원 (스킬 §4.3: checkout → 새 버전 커밋 → 태그)

```bash
TARGET_TAG="v1"
LATEST_TAG=$(git tag --sort=-v:refname | head -n 1)
NEXT_NUM=$((${LATEST_TAG#v} + 1))
NEXT_TAG="v${NEXT_NUM}"
git checkout -q $TARGET_TAG -- .
git add .
git commit -qm "V${NEXT_NUM}: 恢复至 V1"
git tag $NEXT_TAG
grep -o "첫 버전입니다" index.html
git tag -l
```

→ 예상 관찰: `첫 버전입니다` 가 다시 보이고(내용이 V1로 돌아옴), 태그는 `v1 v2 v3` 세 개. **복원도 새 버전(V3)을 만든다** — 기존 태그를 덮거나 지우지 않는다.

## 중간 확인 ②

```bash
git log --oneline | wc -l && git tag -l | wc -l
```

→ 예상 관찰: `3` 과 `3`.

## 완성물 확인 (섹션 6)

```bash
git tag -l
git log --oneline
```

→ 예상 관찰: 태그 `v1 v2 v3`, 로그가 "V3: 恢复至 V1 / V2: 본문 문구 수정 / V1: 최초 블로그 페이지" 순(최신 먼저). 이 세 가지가 보이면 수명주기(생성→수정→복원)를 전부 성공한 것이다.

## 다음 학습 경로 (섹션 7)

- meta.json 전체 필드 규격 → `skills/version-management/references/meta-json-spec.md`
- 특수 출시 형태(다중 진입, prototype 쌍파일, 고정 이미지 export) → `skills/version-management/references/delivery-variants.md`
- 운영 경험을 스킬로 승격하는 법 → `skills/task-review/tutorials/` 의 튜토리얼

## 문제 해결 (섹션 8)

- Q. `${LATEST_TAG#v}` 계산이 0이 나온다 → 태그가 하나도 없는 상태다. 단계 3을 먼저 수행했다면 `git tag -l`로 태그 존재를 확인한다.
- Q. 복원 후에도 수정 내용이 남아 있다 → `git checkout $TARGET_TAG -- .` 뒤에 `git add .` + 커밋을 빠뜨렸을 가능성이 크다. 스킬 규칙: checkout만으로는 복원 완료가 아니며, 새 버전 커밋까지가 복원이다.
- Q. 빌드 산출물을 포함해 커밋했는데 내용이 옛날 것이다 (2026-09-10 실측 장애, `references/faq.md` 1번 항목) → 산출물은 "이번 입력의 신선한 출력"인지 특징 문자열로 검출한 뒤 커밋한다. 스테일 산출물 커밋은 폐기 후 전체 파이프라인 재실행.
- Q. push가 거부된다 (2026-09-10 실측 장애, faq 2번 항목) → `git fetch origin` 을 push 절차의 첫 단계로 고정한다. 병행 세션의 커밋 분기가 원인일 수 있다.
