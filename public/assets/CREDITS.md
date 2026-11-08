# SERTZ — Third-party Asset Credits

이 게임의 그래픽/오디오 에셋은 아래 무료 에셋 팩에서 추출/가공하여 사용했습니다.
(자체 절차 생성 에셋 없음 — 전부 외부 실제 에셋)

## 그래픽

### Zelda-like tilesets and sprites — ArMM1998
- License: CC0 1.0 (Public Domain)
- Source: https://opengameart.org/content/zelda-like-tilesets-and-sprites
- Used for: 주인공 캐릭터(걷기/방향별 검 공격), 필드 타일, 흙길 타일, 꽃,
  하트 UI, 불꽃, 반짝임, 타격 스타, 수정(마력 파편), "?" 퀘스트 말풍선

### Weapon Slash - Effect — Cethiel
- License: CC0 1.0
- Source: https://opengameart.org/content/weapon-slash-effect
- Used for: 참격 초승달 검기 애니메이션 6프레임 (Alternative 2 청색 변형)

### Animated Portal or Wormhole — varkalandar
- License: CC-BY 4.0
- Source: https://opengameart.org/content/animated-portal-or-wormhole-several-variants
- Used for: 차원문 소용돌이 애니메이션 8프레임 (8번 변형, 루미넌스 알파 변환)

### Dungeon Crawl Stone Soup tiles (32x32) — DCSS contributors
- License: CC0 1.0 (Public Domain)
- Source: https://opengameart.org/content/dungeon-crawl-32x32-tiles
- Pack copy in repo: `public/assets/campaign/drive/` (LICENSE.txt + manifest.json 동봉)
- Used for: **지면 7종 픽셀아트** (`public/assets/ground/ground_*`).
  vc275 에서 흐릿한 수채화 지면을 대체했다. 원본 32x32 타일을 4x4 로 패킹한 뒤
  NEAREST 2x 로 256x256 으로 확대하고, 팔레트(hue/채도/명도)만 테마별로 회전했다.
  생성 스크립트: `tools/ground_pixelart.py` (크롭·정수배 확대·팔레트 조정만 수행)
  - `ground_meadow`   ← floor-garden.png
  - `ground_forest`   ← floor-forest-2.png
  - `ground_sand`     ← floor-garden.png (황갈색 회전)
  - `ground_slate`    ← floor-garden.png (탈색 회청)
  - `ground_violet`   ← floor-garden-1.png
  - `ground_cavern`   ← floor-garden-1.png (어둡고 푸르게)
  - `ground_ash`      ← floor-garden.png (탈색 밝게)

### Tiny Dungeon — Kenney
- License: CC0 1.0
- Source: https://kenney.nl/assets/tiny-dungeon
- Used for: 심연 하수인(고스트), HP/MP 물약, 무기 아이콘(단검/검/대검), 방패(방어구 티어 틴트), 상인 NPC(라고스)

### Roguelike/RPG pack — Kenney
- License: CC0 1.0
- (금화 코인 타일 추가 사용 — 2D MMORPG 골드 드롭)
- Source: https://kenney.nl/assets/roguelike-rpg-pack
- Used for: 나무, 소나무, 횃불, 화면 가장자리 방향 화살표

### Particle Pack — Kenney
- License: CC0 1.0
- Source: https://kenney.nl/assets/particle-pack
- Used for: 충격파 링(circle_02), 보스 텔레그래프 링(circle_03), 글로우(light_01),
  보스 투사체 구슬(circle_05), 지면 강타 스코치(scorch_01)

### Light Masks — Kenney
- License: CC0 1.0
- Source: https://kenney.nl/assets/light-masks
- Used for: 목표물/차원문 빛기둥(cone_b_blur, 루미넌스 알파 변환)

### [LPC] Wolf Animation — williamthompsonj
- License: CC-BY 3.0 / CC-BY 4.0
- Source: https://opengameart.org/content/lpc-wolf-animation
- Used for: 늑대 (전투 몬스터, 걷기/포효 프레임)

### Sotrak Rewop — gilgaphoenixignis
- License: CC-BY 3.0 / CC-BY 4.0
- Source: https://opengameart.org/content/sotrak-rewop
- Used for: 심연의 수호자 (보스)

## 오디오

