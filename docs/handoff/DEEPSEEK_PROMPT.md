# 딥시크에게 전달할 프롬프트

```text
https://github.com/apple01234/CERTZ 의 main에서 이어서 작업해. 다른 저장소에는 커밋/푸시하지 마.

먼저 AGENTS.md, skills/ponytail/SKILL.md, docs/handoff/CURRENT_HANDOFF.md, docs/handoff/REA_APPLY_VALIDATION.md를 읽고 git status와 최신 커밋을 확인해. 예전 DEEPSEEK_HANDOFF.md와 미적용 patch에는 이미 바뀐 내용이 있으니 현재 인계 문서/코드를 우선해.

원래 GameRoot/WorldScene/Player와 인벤토리·장비·전직·스탯·제작·하우징·계정·파티·던전·터치 기능을 유지해. 새 축소 캠페인이나 자체 엔진으로 갈아엎지 마. 아뜰란티스/이그드라실과 9개의 바다 이야기는 되살리지 마.

정본은 docs/handoff/evernote-approved/1.txt~8.txt만 숫자순으로 읽어. 다른 기획서 항목은 읽지 마. 앞 문서를 우선하므로 구조자는 라일락+펜던트, 주인공은 하루야. 실제 사람 이름/타 작품 명칭은 대체해. 2기는 네오시티19화 공개분을 넘는 결말을 지어내지 마.

현재 원본 엔진에는 실제 TilemapLayer3개/165필드 구조, 10개 직업 전승 S1과 준비·발동·후딜/취소, 15장16카메라 연출, 회전/회수되는 가구 발밑 충돌이 연결돼 있어. RE 근거는 docs/campaign의 report/ledger/evidence에 있어. 14개 게임 전체를 완전 실행 분석했다거나 모든 요소가 적용됐다고 과장하지 마.

다음 핵심 작업은 howlrstone.ts/lilacStory.ts의 기존 퀘스트·대사를 개정 하루 정본에 맞추고 실제 목표/맵/보스를 일치시키는 거야. 현재 첫 필드는 도서관이고 구출은 회상이라 완전 정렬이 안 됐어. 첫1레벨 의뢰 EXP72000→즉시26레벨 문제도 고쳐. 인간 보스의 SPUM 애니메이션/스킬 패턴과 지역별 일관된 다운로드 에셋을 적용해. grandPlanetCanon.ts/storyRevision.ts는 미사용 초안이라 무작정 활성화하지 마. 기존 전직 트리의 corsair/raider 상위 승계 문제도 인계 문서에 있어.

에셋은 기존 자료/다운로드를 최우선으로 하고 꼭 필요할 때만 생성해. 원래 런타임 에셋을 배포에서 삭제하지 마. /reverse-engineer-anything 스킬로 확인된 구조를 현재 엔진에 실제 적용하고, 보고서 추가만 하고 끝내지 마.

npm test, npx tsc --noEmit, npx eslint src --max-warnings 0를 통과시키고 scripts/verify-rea-runtime.mjs와 스크린샷으로 실제 화면을 검증해. 기존 기능/저장 보존을 확인하고 CERTZ/main에 커밋해. APK/운영 배포는 실제 빌드/설치/배포 전까지 완료라고 말하지 마. 완료한 범위와 미완료 범위를 솔직히 구분해.
```
