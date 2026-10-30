# SERTZ 직업 계통표 (지시서 #4)

> 생성: `tools/gen_class_lineage.py` — `src/game/classes.ts` 에서 직접 추출.
> 근거: 유저 지시 *"같은 텍스트 색깔의 직업은 같은 직업이야 (전직 차수가 올라가는 거뿐임)"*.
> 따라서 35개 직업은 독립 직업이 아니라 **전직 계통(lineage)** 이다.

## 계통 목록

| 계통 | 1차 | 2차 | 3차 | 4차 | 색 |
|---|---|---|---|---|---|
| **마법사** | 마법사 | 아크메이지 | 스톰브링어 | 아크로드 | `#a5b9ff` |
| **해적** | 해적 | 레이더 | 파우더마스터 | 드레드노트 | `#ffd76a` |
| **궁수** | 궁수 | 스나이퍼 | 이글아이 | 데드아이 | `#7dffa8` |
| **도적** | 도적 | 어세신 | 나이트블레이드 | 섀도우로드 | `#e8c0ff` |
| **전사** | 전사 | 버서커 | 워로드 | 워브링어 | `#ff9a8a` |

## 전체 직업 상세

| key | 이름 | 차수 | 부모 | 색 | hex | 자식 |
|---|---|---|---|---|---|---|
| `mage` | 마법사 | 1 | — | `#a5b9ff` | `0xa5b9ff` | archmage, sage |
| `pirate` | 해적 | 1 | — | `#ffd76a` | `0xffd76a` | corsair, raider |
| `ranger` | 궁수 | 1 | — | `#7dffa8` | `0x7dffa8` | sniper, windrunner |
| `thief` | 도적 | 1 | — | `#e8c0ff` | `0xe8c0ff` | assassin, swashbuckler |
| `warrior` | 전사 | 1 | — | `#ff9a8a` | `0xff9a8a` | berserker, guardian |
| `archmage` | 아크메이지 | 2 | `mage` | `#8fa6ff` | `0x8fa6ff` | stormbringer |
| `assassin` | 어세신 | 2 | `thief` | `#d89aff` | `0xd89aff` | nightblade |
| `berserker` | 버서커 | 2 | `warrior` | `#ff7a5c` | `0xff7a5c` | warlord |
| `corsair` | 코세어 | 2 | `pirate` | `#ffdf8a` | `0xffdf8a` | — |
| `guardian` | 가디언 | 2 | `warrior` | `#ffb08a` | `0xffb08a` | paladin |
| `raider` | 레이더 | 2 | `pirate` | `#ffb347` | `0xffb347` | powdermaster, stormcaptain |
| `sage` | 세이지 | 2 | `mage` | `#c3cfff` | `0xc3cfff` | chronicle |
| `sniper` | 스나이퍼 | 2 | `ranger` | `#5cff8f` | `0x5cff8f` | eagleeye |
| `swashbuckler` | 스와시버클러 | 2 | `thief` | `#f0c8ff` | `0xf0c8ff` | duelist |
| `windrunner` | 윈드러너 | 2 | `ranger` | `#9dffc4` | `0x9dffc4` | tempest |
| `chronicle` | 크로니컬 | 3 | `sage` | `#e2e8ff` | `0xe2e8ff` | eternal |
| `duelist` | 듀얼리스트 | 3 | `swashbuckler` | `#ffd8ff` | `0xffd8ff` | blademaster |
| `eagleeye` | 이글아이 | 3 | `sniper` | `#3cff7a` | `0x3cff7a` | deadeye |
| `nightblade` | 나이트블레이드 | 3 | `assassin` | `#c08aff` | `0xc08aff` | shadowlord |
| `paladin` | 팔라딘 | 3 | `guardian` | `#ffd29a` | `0xffd29a` | crusader |
| `powdermaster` | 파우더마스터 | 3 | `raider` | `#ff9a5c` | `0xff9a5c` | dreadnought |
| `stormbringer` | 스톰브링어 | 3 | `archmage` | `#6f8cff` | `0x6f8cff` | arclord |
| `stormcaptain` | 스톰캡틴 | 3 | `raider` | `#ffd88a` | `0xffd88a` | seaking |
| `tempest` | 템페스트 | 3 | `windrunner` | `#b9ffe0` | `0xb9ffe0` | skylord |
| `warlord` | 워로드 | 3 | `berserker` | `#ff5c3c` | `0xff5c3c` | warbringer |
| `arclord` | 아크로드 | 4 | `stormbringer` | `#5c7cff` | `0x5c7cff` | — |
| `blademaster` | 블레이드마스터 | 4 | `duelist` | `#ffaaff` | `0xffaaff` | — |
| `crusader` | 크루세이더 | 4 | `paladin` | `#ffe29a` | `0xffe29a` | — |
| `deadeye` | 데드아이 | 4 | `eagleeye` | `#1cff5c` | `0x1cff5c` | — |
| `dreadnought` | 드레드노트 | 4 | `powdermaster` | `#ff6a3d` | `0xff6a3d` | — |
| `eternal` | 이터널 | 4 | `chronicle` | `#d8deff` | `0xd8deff` | — |
| `seaking` | 씨킹 | 4 | `stormcaptain` | `#fff0b8` | `0xfff0b8` | — |
| `shadowlord` | 섀도우로드 | 4 | `nightblade` | `#a86aff` | `0xa86aff` | — |
| `skylord` | 스카이로드 | 4 | `tempest` | `#ccffe8` | `0xccffe8` | — |
| `warbringer` | 워브링어 | 4 | `warlord` | `#ff3c1c` | `0xff3c1c` | — |