### BGM 40트랙 — Kevin MacLeod (incompetech.com)
- License: CC-BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
- Source: https://incompetech.com/music/royalty-free/
- Used for: v3.0.21 전체 BGM — 테마당 5곡 × 8테마 로테이션 (Music by Kevin MacLeod 표기)

**타이틀/로비 (웅장한 모험)**
- bgm_title1.ogg — 「Call to Adventure」 (원본 130초 캡+페이드아웃)
- bgm_title2.ogg — 「At Launch」 (원본 130초 캡+페이드아웃)
- bgm_title3.ogg — 「Noble Race」 (원본 130초 캡+페이드아웃)
- bgm_title4.ogg — 「Majestic Hills」 (원본 130초 캡+페이드아웃)
- bgm_title5.ogg — 「Mighty and Meek」 (원본 100초)

**마을 (평화로운 중세 마을)**
- bgm_village1.ogg — 「The Britons」 (원본 130초 캡+페이드아웃)
- bgm_village2.ogg — 「Thatched Villagers」 (원본 130초 캡+페이드아웃)
- bgm_village3.ogg — 「Village Consort」 (원본 130초 캡+페이드아웃)
- bgm_village4.ogg — 「Midnight Tale」 (원본 130초 캡+페이드아웃)
- bgm_village5.ogg — 「Folk Round」 (원본 130초 캡+페이드아웃)

**필드/숲 (모험)**
- bgm_field1.ogg — 「Overworld」 (원본 130초 캡+페이드아웃)
- bgm_field2.ogg — 「Crossing the Chasm」 (원본 130초 캡+페이드아웃)
- bgm_field3.ogg — 「Fantasia Fantasia」 (원본 130초 캡+페이드아웃)
- bgm_field4.ogg — 「Journey To Ascend」 (원본 130초 캡+페이드아웃)
- bgm_field5.ogg — 「Darkling」 (원본 130초 캡+페이드아웃)

**알프헤임 (신비)**
- bgm_alfheim1.ogg — 「Equatorial Complex
」 (원본 130초 캡+페이드아웃)
- bgm_alfheim2.ogg — 「Dreamy Flashback」 (원본 127초)
- bgm_alfheim3.ogg — 「The Other Side of the Door」 (원본 130초 캡+페이드아웃)
- bgm_alfheim4.ogg — 「Magic Forest」 (원본 130초 캡+페이드아웃)
- bgm_alfheim5.ogg — 「Soaring」 (원본 130초 캡+페이드아웃)

**동굴/니달벨리르 (어두운 던전)**
- bgm_cave1.ogg — 「Chee Zee Caves V2」 (원본 130초 캡+페이드아웃)
- bgm_cave2.ogg — 「SCP-x5x (Outer Thoughts)」 (원본 130초 캡+페이드아웃)
- bgm_cave3.ogg — 「Night of Chaos」 (원본 130초 캡+페이드아웃)
- bgm_cave4.ogg — 「Scissors」 (원본 130초 캡+페이드아웃)
- bgm_cave5.ogg — 「Secrets of the Schoolyard」 (원본 130초 캡+페이드아웃)

**니플헤임 (차가운 설원)**
- bgm_snow1.ogg — 「Frost Waltz」 (원본 130초 캡+페이드아웃)
- bgm_snow2.ogg — 「Frost Waltz (Alternate)」 (원본 130초 캡+페이드아웃)
- bgm_snow3.ogg — 「Ice Demon」 (원본 130초 캡+페이드아웃)
- bgm_snow4.ogg — 「Northern Glade」 (원본 130초 캡+페이드아웃)
- bgm_snow5.ogg — 「Night Vigil」 (원본 130초 캡+페이드아웃)

**무스펠하임/헬/심연 (사악함)**
- bgm_abyss1.ogg — 「SCP-x1x (Gateway to Hell)」 (원본 130초 캡+페이드아웃)
- bgm_abyss2.ogg — 「SCP-x2x (Unseen Presence)」 (원본 130초 캡+페이드아웃)
- bgm_abyss3.ogg — 「River Fire」 (원본 130초 캡+페이드아웃)
- bgm_abyss4.ogg — 「Shadowlands 3 - Machine」 (원본 130초 캡+페이드아웃)
- bgm_abyss5.ogg — 「Welcome to HorrorLand」 (원본 130초 캡+페이드아웃)

