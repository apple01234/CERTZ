# REA 레퍼런스 분석 및 반영

REA 6.8.0을 설치하고 Codex MCP 등록, initialize 및 도구 229개 조회를 검증했다. 설치된 공식 스킬과 참조 문서는 `skills/reverse-engineer-anything/`에 복사했다. 원본: https://github.com/morluto/rea (MIT).

입력 `reverse-engineer-anything.zip`의 13개 배포본을 각각 조사했다. 아래는 정적 파일·리소스·메타데이터 분석이며, 13개 게임을 실행해서 완주한 결과가 아니다. 상세 SHA-256, 실제 REA Evidence ID, 확인 범위는 [REFERENCE_LEDGER.json](REFERENCE_LEDGER.json)에 있다.

| 자료 | 확인한 내용 | 적용 또는 유지한 설계 | 한계 |
|---|---|---|---|
| Veronikka's To-Do ENG 1.1.1.rar | 153 archive entries<br>DialogueManager, DialogueOptions, PlayerMovement, PlayerState declarations; movement state fields walk/attack/interact | Keep dialogue/menu input separate from world movement; reuse existing pause/input-reset flow | Static metadata/CIL and selected assets only; full story and runtime not played |
| BloodkeeperDemo2020_Window.zip | 273 entries in inner NW.js package; Construct project JSON<br>Tile_Ground, Collision, Tile_Foreground layer declarations and separate BossRoom_Collision | Separate visual terrain, blocking structures and collision flags; keep boss arenas open | Project declarations read; event execution and boss balance not observed |
| Morfosi_Windows_1.2.0.zip | PlayerInventory.CheckInventory / ItemObtained; CheckpointInteractable.StartedInteraction / SavingText<br>DoorController fields locked/linkedDoor/lockedDialogue/unlockDialogue | Retain item/interaction state independently from dialogue and visual objects; persistent storage-failure recovery banner | Static CIL/metadata and selected textures; no full native playthrough |
| flooded_burials_new_demo_fix_2.zip | 230 serialized GameMaker rooms<br>rlevel_select and separate rparent_area_1_stage_0; per-room sizes read | Retain chapter journal/revisit navigation and bounded encounter rooms | FORM/ROOM/STRG parsed; bytecode and compressed texture pages not fully decoded |
| Vampire_NoSurvivors_Windows.zip | 4 rooms including rmBattlefield 2000x400 and separate rmGameOver<br>objChest/objLootedChest/objTrapChest and upgrade/attack sprite declarations | Keep idempotent one-time story rewards and distinct defeat/retry presentation | Serialized rooms and identifiers; chest event behavior not executed |
| holodungeon-windows-1.3.1.zip | RoomManager.StartCombat / EndCombat / ResetPositions; separate overworld/combat BGM fields<br>SaveSystem.SaveGameExists / SaveGame / LoadGame and SaveData declarations; selected sprite/animation metadata | Keep authoritative encounter state separate from story progression, restore campaign view after battle, stream contextual combat music | Selected asset file and managed code only; unexamined asset files remain unknown |
| NightShift.zip | PE import table read statically<br>Supplied readme explicitly describes no Save/Load, 30-40 minute duration and seven day/night jump controls | Keep automatic story saves, export recovery and chapter selection; make save-failure warnings persist | Embedded game data not decoded; only PE metadata and supplied readme, no gameplay |
| WYDTTM-Windows.zip | 23 RPG Maker MV maps with six layers and separate event pages<br>2 selected JavaScript files parsed, 81292 AST nodes visited; layer/priority/passage code available | Own 16x10 layered maps, explicit passage flags and one-time progress state; do not import reference story/events | Selected source analysis only; semantic node ceilings reached, references through unselected sources remain unknown |
| FeatherPark.zip | Godot 3.5 PCK format 1: 735 resource entries read by a separate bounded parser<br>EastArea YSort and Camera2D bounds; Barn collision shapes; Interactable Area2D radius and UI prompt nodes | Sort characters/props by foot Y; use localized interaction prompts and reserved routes | REA 6.8 rejects PCK format 1; these scene observations are from the local parser, not REA; no runtime |
| AerevenAdvance_jam.gba | Header title Aereven2 Adv; valid GBA header checksum; input ROM hashed | No direct art/feature import from opaque ROM data | No emulator or map/behavior decoder; header inspection is not gameplay analysis |
| windows.zip | 820 resources extracted with containment verification; 821 inventory occurrences hash-verified<br>Interaction area, dialogue resource/timeline, mob wave and weapon resource paths | Keep map/interaction data, combat rules and presentation in separate modules | Resource identities and selected metadata; compiled Godot behavior not decompiled or played |
| SangTDB_v0.26a_64bit.zip | 27 GameMaker rooms; rm_main_class_pick and rm_tutorial_begin_secret<br>Directional player sprite declarations; separate boss intro/victory/death music files | Keep class selection, visible skill/dodge readiness and distinct boss feedback | Static room/sprite/audio declarations; action timings not measured at runtime |
| COBB CAN MOVE v1.7 webview2.zip | 63 archive artifacts extracted by REA with containment verification<br>Construct data declares Tilemap, interactBox, interactable, hunger/freeze bars and global layers | Keep context-sensitive interaction and compact, distinct cooldown/status feedback | Declarations and extracted resources; generated runtime events not executed |

