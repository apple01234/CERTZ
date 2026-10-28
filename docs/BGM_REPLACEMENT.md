# BGM 교체 계획 (실측 기반)

사용자 지시: "BPM이 엄청 빠르고 보스전 음악 같은 것들이 화이트 노이즈가 많이 들린다.
그런 곡들이랑 화이트 노이즈가 많은 AI 노래들은 고급 에셋 BGM으로 바꿔."

## 측정 방법
`tools/analyze_bgm.py` — ffmpeg 22.05kHz 디코드 후
- **BPM**: 온셋 엔벨로프 자기상관
- **flatness**: 스펙트럼 평탄도(기하/산술 평균비). 1.0=백색잡음, 음악은 보통 0.05~0.35
- **hi6k**: 6kHz 이상 대역 에너지 비율(치찰음·히스)
- **clip/silence**: 클리핑·무음 비율

## 현재 게임 BGM 상태 (51곡)

교체 대상 **13곡**:

| 파일 | BPM | flatness | 사유 |
|---|---|---|---|
| bgm_abyss_2 | 178 | 0.423 | 고BPM + 노이즈 |
| bgm_abyss_boss | 178 | 0.348 | 고BPM + 노이즈 |
| bgm_muspelheim_boss | 178 | 0.368 | 고BPM + 노이즈 |
| bgm_cave_water | 172 | 0.309 | 고BPM |
| bgm_niflheim_boss | 120 | **0.463** | 화이트노이즈 최악 |
| bgm_alfheim_boss | 99 | 0.437 | 노이즈 |
| bgm_forest_1 | 96 | 0.402 | 노이즈 |
| bgm_forest_boss | 140 | 0.395 | 노이즈 |
| bgm_muspelheim_1 | 108 | 0.419 | 노이즈 |
| bgm_nidavellir_boss | 129 | 0.352 | 노이즈 |
| bgm_nidavellir_3 | 132 | 0.363 | 노이즈 |
| bgm_muspelheim_3 | 92 | 0.344 | 노이즈 |
| bgm_hel_2 | 162 | 0.067 | 고BPM |

**보스 9곡 중 6곡이 노이즈 과다.** 사용자 지적과 정확히 일치.

## 배급 BGM (Fantasy Adventure Pack / Sound / Songs) — 11곡

전부 `- Loop.wav` 사용(게임 루프 재생).

| 곡 | BPM | flatness | hi6k | 용도 |
|---|---|---|---|---|
| Boss Theme 1 | 92 | 0.210 | 0.045 | 보스전 메인 |
| Boss Theme 2 | 152 | 0.260 | 0.064 | 보스전 격전 |
| Scene Theme 1 | 92 | **0.089** | 0.018 | 평화 구역 |
| Scene Theme 2 | 140 | 0.111 | 0.023 | 일반 사냥 |
| Scene Theme 3 | 157 | 0.138 | 0.030 | 긴장 구역 |
| Scene Theme 4 | 120 | 0.115 | 0.023 | 중간 |
| Scene Theme 5 | 148 | 0.239 | 0.084 | 강한 구역 |
| Scene Theme 6 | 99 | 0.112 | 0.022 | 차분 |
| Story Theme (Extended) | 99 | 0.124 | 0.028 | 스토리 |
| Story Theme (Trailer) | 122 | 0.137 | 0.030 | 컷신 |
| Title Screen Theme | 103 | 0.095 | 0.021 | 타이틀 |

**품질 비교**: 현재 보스 최악 0.463 → FAP 보스 최대 0.260. **약 44% 개선**.

## 교체 매핑

원칙: 장르 톤을 유지한다. 밝은 왕국은 Scene 1/4/6, 위험한 곳은 Scene 3/5,
보스는 Boss 1/2. 여러 챕터가 같은 원본을 쓰더라도 톤이 맞으면 허용하되,
**같은 챕터 안의 1/2/3 스테이지는 서로 다른 곡**을 쓴다.

| 기존 | 새 곡 | 근거 |
|---|---|---|
| bgm_abyss_2 | Scene Theme 5 | 심연=긴장+강함 |
| bgm_abyss_boss | Boss Theme 2 | 격전 |
| bgm_muspelheim_boss | Boss Theme 2 | 격전 |
| bgm_cave_water | Scene Theme 6 | 동굴 물가=차분 |
| bgm_niflheim_boss | Boss Theme 1 | 최악 노이즈 교체 |
| bgm_alfheim_boss | Boss Theme 1 | 노이즈 교체 |
| bgm_forest_1 | Scene Theme 2 | 숲 사냥 |
| bgm_forest_boss | Boss Theme 1 | 노이즈 교체 |
| bgm_muspelheim_1 | Scene Theme 3 | 화염=긴장 |
| bgm_nidavellir_boss | Boss Theme 1 | 노이즈 교체 |
| bgm_nidavellir_3 | Scene Theme 5 | 대장간=강함 |
| bgm_muspelheim_3 | Scene Theme 5 | 화염 |
| bgm_hel_2 | Scene Theme 3 | 고BPM 완화 |

## 검증 기준
1. 교체 후 전체 BGM flatness **0.32 미만**
2. BPM **170 미만**
3. tsc 0
4. 실제 인게임 재생 확인(Phaser 로드 에러 0)