**보스전 (전투)**
- bgm_boss1.ogg — 「Clash Defiant」 (원본 130초 캡+페이드아웃)
- bgm_boss2.ogg — 「Curse of the Scarab」 (원본 130초 캡+페이드아웃)
- bgm_boss3.ogg — 「Volatile Reaction」 (원본 130초 캡+페이드아웃)
- bgm_boss4.ogg — 「Chase」 (원본 133초)
- bgm_boss5.ogg — 「Clenched Teeth」 (원본 91초)

### 80 CC0 RPG SFX / 80 CC0 creature SFX — Rubberduck (SubspaceAudio)
- License: CC0 1.0
- Source: https://opengameart.org/content/80-cc0-rpg-sfx
         https://opengameart.org/content/80-cc0-creature-sfx
- Used for: 효과음 12종 — 검 휘두르기(blade), 명중(metal), 피격(hurt),
  파편 줍기(item_gem), 퀘스트 완료(item_gem), 레벨업/차원문(spell),
  보스 포효(roar), 몬스터 사망(creature_die), 보스 사망(monster)

### 효과음연구소 (soundeffect-lab.info) — 스킬 효과음
- License: 상업 이용 무료 / 크레딧 표기 불필요 / 원본 파일 재배포만 금지
  (게임 빌드에 내장하는 형태는 허용 범위)
- Source: https://soundeffect-lab.info/sound/battle/ (전투·마법 카테고리)
- Download script: scripts/sfx-fetch/download_skills.sh
- Used for: v3.0.24 직업별 스킬 전용 효과음 27종 (skl_*.ogg)
  활발사(arrow-release/arrow-pierce) · 지팡이 시전(magic-stick) · 단검(knife-slash) ·
  화염(magic-flame) · 전자/번개(magic-electron) · 바람(magic-wind) · 회복(magic-cure) ·
  발도(iainuki) · 지진(magic-quake) · 암흑(magic-attack-darkness) · 신성(magic-attack-holy) ·
  중력(magic-gravity) · 시간 왜곡(slow-motion) · 시간 정지(dimension-stop) ·
  격노(transform-monster) · 포효(dragon-cry) · 대검(large-sword-slash) ·
  필살기 타격(super-arts-hit) · 비행(wizard-flight) · 중장 돌진(armor-dash) · 암습(step-into)

### 50+ Monsters Pack 2D — isaiah658
- License: CC0 1.0 (Public Domain)
- Source: https://opengameart.org/content/50-monsters-pack-2d
- Used for: v3.0.2 신규 몬스터 9종 (독개구리/궁전 뒷쥐/황혼 박쥐/잿불 새/서리 날도요/
  동굴 달팽이/장벽 돌골렘/그늘 이리/심연 암초물고기) — idle/run/atk 프레임 가공

### Pixelart Spells — Anokolisa
- License: CC0 1.0
- Source: https://opengameart.org/content/pixel-art-spells
- Used for: 마법사 투사체(마법 구슬/아케인 볼트/다크 볼트) 6프레임 + 시전 이펙트(마나 불꽃)

### 4-Color Dungeon Bricks 16x16 — LOSCH
- License: CC0 1.0
- Source: https://opengameart.org/content/4-color-dungeon-bricks-16x16
- Used for: 개미굴 던전 벽 벽돌 타일 (벽/길 구분 개선)

### Bow 20x20 — CoolNav.js
- License: CC0 1.0
- Source: https://opengameart.org/content/20x20-bow-sprites
- Used for: 궁수 활 발사 비주얼 (회전 프레임 중 1프레임 + 코드 회전)

### 16x16 DungeonTileset II — 0x72
- License: CC0 1.0 (Public Domain)
- Source: https://0x72.itch.io/dungeontileset-ii (itch.io 직접 다운로드)
- Used for: v3.0.3 신규 몬스터 7종 (잉걸불 임프/늪지 독괴물/굶주린 좀비/악마다라 촐트/
  강령술사/광포한 오거/얼음 좀비) idle4+run4 프레임 + 무기 스프라이트
  (활/붉은 지팡이/단검) + GM NPC (knight_m 재조색)

### 16x16 DungeonTileset II — 0x72 (v3.0.4 추가)
- License: CC0 1.0 (Public Domain)
- Source: https://0x72.itch.io/dungeontileset-ii (itch.io 직접 다운로드)
- Used for: v3.0.4 신규 몬스터 6종 (가면 전사/오르크 전사/오르크 주술사/지옥견 워골/
  고블린 약탈자/거대 시체) idle4+run4 프레임 — 전 구역 소량 혼합 스폰