## 실제 도구 사용

- REA MCP로 COBB 배포본을 열고 검사·추출·닫기까지 실행했다. 추출 63개 아티팩트와 containment 검증을 기록했다.
- REA로 Nefarius 실행 파일의 Godot 4.3 PCK를 검사하고 리소스 820개를 추출했다. 엔진 실행이나 주입은 하지 않았다.
- REA의 .NET 정적 검사로 Unity 게임 3개의 Assembly-CSharp 선언·CIL·호출/필드 참조를 읽었다. 원본 소스로 복원했다고 주장하지 않는다.
- RPG Maker JS 두 파일은 81,292 AST 노드를 검사했다. 일부 의미 분석은 노드 상한으로 제한되어 전체 실행 의미가 증명된 것은 아니다.
- 설치된 REA 6.8.0은 FeatherPark의 PCK 형식 1을 거부했다. 이 파일의 장면 정보는 별도의 범위 제한 파서로 읽은 사실이며 REA 결과로 표시하지 않는다.

## 게임 반영

- 지면/구조물/충돌을 나눈 자체 16×10 맵과 실제 통로를 구성했다. 보유 에셋으로 렌더하며 클릭 경로는 벽·물·용암을 통과하지 않는다. 보스 지역은 서버의 열린 전투장 판정과 일치하도록 분할벽을 제외한다.
- 인물·가구·나무를 발밑 Y로 정렬한다. 기존 WorldScene의 동선 보호 규칙, DECOR_SETS/DECOR_BUDGET, DialogueBox의 원본 초상 crop을 재사용한다.
- 기존 audio.ts의 곡별 게인·효과음 간격·동시 재생 상한과 제공 녹음을 재사용한다. 장면/전투에 따라 한 곡만 스트리밍한다.
- 전투의 회피·원소술 준비 시간, 피해 숫자, 목표 달성 및 최초 완료 보상을 분명히 표시한다. 저장 실패는 다른 알림에 덮이지 않는 경고와 내보내기 동선으로 연결한다.
- 기존 로그인/계정 저장소/Google Play 검증/EventBus를 재사용한다. 새 캠페인 거래·랭킹·파티와 기존 저장의 분리를 유지한다.

## 아트와 복사 범위

REA 스킬과 설정, 선택한 레퍼런스 리소스는 실제로 추출·복사했다. 레퍼런스 배포본의 이름·캐릭터·스토리를 새 게임에 넣지 않는다. 게임에 적용한 아트는 첫 CERTZ Drive 원본의 SPUM/수목/가구와 CC0 DCSS이며 SHA-256 목록을 유지한다. RPG Maker 타일 크레딧은 Lunarea/Enterbrain을 표시하고, 다른 게임도 각자의 팩 조건을 가진다. 이 분석 보고서는 그 팩들을 CC0로 재허가하지 않는다.
