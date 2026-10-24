# 직업 트리 — 5계열 / 28직업

`src/game/classes.ts`가 단일 진실 공급원(single source of truth)이다.
이 문서는 그 파일을 읽을 때 길잡이 역할만 한다.

## 구조

```
1차 (Lv10, 5계열)
 └─ 2차 (Lv30, 계열당 2)
     └─ 3차 (Lv50, 계열당 2)
         └─ 4차 (Lv100, 계열당 2)
```

- 1차/2차는 Z(주력기)·C(기동기) 2개 스킬.
- 3차부터 V(3차기) 해금, 4차에서 B(4차기) 해금.
- 5차 궁극기는 Lv200, 계열 폴백 1종 + 4차 세부직업 전용 1종.
- 자유 전직: 2차 이상에서 같은 부모를 둔 형제 직업으로 전환(골드 5,000, 무제한).

## 5계열 요약

| 계열 | 색 | 정체성 | 전투 리듬 |
|---|---|---|---|
| 전사 warrior | `#ff9a8a` | 맷집·근접·보스 특화 | 버티며 정면 |
| 궁수 ranger | `#7dffa8` | 치명타·기동·정밀 | 거리 유지 |
| 마법사 mage | `#a5b9ff` | 고화력·유리 대포 | 한 방에 건다 |
| 도적 thief | `#e8c0ff` | 연타·암습·회피 | 파고들어 긁는다 |
| 해적 pirate | `#ffd76a` | **광역·아군 버프** | **넓게 쓸고 판을 키운다** |

## 각 계열 상세

### 전사 warrior
| 차수 | 직업 | 특징 |
|---|---|---|
| 1 | 전사(검사) | atk18/hp120, boss+8 |
| 2 | 버서커(광전사) | atk18/crit6/boss12, skillMult 1.05 |
| 2 | 가디언(수호자) | def8/hp160/spd5 |
| 3 | 워로드 | 3차기 `warcry` — 함성 광역+공버프 |
| 3 | 팔라딘 | 3차기 `sanctuary` — 성역 자힐 |
| 4 | 워브링어 | 4차기 `doomsday`, 궁극 `bloodrage` |
| 4 | 크루세이더 | 4차기 `judgment`, 궁극 `holynova` |

### 궁수 ranger
| 차수 | 직업 | 특징 |
|---|---|---|
| 1 | 궁수(궁도) | crit12/spd15 |
| 2 | 스나이퍼(매의 눈) | crit18/boss10 |
| 2 | 윈드러너(질풍) | spd10/cdMult 0.9/mob12 |
| 3 | 이글아이 | `trueshot` — 확정크리 저격 |
| 3 | 템페스트 | `tornado` — 회오리 다수 |
| 4 | 데드아이 | `arrowrain` / `godarrow` |
| 4 | 스카이로드 | `cyclone` / `skystorm` |

### 마법사 mage
| 차수 | 직업 | 특징 |
|---|---|---|
| 1 | 마법사(주술사) | atk30 최고, hp30 최저 |
| 2 | 아크메이지(대마법사) | skillMult 1.15 |
| 2 | 세이지(현자) | mp80/cdMult 0.85 |
| 3 | 스톰브링어 | `thunder` — 낙뢰 |
| 3 | 크로니클 | `timewarp` — 감속 필드 |
| 4 | 아크로드 | `chainlight` / `manaburst` |
| 4 | 이터널 | `gravity` / `eternalloop` |

### 도적 thief
| 차수 | 직업 | 특징 |
|---|---|---|
| 1 | 도적(그림자 검객) | crit16/spd20 |
| 2 | 어세신 | `shadowexec` — 점멸 참수 |
| 2 | 스와시버클러 | `flurrydance` — 5연타 |
| 3 | 나이트블레이드 | `shadowblad` — 회전 칼날 |
| 3 | 듀얼리스트 | `flurry` — 연격 흡혈 |
| 4 | 섀도우로드 | `shadowmine` / `shadowclon` |
| 4 | 블레이드마스터 | `swordaura` / `bladedance` |