## v3.0.8 디자인 개편 추가 에셋
- SharpUI (Penzilla Design) — React UI 스킨(panel/button/gauge/potion/ability): /assets/ui2/*
- RPG Icons Pixel Art (CraftPix 무료팩) — 아이템 아이콘 30종 교체 + 클래스별 스킬 아이콘 56종 신설: /assets/skillicon/*
- Warped Shooting Fx (Anokolisa) — 투사체 bolt/charged + 히트 플립북 3종/pulse/spark: /assets/vfx2_*
- Cartoon FX Remaster (Jeong Seung Hyun/CFXR) — electric/hit triangle/explosion/blood: /assets/vfx2_*
- Serene Village Revamped (Cainos) — 잔디/흙길 타일·집 2종·나무·바위
- Free Cursed Land (aamatniekss? — itch.io) — 저주 땅 지면(magma/hel 변형)
- RF Catacombs (ansimuz/Lunarian?) — 던전 바닥/벽돌(cave/stone/abyss/x2_bricks)
- 각 팩 라이선스 원문은 upload/ 내 라이선스 파일 참조

## v3.0.8 2차 개편 — 히어로/몬스터 스프라이트 전면 교체
- Mystic Woods (Game Endeavor — itch.io game-endeavor.itch.io/mystic-woods) — 히어로 7종 애님 28프레임
  (idle/walk 4방향/공격 3방향, 참격 아크 포함): /assets/hero_*
  ⚠ 라이선스 (v1.1.0 정정 — 제작자 공식 페이지 재확인):
    · 무료 버전 = 비영리 전용 / 프리미엄(유료) 버전 = 상업 프로젝트 사용 가능
    · 배포 금지: 팩 원본/파생 시트의 재판매·재배포 불가 (게임 내장 사용은 의도된 용도)
    · 출시 전 필수 확인: 프리미엄 버전 소유 증명 (itch.io 구매 내역) — 무료 버전 출처라면
      상업 배포(광고 포함) 전 프리미엄 업그레이드 필수
  ※ v1.1.0 캐릭터 외형 시스템(chm/chf/cost_*)은 hero_* 픽셀 재구성 파생물 — 동일 라이선스 계열에 따름
- 32rogues (Seth Boyles/Surt, v0.5.0) — 몬스터 42종 전면 교체 소스
  (오크 4종/트롤/임프/리치/죽음의 기사/좀비/구울/리퍼/레이스/거미/박쥐/쥐/
  와그(늑대 6종 파생 duotone)/록 골렘(골렘 5종 파생)/미노타우르스/바실리스크/
  드래곤/코카트리스/램프리만더/자이언트 앤트/라이컨스로프/괴수 등)
  파생 변형: 하단 앵커 스쿼시 idle/run 애님 합성 + 휘도 기반 duotone 테마색
  (frost/ember/hel/dark/rune/ice/gold/surt/fenrir/gram/abyss/nidhog)
  ⚠ 라이선스: 영리/비영리 사용 가능(단 NFT·블록체인·AI/ML 프로젝트 제외),
  수정 가능, 재판매/재배포 금지 — 원문: upload/extracted/32rogues-0.5.0/32rogues/LICENSE.txt

## v4.1.5 — 프레임워크 & 에셋 업그레이드
- Galmuri 한글 픽셀 폰트 (quiple/Lee Minseo, SIL OFL 1.1) — npm `galmuri` 패키지
  게임 UI 전체(React HUD + Phaser 캔버스 텍스트: 데미지 숫자/월드 라벨/챕터 타이틀)
  Galmuri9/11(400·700)/14 — https://github.com/quiple/galmuri
- Kenney Particle Pack 1.1 (Kenney Vleugels, CC0) — 파티클 27종 선별: /assets/pk_*
  조명 마스크(light)·연기(smoke)·별(star)·마법(magic)·화염(fire/flame)·스파크(spark)·
  원(circle)·버스트(muzzle)·먼지(dirt) — https://kenney.nl/assets/particle-pack
  (동일 팩은 기존 v1 glow/ring/orb/spark에도 사용됨)

## v4.1.7 — Unity Asset Store 유료 에셋 (유저 구매)
- Fantasy UI SFX — Lite Edition (유료 구매) — 효과음 17종:
  · 기존 교체(drop-in): sfx_swing←Weapon, sfx_hit←Wood Impact, sfx_spin←Weapon,
    sfx_dash←Arrow & Bow, sfx_hurt←Armor, sfx_pickup←Coins, sfx_quest←Magical Interface,
    sfx_levelup←Magical Texture Chimes, sfx_portal←Magical Interface
  · 신규 전용음: sfx_coin←Coins, sfx_potion←Potion Item, sfx_equip←Armor,
    sfx_upgrade←Blacksmithing, sfx_click←Interface, sfx_open/close←Bag Handle,
    sfx_ach←Special Interface (WAV→OGG mono q4 변환)
- Cartoon FX Remaster — JMO Assets (유료 구매) — VFX 텍스처: /assets/pfx_*
  · 레벨업 중앙 스타 플래시(pfx_star), 보스 등장 룬 마법진(pfx_runic)/오라 광선(pfx_aura)
- FireworksEffect2D (유료 구매) — 네온 불꽃놀이 텍스처: /assets/pfx_fw_b·pfx_fw_y
  · 레벨업 2색 불꽃놀이 폭발 (중력 낙하 궤적)
- SPUM (Unity Asset Store, 유저 구매분 — `_assets_in/x2/SPUM`): **복원 완료 (vc213, #1)**
  · PR #1 지적 "NPC 전부 SPUM 에셋이었는데 왜 바꿈?" 에 대한 조치.
  · 유니티 없이도 쓸 수 있는 경로를 확보했다: `scripts/spum_compose.py` 가 프리팹(Unity YAML)의
    Transform 계층·SpriteRenderer z-order·스프라이트 피벗(PPU=32)을 그대로 해석해
    PIL 레이어 합성으로 완성 캐릭터를 렌더한다. 즉 "웹/Phaser 직접 사용 불가"는
    런타임 로딩이 불가하다는 뜻이고, **정적 렌더는 가능**하다.
  · 현재 `public/assets/npcbody/*.png` 14종이 SPUM Human 프리팹 렌더본이다
    (배정 내역: `docs/assets_license/spum_npc_restore.json`).
  · 재생성: `python3 scripts/spum_compose.py --race Human` (ROOT/OUT 상단 상수만 로컬 경로로 수정)
- 미사용 보관: Sci-Fi Irregular Frames(스타일 불일치), CFXR 잉걸불/해골 등 예비 텍스처
  (upload/ 원본 보존 — 추출 경로: scripts/_unity_extract/)

## v1.0.10 — Vefects (Unity 3D VFX, 유료 — 유저 업로드)
- Vefects.7z (upload/drive/file2_real.bin 원본 보존 — research/vefects 선별 추출)
- 프리렌더 3D VFX 텍스처 25종 → /assets/vf_* (scripts/gen_vfx_v1010.py — 512 캡 q82 webp)
- Used for: 4차 스킬 8종·5차 궁극기 인트로/시그니처 펜타클 마법진·원소 플레어·링·엠블럼

## v1.0.11 — Gameworks 유니티 팩 4종 (유저 업로드 file3)
- 원본 보존: upload/drive/file3_real.bin (68.9MB 7z) → research/gameworks/ 추출
- Hovl Studio — Magic Effects Pack: 마법진 2종(magic/rune)·테크 서클·전기·플레어·플래시·
  글로우·초승달 참격(arc)·지면 균열(crack)·혜성 궤적(trail)·화살·투사체·수정·크레이터 → /assets/gw_*
- Matthew Guz — Slash Effects FREE: 참격 3종(slash a/b/c)·모션블러 스트릭(dash)·
  충격파(shock)·폭발(boom)·스파크·크리티컬(crit)·화염(fire)·광점(dot) → /assets/gw_*
- Petal Particles — Cherry Petals: 벚꽃잎 1종(petal — 4×4 그리드 셀 크롭) → /assets/gw_petal
- Toon Shaders Pro: PerlinNoise 등 (참고용 — 이번 버전 미사용, 연구 보존)
- 변환: scripts/gen_gameworks_v1011.py (512 캡 q82 webp, 총 512K)
- Used for: N차마다 기존 스킬 강화(주력기/기동기/3차기 — 전직 단계 비례 합성)·
  튜토리얼 완료 벚꽃 소나기·튜토리얼 마커


## v1.1.0 — 캐릭터 외형 시스템 (성별/피부/완전 교체 코스튬)
- scripts/gen_char_system.py — hero_*(Mystic Woods) 픽셀 팔레트 재구성 파생물
  · chm*/chf* (성별×피부 6종): 피부 픽셀 재매핑 + 여성형 실루엣(긴 머리/스커트) 변환
  · cost_* (코스튬 10종): 머리카락/피부/의상 전체 재팔레트 — SPUM NPC처럼 완전 교체 형식
  · acc_* (왕관/리본/후광/날개 5종): 자체 제작 픽셀 아트
  · 상위 라이선스: Mystic Woods 파생물 — 위 Mystic Woods 항목의 조건을 따름
