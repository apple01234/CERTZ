# SERTZ #1/#5/#6 최소 구현 검증

## 결과

|항목|원인/확인|변경|증거|상태|확인 필요|
|---|---|---|---|---|---|
|NPC 초상|월드 대부분은 SPUM이 아닌 npcbody_*를 사용. 대화만 별도 npcface 생성 얼굴을 썼음|현재 npcbody 원본 14개와 npc_gm 원본 1개를 무손실 crop, 31키 mapping. DialogueBox에 연결|`python3 tools/crop_npc_portraits.py --check`: 15 crops / 31 mapped keys; exact source pixels|구현|실제 브라우저 표시/월드 fallback 시 외형 일치 미검증|
|세계관 순서|CHAPTERS 본편 필드는 9개이지만 num은 2~10이고 village가 기존 제1장. 제10장 abyss는 이미 있음|STORY_SEQUENCE/표시 문자열 추가. 대화창에 순서 표시. 기존 챕터/저장키/인덱스 변경 없음|HEAD 대비 CHAPTERS/NEXT_STAGE/PREV_STAGE/스테이지 키 전체 동등 검사|표시/데이터 구현|하울르스톤: 영준 프린세스 실제 중간편 스토리/게이트는 미구현. 임의 내용 생성 안 함|
|사냥터 BGM|DLC/재림은 테이블 미배정으로 숲 기본곡 fallback이었음|DLC 10개/재림 15개를 기존 테마별 음원에 명시 배정. 보스곡 유지|205개 사냥터 함수 실행, 사용/플레이리스트 49개 Ogg 헤더/파일 실존 검사|구현|청취/브라우저 디코드/체감 음량 미검증|
|라고스|참고 이미지 없음|현재 월드 npcbody_merchant 픽셀 crop만 사용|원본 SHA256/crop좌표 _map.json 기록|기존 외형 보존|새 외형 확정/고증은 하지 않음|

## 숫자 해석

- 본편은 **시작 마을 제1장 + 필드 챕터 9개(제2~10장)**. 독립 전투 필드 챕터 10개가 있다는 주장은 하지 않는다. 제10장 `abyss`를 새로 만들 필요도 없다.
- 기존 DLC는 10개이며 현재 순서는 그대로 유지한다. 표시된 세계관 순서가 실제 중간편 진행 구현까지 완료되었다는 뜻은 아니다.
- 원본 생성기(gen_npc_bodies.py, gen_npc_faces.py)를 실행하거나 새 인물/플레이어블 아트를 생성하지 않았다. crop은 기존 파일 픽셀 복사뿐이다.
- SPUM이 npcbody로 fallback되는 월드 경로가 있으므로 미로드 상태에서는 초상/몸체 패밀리가 일치하지 않을 수 있다. 런타임 확인은 남았다.

## 검증

```
npx tsc --noEmit --incremental false
npx eslint src/components/game/DialogueBox.tsx src/game/audio.ts src/game/stages.ts --max-warnings 0
# 둘 다 exit 0
node --experimental-strip-types tests/story-portraits-audio.test.mjs
ALL CHECKS PASS: 15 crops / 31 mapped keys; exact source pixels
ALL CHECKS PASS: 205 hunt stages / 49 real Ogg tracks / 31 portrait mappings; chapter/save order unchanged
```

UI sloplint: **기존 코드 위반 5 FAIL / 0 WARN** (focus-visible 1, motion-reduce 1, 기존 색상 literal 3). UI 전체 개편은 범위 밖이므로 건드리지 않았다. 브라우저 플레이/빌드 미실행. commit/push/build 전부 안 함.

## 부모용 WorldScene/BootScene snippet (직접 수정하지 않음)

- React `<img>`가 `/assets/npcportrait/...png`를 직접 읽으므로 **BootScene 신규 preload는 필요 없다**.
- 선택 사항: 월드 실제 텍스처를 대사 이벤트의 `portrait`에 넘기면 NPC_BODY_OF 이중표 관리와 미로드 fallback 불일치를 피할 수 있다. 예: 기존 `showDialogueRaw` 이벤트 payload가 허용하는 위치에 `portrait: npc.texture.key` 추가. 단, 실제 메서드 시그니처/타입 확인 후 부모가 적용해야 한다.
- WorldScene에 아직 `spum_mage` 직접 렌더 경로(입장 관리인, 조사 시 14606행)가 남아 있다. 그 인물은 npcbody_mage 초상과 일치하지 않을 수 있어 부모가 패밀리 통일 여부 확인 필요.
- 하울르스톤 중간편의 원문/챕터/입장 조건이 없으므로 기존 Grand Planet 게이트를 강제로 막거나 가짜 중간편을 추가하지 않았다.

## 파일

수정: src/game/stages.ts, src/game/audio.ts, src/components/game/DialogueBox.tsx.
추가: tools/crop_npc_portraits.py, tests/story-portraits-audio.test.mjs, public/assets/npcportrait/*.png(15개), public/assets/npcportrait/_map.json, 이 문서.
