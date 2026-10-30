# 궁극기 마무리 중복 분석 — 지시서 #10

> 유저 지적: *"궁극기가 뒤에 부분 바뀐게 다 똑같잖아 ㅅ1ㅂ 똑바로 안만듬???"*

생성: `tools/ult_dedup.py` — `src/game/entities/Player.ts` 의 `switch (key5)` 를
정적 파싱해 직업별 연출 호출 시퀀스를 뽑고, **마지막 3개 호출을 "마무리"로 정의**해
쌍별 완전 중복을 찾는다.

## 직업별 연출 호출 시퀀스

| 직업 | 호출 수 | 마무리 3개 |
|---|---|---|
| `archmage` | 8 | spawnBurstAt → sfxSkill → sfxCrit |
| `arclord` | 16 | sfxSkill → sfxSkill → sfxCrit |
| `assassin` | 3 | spawnSlash → spawnBurstAt → sfxSkill |
| `berserker` | 8 | spawnBurstAt → sfxSkill → sfxCrit |
| `blademaster` | 19 | sfxSkill → sfxSkill → sfxCrit |
| `chronicle` | 3 | spawnBurstAt → sfxSkill → sfxCrit |
| `corsair` | 6 | spawnShockwave → sfxSkill → sfxCrit |
| `crusader` | 14 | sfxCrit → spawnHealFx → spawnPickupText |
| `deadeye` | 5 | sfxSkill → spawnFlarePop → spawnFlarePop |
| `dreadnought` | 7 | sfxSkill → sfxSkill → sfxCrit |
| `duelist` | 3 | spawnSlash → sfxSkill → sfxCrit |
| `eagleeye` | 4 | spawnBurstAt → sfxSkill → sfxCrit |
| `eternal` | 14 | spawnRingPop → sfxSkill → sfxCrit |
| `guardian` | 5 | spawnPillar → spawnBurstAt → sfxCrit |
| `mage` | 10 | sfxSkill → sfxSkill → sfxCrit |
| `nightblade` | 3 | spawnSlash → spawnBurstAt → sfxSkill |
| `paladin` | 7 | spawnPickupText → spawnBurstAt → sfxSkill |
| `pirate` | 20 | sfxSkill → sfxSkill → sfxCrit |
| `powdermaster` | 7 | spawnPillar → sfxSkill → sfxCrit |
| `raider` | 3 | spawnBurstAt → spawnCrack → sfxSkill |
| `ranger` | 5 | spawnField → sfxSkill → sfxSkill |
| `sage` | 5 | sfxCrit → spawnPillar → sfxSkill |
| `seaking` | 4 | spawnBurstAt → sfxSkill → sfxCrit |
| `shadowlord` | 12 | sfxSkill → sfxSkill → sfxCrit |
| `skylord` | 9 | sfxCrit → spawnPillar → spawnPickupText |
| `sniper` | 2 | sfxSkill → spawnBurstAt |
| `stormbringer` | 8 | spawnBurstAt → sfxSkill → sfxCrit |
| `stormcaptain` | 4 | spawnShockwave → sfxSkill → sfxCrit |
| `swashbuckler` | 4 | spawnSpinSlash → sfxSkill → sfxCrit |
| `tempest` | 3 | spawnBurstAt → sfxSkill → sfxCrit |
| `warbringer` | 11 | spawnFlarePop → sfxSkill → sfxCrit |
| `warlord` | 7 | sfxCrit → spawnPillar → sfxCrit |
| `warrior` | 9 | spawnBurstAt → sfxSkill → sfxCrit |
| `windrunner` | 3 | spawnBurstAt → sfxSkill → sfxCrit |

## 마무리 완전 중복 쌍

**중복 53쌍**