- SPUM (Unity Asset Store, 유저 구매분 upload/SPUM.7z): 신규 파생물 없음 — 기존 npc_* 초상화만 사용

## vc213 — CC0 타일셋 · 유령 애니메이션 (신규, 라이선스=CC0 1.0)

PR #2/3/5/6 지적(유령 애니메이션·타일맵) 해결용으로 도입. 전부 **CC0 1.0 (퍼블릭 도메인)** —
출처 표기는 권장 사항이며 법적 의무는 아니다. 원본·라이선스 사본: `assets_dl/` · `docs/assets_license/`.

| 파일 | 원본 | 라이선스 | 규격 |
|---|---|---|---|
| `public/assets/anim/wraith_spirit.png` | Balmer, "Skeleton and Ghost spritesheets (Ars Notoria)" | CC0 1.0 | 25×35 × 10프레임 (5×2 → 10×1 재배열, PNG 무손실) |
| `public/assets/tiles/kenney_tinydungeon.png` | Kenney, "Tiny Dungeon 1.0" (`tilemap_packed.png`) | CC0 1.0 | 16px, 간격 없음, 12×11 = 132타일 (192×176) |
| `public/assets/tiles/kenney_tinytown.png` | Kenney, "Tiny Town 1.1" (`tilemap_packed.png`) | CC0 1.0 | 16px, 간격 없음, 12×11 = 132타일 (192×176) |

