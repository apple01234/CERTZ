# 5차 궁극기 × VFX 에셋 매핑표 (v1.4.0 — Task 3-1, 유저 지시 #13)

> 원칙: 8직업 궁극기마다 서로 다른 연출·메커니즘. 동일 이펙트 재활용 0건.
> 구현 위치: `src/game/fx/StudioFX.ts` → `spawnUltFlourish()` · 호출: `Player.useSkill5()`

| 궁극기 (key5) | 직업 | 고유 메커니즘 (기존) | 신규 시그니처 에셋 (v1.4.0) |
|---|---|---|---|
| warbringer | 워브링어 | 참격 9연속 + 광역 출혈 + 대붕괴 종결일격 | `vfx_slash_m`(십자 참격) + `vfx_splat`(출혈 스플래시) + `vfx_slash`×3 궤도 |
| crusader | 크루세이더 | 빛기둥 9연타 + 성검 강림 + 완전 회복 | `vfx_flash`(성광) + `vfx_ring1`×3 삼중 링 |
| deadeye | 데드아이 | 유도 화살 32연발 + 저격선 | `vfx_crit`(저격 십자) + `vfx_arrowp`×5 화살 소용돌이 |
| skylord | 스카이로드 | 회오리 12기 + 폭풍의 눈 + 신속 | `vfx_cl1`(폭풍 구름) + `vfx_snow`×6 설풍 궤도 |
| arclord | 아크로드 | 마나 붕괴 대폭발 | `vfx_crystal`(크리스탈 파열) + `vfx_ring3`×3 마나 링 |
| eternal | 이터널 | 시간 정지 + 고리 연타 | `vfx_hex`(룬 육각형) + `vfx_twinkle`×4 시간 궤도 |
| shadowlord | 섀도우로드 | 그림자 군주 소환/분신 | `vfx_ist`(잔상) + `vfx_is2`×4 분신 궤도 |
| blademaster | 블레이드마스터 | 검무 9연격 | `vfx_slash_turn`(회전 검기) + `vfx_arc`×4 아크 궤도 |
| warrior/ranger/mage/rogue (계열 폴백) | 1~3차에서 해금 | 계열 공용 궁극 | `vfx_explosion` + `vfx_pt1`×4 궤도 |

4차 스킬은 기존부터 직업별 고유 메커니즘 보유 (돌진 폭발/빛기둥/유도화살/토네이도/마나붕괴/시간정지/분신/검무 — `Player.useSkill4` switch 참조) + GameStudio FX 마법진 합성.