| A | B | 공통 마무리 |
|---|---|---|
| `archmage` | `berserker` | spawnBurstAt → sfxSkill → sfxCrit |
| `archmage` | `chronicle` | spawnBurstAt → sfxSkill → sfxCrit |
| `archmage` | `eagleeye` | spawnBurstAt → sfxSkill → sfxCrit |
| `archmage` | `seaking` | spawnBurstAt → sfxSkill → sfxCrit |
| `archmage` | `stormbringer` | spawnBurstAt → sfxSkill → sfxCrit |
| `archmage` | `tempest` | spawnBurstAt → sfxSkill → sfxCrit |
| `archmage` | `warrior` | spawnBurstAt → sfxSkill → sfxCrit |
| `archmage` | `windrunner` | spawnBurstAt → sfxSkill → sfxCrit |
| `arclord` | `blademaster` | sfxSkill → sfxSkill → sfxCrit |
| `arclord` | `dreadnought` | sfxSkill → sfxSkill → sfxCrit |
| `arclord` | `mage` | sfxSkill → sfxSkill → sfxCrit |
| `arclord` | `pirate` | sfxSkill → sfxSkill → sfxCrit |
| `arclord` | `shadowlord` | sfxSkill → sfxSkill → sfxCrit |
| `assassin` | `nightblade` | spawnSlash → spawnBurstAt → sfxSkill |
| `berserker` | `chronicle` | spawnBurstAt → sfxSkill → sfxCrit |
| `berserker` | `eagleeye` | spawnBurstAt → sfxSkill → sfxCrit |
| `berserker` | `seaking` | spawnBurstAt → sfxSkill → sfxCrit |
| `berserker` | `stormbringer` | spawnBurstAt → sfxSkill → sfxCrit |
| `berserker` | `tempest` | spawnBurstAt → sfxSkill → sfxCrit |
| `berserker` | `warrior` | spawnBurstAt → sfxSkill → sfxCrit |
| `berserker` | `windrunner` | spawnBurstAt → sfxSkill → sfxCrit |
| `blademaster` | `dreadnought` | sfxSkill → sfxSkill → sfxCrit |
| `blademaster` | `mage` | sfxSkill → sfxSkill → sfxCrit |
| `blademaster` | `pirate` | sfxSkill → sfxSkill → sfxCrit |
| `blademaster` | `shadowlord` | sfxSkill → sfxSkill → sfxCrit |
| `chronicle` | `eagleeye` | spawnBurstAt → sfxSkill → sfxCrit |
| `chronicle` | `seaking` | spawnBurstAt → sfxSkill → sfxCrit |
| `chronicle` | `stormbringer` | spawnBurstAt → sfxSkill → sfxCrit |
| `chronicle` | `tempest` | spawnBurstAt → sfxSkill → sfxCrit |
| `chronicle` | `warrior` | spawnBurstAt → sfxSkill → sfxCrit |
| `chronicle` | `windrunner` | spawnBurstAt → sfxSkill → sfxCrit |
| `corsair` | `stormcaptain` | spawnShockwave → sfxSkill → sfxCrit |
| `dreadnought` | `mage` | sfxSkill → sfxSkill → sfxCrit |
| `dreadnought` | `pirate` | sfxSkill → sfxSkill → sfxCrit |
| `dreadnought` | `shadowlord` | sfxSkill → sfxSkill → sfxCrit |
| `eagleeye` | `seaking` | spawnBurstAt → sfxSkill → sfxCrit |
| `eagleeye` | `stormbringer` | spawnBurstAt → sfxSkill → sfxCrit |
| `eagleeye` | `tempest` | spawnBurstAt → sfxSkill → sfxCrit |
| `eagleeye` | `warrior` | spawnBurstAt → sfxSkill → sfxCrit |
| `eagleeye` | `windrunner` | spawnBurstAt → sfxSkill → sfxCrit |
| `mage` | `pirate` | sfxSkill → sfxSkill → sfxCrit |
| `mage` | `shadowlord` | sfxSkill → sfxSkill → sfxCrit |
| `pirate` | `shadowlord` | sfxSkill → sfxSkill → sfxCrit |
| `seaking` | `stormbringer` | spawnBurstAt → sfxSkill → sfxCrit |
| `seaking` | `tempest` | spawnBurstAt → sfxSkill → sfxCrit |
| `seaking` | `warrior` | spawnBurstAt → sfxSkill → sfxCrit |
| `seaking` | `windrunner` | spawnBurstAt → sfxSkill → sfxCrit |
| `stormbringer` | `tempest` | spawnBurstAt → sfxSkill → sfxCrit |
| `stormbringer` | `warrior` | spawnBurstAt → sfxSkill → sfxCrit |
| `stormbringer` | `windrunner` | spawnBurstAt → sfxSkill → sfxCrit |
| `tempest` | `warrior` | spawnBurstAt → sfxSkill → sfxCrit |
| `tempest` | `windrunner` | spawnBurstAt → sfxSkill → sfxCrit |
| `warrior` | `windrunner` | spawnBurstAt → sfxSkill → sfxCrit |

## 마지막 호출 1개 기준 겹침 (참고)

- `sfxCrit` ← `warbringer`, `arclord`, `eternal`, `shadowlord`, `blademaster`, `seaking`, `dreadnought`, `warrior`, `mage`, `pirate`, `berserker`, `guardian`, `warlord`, `windrunner`, `eagleeye`, `tempest`, `stormbringer`, `archmage`, `chronicle`, `swashbuckler`, `duelist`, `corsair`, `stormcaptain`, `powdermaster`
- `sfxSkill` ← `ranger`, `paladin`, `sage`, `assassin`, `nightblade`, `raider`
- `spawnPickupText` ← `crusader`, `skylord`