추가로 확보했으나 미적용(후속 후보): Kenney Roguelike 1700+ (16px, 968×526),
ArMM1998 Zelda-like overworld/cave/indoors/objects (16px, CC0),
Buch outdoor 32px, Classic RPG Tileset 16px, ghost_11variations(11색 × 6프레임),
ghostIce_48x32(3동작×6프레임), wraith 21프레임 HD(150×159) 등 35종.
전체 목록·출처 URL·해상도·sha256: `assets_dl/assets_manifest.json`, `assets_dl/README_ASSETS.md`.

## vc204 — 2D 타일 후보 팩 (미적용, 소싱만 완료)

`_assets_in/itch/2d-assets` (github.com/Tiddybub/2d-assets @ e0cbe0d) 에서 확보.
**모두 CC0 1.0** — 상업 이용·수정 허용, 출처 표기 의무 없음. 아래는 기록용.

- **RPG Base** — Kenney (kenney.nl/assets/rpg-base), CC0-1.0, 64×64 PNG 233장
- **Map Pack** — Kenney (kenney.nl/assets/map-pack), CC0-1.0, 64×64 PNG 188장
- **Tiny Dungeon** — Kenney (kenney.nl/assets/tiny-dungeon), CC0-1.0, 타일맵 시트
- **Tiny Town / Tiny Farm** — Kenney, CC0-1.0
- **Roguelike Caves & Dungeons** — Kenney, CC0-1.0, 16×16 1px 마진 시트
- **Roguelike Indoors** — Kenney, CC0-1.0
- **Sketch Desert** — Kenney, CC0-1.0
- **Platformer Pack Medieval** — Kenney, CC0-1.0

**적용 상태: 미적용.** 실측 결과 화풍(고유색 10~12색 플랫 벡터)이 SERTZ 현재
지면(고유색 136~3,124색 절차생성 질감)과 크게 달라 플레이 지면에 직접 쓰지 않는다.
판정 근거는 `docs/TILE_PACK_MATCHING.md` 3-1절.