### 해적 pirate (v1.1.9 신설)
| 차수 | 직업 | key | 특징 |
|---|---|---|---|
| 1 | 해적(항해자) | `pirate` | atk14/crit6/def4/hp90/spd8, cdMult 0.95 |
| 2 | 레이더(약탈자) | `raider` | atk20/mob16 — 화약 포격형 |
| 2 | 코세어(선상 검객) | `corsair` | crit14/spd14/cdMult 0.9 — 백병 연타형 |
| 3 | 스톰캡틴(폭풍의 선장) | `stormcaptain` | atk26/crit6/mob16 |
| 3 | 파우더마스터(화약 장인) | `powdermaster` | atk30/boss18 — 단일 화력 최상 |
| 4 | 씨킹(바다의 왕) | `seaking` | atk28/hp240/boss20/mob14 |
| 4 | 드레드노트(무쌍 포격) | `dreadnought` | atk34/crit14/boss26 |

해적 스킬 8종:

| 슬롯 | key | 이름 | 동작 |
|---|---|---|---|
| Z | `cannonblast` | 포격 | 전방 착탄, 착탄점 **원형** 판정(부채꼴 아님) |
| Z | `cutlassdance` | 커틀러스 난무 | 3연속(3차+) 광범위 베기, 막타 2배 |
| C | `smokestep` | 연막 측면 | 도약+착지 폭발, 2차+ 짧은 무적 |
| C | `grappleswing` | 갈고리 그네 | 원거리 도약, 3차+ 착지 가속 |
| V | `stormcall` | 뇌우 소환 | 낙뢰 3파 광역, 자신 신속 |
| V | `minefield` | 지뢰 부설 | 지뢰 4기 6초(`spawnField` 재사용) |
| V | `tidalwave` | 만조 | 5파 진행 판정, 강넉백 340 |
| V | `broadside` | 전탄 발사 | 부채꼴 3방향 폭격 |
| B | `maelstrom` | 침몰의 종 | 6단 흡입 후 대폭발 |
| B | `decksweep` | 무쌍 포격 | 8방향 동시 폭격 |

궁극기(Lv200):
- `SKILL5_INFO.pirate` — 「만조 — 대양 항로」(60초, MP100)
- `SKILL5B_INFO.pirate` — 「폭풍항로 — 침몰의 종」(120초, MP150)

## 직업을 추가할 때 손대야 하는 곳

`FamilyKey`/`ClassKey`가 유니온 타입이라 **TypeScript가 누락 지점을 전부 에러로 잡아준다**.
`npx tsc --noEmit`을 돌리면 아래가 순서대로 나온다.

1. `src/game/classes.ts`
   - `ClassKey` 유니온, `ClassDef` 상수, `CLASSES` 맵
   - `SKILL_ICONS`(없으면 lucide 폴백 — 기능 무영향)
   - `SKILL1_KIND`/`SKILL2_KIND`/`SKILL3_KIND`/`SKILL4_KIND`
   - `SKILL_LABELS`, `SKILL3_DESC`/`SKILL4_DESC`
   - 계열이면 `SKILL5_INFO`/`SKILL5B_INFO` + `CLASS_LIST`
2. `src/game/data.ts` — `FAMILY_ELEM`, `JOB_SPKR`, `nameOf`, `travelTone`, `titles`,
   `JOBSTORY`, `T1_LINES`/`T4_LINES`/`JS_LINES`, `AUTO_ALLOC`
3. `src/game/entities/Player.ts` — Z/C/V/B 각 `switch` 분기 + 사운드 테이블(`SND3`/`SND4`)
4. `src/game/scenes/WorldScene.ts` — 원격(멀티) 연출 분기, `famIdx`
5. `src/game/partyContent.ts` / `src/game/union.ts` — 계열 역산 정규식
   (두 파일에 **중복 구현**돼 있다. 하나만 고치면 파티/유니온에서 계열이 null이 된다)
6. `src/components/game/UnionPanel.tsx`(`FAM_LABEL`/`FAM_COLOR`/`FAM_HEX`),
   `Panels.tsx`(`GM_FAM_LABEL`)

## 주의

- `ElemKey`에 없는 원소를 쓰지 말 것. 원소 반응 9×9 테이블 전체에 영향이 간다.
  해적은 번개 모티프지만 `thunder`가 없어 `fire`로 매핑했다.
- 클래스 이름·스킬 이름은 **원작(메이플스토리)에서 가져오지 않는다.** 구조(계열→2차→3차→4차)는
  장르 관습이라 문제없지만, 고유 명칭·디자인은 저작권 대상이다. 해적 계열 명칭은
  북유럽 신화(퍼블릭 도메인)에서 따왔다.