## 공통 인트로 (모든 직업 공유 — 마무리와 무관)

`spawnUltIntroSig` · `cine3d().play` · `spawnUltFlourish` · `playUltLayers` ·
`playUltCinematic` 은 직업 무관 공통 인트로/레이어다. 유저가 지적한
"뒷부분"은 **마무리**이므로 이 공통부는 유지한다.


## 수정 후 — 직업별 고유 마무리 (vc204)

`src/game/fx/ultFinale.ts` 의 `ULT_FINALE` 이 직업마다 **판정 형태**가 다른 마무리를 정의한다.
switch(본타) 뒤에서 `runUltFinale()` 가 한 번 호출된다.

| 직업 | 판정 형태 | 이펙트 | 셰이크 | 소리 | 마법진 |
|---|---|---|---|---|---|
| `warbringer` | cone | fx_flarebig + fx_impact | 220ms 0.026 | `bigsword` | — |
| `crusader` | cross | gvb_star4 + fx_glowyellow | 180ms 0.014 | `holy` | — |
| `warrior` | circle | fx_shockwave | 200ms 0.020 | `bigsword` | — |
| `berserker` | chain | fx_burst | 240ms 0.028 | `roar` | — |
| `guardian` | pillar | fx_aura | 140ms 0.010 | `holy` | — |
| `paladin` | ring | fx_glowyellow | 120ms 0.008 | `holy` | — |
| `deadeye` | line | fx_caustic + fx_electro | 150ms 0.012 | `arrowpierce` | — |
| `skylord` | cone | fx_electro + fx_glow | 160ms 0.014 | `wind` | — |
| `eagleeye` | line | fx_caustic | 140ms 0.011 | `arrowpierce` | — |
| `windrunner` | chain | fx_glow | 130ms 0.010 | `wind` | — |
| `tempest` | circle | fx_electro | 200ms 0.018 | `thunder` | — |
| `arclord` | circle | fx_glowblue + fx_lightning | 220ms 0.020 | `thunder` | O |
| `eternal` | cross | fx_glowblue + fx_flarew | 100ms 0.006 | `slowmo` | O |
| `mage` | circle | fx_lightning | 190ms 0.016 | `thunder` | O |
| `archmage` | pillar | fx_glowblue + fx_hex | 170ms 0.014 | `elemcast` | O |
| `chronicle` | ring | fx_glowblue | 90ms 0.005 | `slowmo` | O |
| `stormbringer` | chain | fx_lightning | 210ms 0.019 | `thunder` | O |
| `shadowlord` | chain | fx_purple + fx_noise | 130ms 0.011 | `dagger` | — |
| `blademaster` | line | fx_flarew + fx_impact | 180ms 0.015 | `slash` | — |
| `thief` | circle | fx_purple | 150ms 0.012 | `dagger` | — |
| `assassin` | line | fx_noise | 160ms 0.013 | `dagger` | — |
| `nightblade` | cone | fx_purple | 140ms 0.011 | `slash` | — |
| `duelist` | cross | fx_flarew | 150ms 0.012 | `slash` | — |
| `seaking` | cone | fx_flare + fx_smoke | 230ms 0.022 | `cannon` | — |
| `dreadnought` | chain | fx_flare + fx_impact | 260ms 0.030 | `cannon` | — |
| `pirate` | circle | fx_flare | 220ms 0.020 | `cannon` | — |
| `corsair` | cone | fx_flarebig | 200ms 0.018 | `cannon` | — |
| `stormcaptain` | line | fx_electro | 200ms 0.017 | `thunder` | — |
| `powdermaster` | chain | fx_burst | 240ms 0.026 | `cannon` | — |

**정의 29직업 · 마무리 조합 중복 0쌍** (형태·텍스처·셰이크·소리 조합 기준).

판정 형태 분포 — 원형 6 / 연쇄 6 / 부채꼴 5 / 직선 5 / 십자 3 / 기둥 2 / 링 2.
같은 계통에서도 형태가 갈린다 (예: 전사 = 부채꼴·십자·원형·연쇄·기둥·링).

### 공통 인트로는 유지

`spawnUltIntroSig` · `cine3d` · `spawnUltFlourish` · `playUltLayers` · `playUltCinematic` 은
직업 무관 공통 인트로/레이어다. 유저가 지적한 "뒷부분"은 **마무리**이므로 이 공통부는 건드리지 않았다.

### 성능

마무리는 쿨 60~120초에 1회 실행된다. 이미지 2~4장 + 기존 파티클 1회.
`lite`(fxLevel 0)에서는 셰이크 진폭 절반 + 마법진 회전 생략.