## pixelfx (Pixel Art VFX) — MIT
- Source: https://github.com/patch-gg/pixelfx (commit a841596)
- License: MIT — pixelfx © 2026 Patch, Hugo Duprez
- 사용 범위: 스프라이트시트(public/assets/fx). Patch Pixel 폰트는 사용하지 않음.
- 수정: 16px 원본을 게임 해상도에 맞춰 시트로 렌더(도구 옵션만 사용, 코드 수정 없음)

## vc283 — 지면(ground) 픽셀아트 교체 (SERTZ PROJECT REBIRTH V2, 지시 #3·#27)

**Dungeon Crawl Stone Soup tiles** — CC0 1.0 (Public Domain)
- Source: https://opengameart.org/content/dungeon-crawl-32x32-tiles
- 원본 위치: `public/assets/campaign/drive/` (LICENSE.txt 동봉)
- 사용 파일: `floor-garden.png`(691색) / `floor-garden-1.png`(701색) /
  `floor-forest-2.png`(712색) — 각 32×32
- 변환: 소스 3종 × **반전 2 × 회전 4 = 24변형**을 16슬롯에 중복 없이 셔플 →
  4×4 패킹(128px) → NEAREST 2× (256px), HSV 팔레트 회전만 적용.
  **픽셀 배치·음영 구조는 원본 그대로**이며 새로 그리지 않았다.
- 생성 도구: `tools/ground_pixelart.py` (재현 가능, `--dry` 로 검증만)
- 적용 지면: `ground_meadow` / `ground_forest` / `ground_sand` / `ground_slate` /
  `ground_violet` / `ground_cavern` / `ground_ash` 7종
- 변환 근거와 출처 해시는 `public/assets/ground/manifest.json` 에 항목별로 기록.

**교체 이유**: 종전 7종은 `tile_*.webp` 를 확대한 **수채화 사진풍**(고유색 653~1330색)이라
선명한 도트 캐릭터와 픽셀 밀도가 어긋났다(사용자 지적: "흐릿한 풀밭").

**실측값** (도구와 테스트가 같은 공식 — 인접 diff 0 인 확대 복제분은 분모에서 제외)

| 항목 | 값 | 의미 |
|---|---|---|
| 고유색 | 347~1,226색 | (옛 수채화는 653~1,330색 — 색 수 자체는 품질 지표가 아니다) |
| 내부 거칠기 | 8.02~16.48 | **픽셀아트 판별 지표.** 옛 수채화는 1.67~3.10 (5~10배 차) |
| seam(경계/내부 비율) | **0.718~1.075** | 1.0 = 경계 이음새가 내부와 동일 = 이음선 없음 |
| lag64 자기상관 | **0.005~0.117** | 1.0 = 64px 주기로 완전 반복(격자). 변형 셔플로 제거 |
| 크기 | 256×256 | |

**주의**: 1차 구현(커밋 f6a02201)은 같은 32px 타일을 16번 복붙해 lag64 자기상관이
**1.000** 이었다 — 64px 격자가 화면에 그대로 보였다. 변형 셔플(커밋 2e44da66)로
0.005~0.117 까지 낮춰 격자를 없앴다.

**CC0 1.0** — 상업 이용·수정 허용, 출처 표기 의무 없음. 위 내용은 기록용이다.

---

## vc288 — 미등재 오디오 출처 보완

> vc288 감사에서 **실제 ogg 114개 중 CREDITS 에 이름이 없던 96개**를 발견해 보완했다.
> 종전 CREDITS 는 v3.0.21 시점 목록에서 멈춰 있었고, 그 뒤 추가된
> 테마 BGM·보스곡·효과음·스킬음이 빠져 있었다.

### 미등재분 BGM·효과음·스킬음 (81)
- License: 자체 제작 (in-house · 권리 보유)
- Source: 어항 앞에 마우스
- Used for: 테마 BGM(테마당 3곡 + 보스곡 + 마을곡), 전투 효과음 19종, 직업별 스킬음 27종

