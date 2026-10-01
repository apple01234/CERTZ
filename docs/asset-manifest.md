# 에셋 매니페스트 요약 (v1.4.0 — Task 2-4/3-1 기준 문서)

> 전수 스캔 요약본. 전체 파일은 `public/assets/` 참조.

## 1. UI/재화 아이콘 (UI 스킨에 사용)
| 에셋 | 경로 | 용도 |
|---|---|---|
| 코인 | `assets/item_coin.webp` | 골드 칩 아이콘 (HUD 스탯창 — v1.0.20~) |
| 버프 아이콘 16종 | `assets/buff_*.webp` | HUD 버프 행 (스탯창 바로 아래 — v1.4.0 #15) |
| 스킬 아이콘 32종 | `assets/skillicon/*_s1..s4.webp` | 스킬바/설명 |
| 아이템 아이콘 90종+ | `assets/item_*.webp` / `i_*.webp` | 인벤/상점/보상 |
| 펫/치장 아이콘 | `assets/pet_*.webp` / `cos_*.webp` | 상점/수집 |

## 2. 이펙트 (VFX — 스킬/UI 연출)
| 팩 | 위치 | 수량 | 용도 |
|---|---|---|---|
| Drive VFX2 | `assets/vfx2/*.png` | 56 | 5차 궁극기 시그니처(1:1 매핑 — docs/skill-asset-mapping.md), 히트/마법진 |
| GameStudio FX | `assets/vf_*` | 20 | 궁극기 인트로/링/플레어/마법진 |
| Gameworks | `assets/gw_*` | 6 | 마법진/룬 (N차 강화) |
| Warped | `assets/vfx2_hit*` | 6 | 히트 플립북 풀 |

## 3. 맵/타일 (Cainos)
| 에셋 | 용도 |
|---|---|
| `map_ground.png` | 요새 유적 바닥 타일 crop (잔디/흙) |
| `map_props.png` | 난간/기둥 crop |
| `map_torch.png` (16px×64f) | 유적 횃불 애니 |
| `map_chest.png` (64px×7f) | 유적 상자 개봉 애니 |

## 4. 사운드
- SFX 48종 (`assets/audio/sfx/` — 원소 AOE/참격/크리)
- BGM 챕터별 플레이리스트 (`assets/audio/bgm/`)

## 5. UI-에셋 매핑 원칙 (지시 #11)
- 글자만 있는 UI 금지: 게임형 칩(`game-chip`)은 우드/골드 프레임 CSS 스킨 + 에셋 아이콘 조합
- HUD: 코인 에셋(골드), 버프 에셋 아이콘 16종, 루시드 아이콘은 보조
- 비밀수첩/랭킹/더보기 등 신규 버튼도 아이콘+게임형 칩 스킨 적용
- 상세 매핑: 이 문서 §1 표 + HUD.tsx 내 `v1.4.0` 주석