## 검증 — 부모·자식 색 계열 일치

부모와 자식의 색이 같은 계통이면 색상 거리가 가까워야 한다. HSL 색상환 거리(0~180) 기준 40도 이내면 같은 계열로 본다.

| 자식 | 부모 | 거리(도) | 판정 |
|---|---|---|---|
| `berserker` | `warrior` | 3 | OK |
| `guardian` | `warrior` | 11 | OK |
| `sniper` | `ranger` | 1 | OK |
| `windrunner` | `ranger` | 4 | OK |
| `archmage` | `mage` | 1 | OK |
| `sage` | `mage` | 1 | OK |
| `raider` | `pirate` | 9 | OK |
| `corsair` | `pirate` | 0 | OK |
| `warlord` | `berserker` | 1 | OK |
| `paladin` | `guardian` | 14 | OK |
| `eagleeye` | `sniper` | 0 | OK |
| `tempest` | `windrunner` | 10 | OK |
| `stormbringer` | `archmage` | 0 | OK |
| `chronicle` | `sage` | 0 | OK |
| `assassin` | `thief` | 1 | OK |
| `swashbuckler` | `thief` | 6 | OK |
| `nightblade` | `assassin` | 9 | OK |
| `duelist` | `swashbuckler` | 16 | OK |
| `stormcaptain` | `raider` | 5 | OK |
| `powdermaster` | `raider` | 12 | OK |
| `warbringer` | `warlord` | 1 | OK |
| `crusader` | `paladin` | 10 | OK |
| `deadeye` | `eagleeye` | 2 | OK |
| `skylord` | `tempest` | 0 | OK |
| `arclord` | `stormbringer` | 0 | OK |
| `eternal` | `chronicle` | 3 | OK |
| `shadowlord` | `nightblade` | 3 | OK |
| `blademaster` | `duelist` | 0 | OK |
| `seaking` | `stormcaptain` | 7 | OK |
| `dreadnought` | `powdermaster` | 9 | OK |

**불일치 0건** — 부모 관계는 맞지만 색이 계열에서 벗어난 경우. 색을 부모 계열로 맞추거나, 부모 관계를 재검토해야 한다(미확정).

## 차수 분포

- 1차: 5개
- 2차: 10개
- 3차: 10개
- 4차: 10개