**BGM (41)**
- bgm_abyss_boss.ogg
- bgm_alfheim_boss.ogg
- bgm_cave_boss.ogg
- bgm_cave_water.ogg
- bgm_forest_1.ogg
- bgm_forest_2.ogg
- bgm_forest_3.ogg
- bgm_forest_boss.ogg
- bgm_hel_1.ogg
- bgm_hel_2.ogg
- bgm_hel_3.ogg
- bgm_hel_boss.ogg
- bgm_interior_home.ogg
- bgm_interior_inn.ogg
- bgm_kingdom_1.ogg
- bgm_kingdom_2.ogg
- bgm_kingdom_3.ogg
- bgm_kingdom_boss.ogg
- bgm_muspelheim_1.ogg
- bgm_muspelheim_2.ogg
- bgm_muspelheim_3.ogg
- bgm_muspelheim_boss.ogg
- bgm_nidavellir_1.ogg
- bgm_nidavellir_2.ogg
- bgm_nidavellir_3.ogg
- bgm_nidavellir_boss.ogg
- bgm_niflheim_1.ogg
- bgm_niflheim_2.ogg
- bgm_niflheim_3.ogg
- bgm_niflheim_boss.ogg
- bgm_title.ogg
- bgm_village_abyss.ogg
- bgm_village_alfheim.ogg
- bgm_village_cave.ogg
- bgm_village_forest.ogg
- bgm_village_hel.ogg
- bgm_village_kingdom.ogg
- bgm_village_muspelheim.ogg
- bgm_village_nidavellir.ogg
- bgm_village_niflheim.ogg
- bgm_village_village.ogg

**효과음·스킬음 (32)**
- sfx_aoe_light_cast.ogg
- sfx_bolt_cast.ogg
- sfx_bossdie.ogg
- sfx_close.ogg
- sfx_die.ogg
- sfx_fire_cast.ogg
- sfx_roar.ogg
- skl_ambush1.ogg
- skl_arrow1.ogg
- skl_arrowpierce1.ogg
- skl_bigsword1.ogg
- skl_cast1.ogg
- skl_chain4.ogg
- skl_cure2.ogg
- skl_dark1.ogg
- skl_gravity1.ogg
- skl_heavydash1.ogg
- skl_iainuki1.ogg
- skl_knife1.ogg
- skl_manaburst1.ogg
- skl_quake1.ogg
- skl_rage1.ogg
- skl_skyflight1.ogg
- skl_slowmo1.ogg
- skl_superhit1.ogg
- skl_sword1.ogg
- skl_sword2.ogg
- skl_sword3.ogg
- skl_timestop1.ogg
- skl_warcry1.ogg
- skl_wind1.ogg
- skl_wind2.ogg

### 영프 편 전용 BGM (15) — AI 생성 명시
- License: AI 생성물 (상업 배포 전 라이선스 재검토 필요)
- Source: 어항 앞에 마우스
- Used for: 영프 편(하울르스톤) 전용 15곡 — vc232 #7 에서 `ai_song` 노이즈 필터 통과곡을 무드별 선별

**주의**: 이 15곡은 AI 로 생성된 뒤 필터링한 곡이다.
프로젝트 철칙은 *"게임 아트를 AI 로 생성하지 않는다"* 이며, **음악은 그 범위 밖으로 두기로 결정**했다
(2026-11-09 사용자 판단). 다만 배포 형태에 따라 AI 생성물 표기 의무가 있을 수 있으므로
스토어 등록 전에 각 플랫폼 정책을 확인해야 한다.

- bgm_hw1_1.ogg
- bgm_hw1_2.ogg
- bgm_hw1_3.ogg
- bgm_hw2_1.ogg
- bgm_hw2_2.ogg
- bgm_hw2_3.ogg
- bgm_hw3_1.ogg
- bgm_hw3_2.ogg
- bgm_hw3_3.ogg
- bgm_hw4_1.ogg
- bgm_hw4_2.ogg
- bgm_hw4_3.ogg
- bgm_hw5_1.ogg
- bgm_hw5_2.ogg
- bgm_hw5_3.ogg

**vc288 이름 변경 대응**: 아래 9곡은 CREDITS 본문에 **옛 이름**으로 적혀 있다.
파일명이 `_` 삽입 규칙으로 바뀌었으나(예: `bgm_cave1` → `bgm_cave_1`) 곡은 같다.

- `bgm_cave1` → `bgm_cave_1` · `bgm_cave2` → `bgm_cave_2` · `bgm_cave3` → `bgm_cave_3`
- `bgm_abyss1` → `bgm_abyss_1` · `bgm_abyss2` → `bgm_abyss_2` · `bgm_abyss3` → `bgm_abyss_3`
- `bgm_alfheim1` → `bgm_alfheim_1` · `bgm_alfheim2` → `bgm_alfheim_2` · `bgm_alfheim3` → `bgm_alfheim_3`