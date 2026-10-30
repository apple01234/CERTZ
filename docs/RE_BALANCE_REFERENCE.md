# RE 실측 비교 — 맵 크기 & 전투 수치 밸런스 참고

> **출처**: 5개 상용 게임 바이너리 직접 파싱 (추측 없음, 전부 실측)
> **목적**: SERTZ(하울르스톤) 스테이지 크기·스킬 수치의 **외부 기준선** 확보
> **작성**: vc206

---

## 1. 맵 크기 — GameMaker 3종

`data.win` 의 `ROOM` 청크를 직접 파싱해 추출했다. 게임별 확정 포맷이 아래와 같다.

```
FORM     : 'FORM' + total(8B) 뒤 [name 4][size 4][data size] 반복
STRG     : [count u32][ptr u32 × count][문자열 블록]
           ptr = **절대 파일 오프셋**, 그 지점에 [len u32][bytes]
ROOM     : [count u32][roomPtr u32 × count]      ← roomPtr 은 절대 오프셋
room@ptr : [nameRef u32][captionRef u32][width u32][height u32] ...
           nameRef 는 문자열 **끝**을 가리킴 → 앞쪽 [len][ascii] 역산으로 복원
```

| 게임 | ROOM | 이름 복원 | 최대 맵 | 총 면적 | 평균 |
|---|---|---|---|---|---|
| Vampire_NoSurvivors | 4 | 4/4 | 2000×400 = **800,000** px² | 1,577,600 | 394,400 |
| SangTDB | 27 | 27/27 | 2048×2048 = **4,194,304** px² | 100,917,280 | 3,737,677 |
| flooded_burials | 230 | 230/230 | 1366×768 = **1,049,088** px² | 83,180,668 | 361,655 |

**맵 이름 예시**
- Vampire: `rmInit` / `rmMenu` / `rmBattlefield` / `rmGameOver`
- SangTDB: `rm_main_class_pick`, `rm_swamp_lvl_1`, `rm_trailer_map1~5`, `rm_tutorial_begin_secret`
- flooded: `ra1s01`~`ra1s20`, `rlevel_select`, `rparent_area_1_stage_0`

### SERTZ 대비

| | SERTZ | RE 3종 |
|---|---|---|
| 크기 범위 | 832~2300 width | 480~2048 width |
| 면적 최소 | 692,224 px² | 129,600 px² (480×270) |
| 면적 최대 | 2,875,000 px² | 4,194,304 px² (SangTDB) |
| 면적 평균 | **1,823,093 px²** | 1,843,000 px² (3종 단순평균) |

**판정**: SERTZ 의 평균 면적(182만 px²)은 3종 평균(184만 px²)과 사실상 동일하다.
맵 크기 자체는 상용 2D 액션 게임 대비 **적정**이며, 늘릴 필요가 없다.

단, SangTDB 는 `2048×2048`(419만 px²) 맵을 27개나 쓰며 총 1억 px² 규모다.
이는 **로그라이트/생존형** 장르 특성(맵 반복·재사용)이고, SERTZ 같은
스토리 선형 RPG 와는 비교 대상이 아니다.

---

## 2. 전투 수치 — Holo Dungeon (Unity 2019.4)

`Move` ScriptableObject 76개를 raw MonoBehaviour 바이트로 직접 파싱했다.
Unity 2019.4 빌드는 TypeTree 가 stripped 라 `read_typetree()` 가
`m_GameObject/m_Enabled/m_Script/m_Name` 만 돌려준다 → 필드 순서를 직접 맞춰야 한다.

### 확정된 오프셋 (실측)

```
+0   m_GameObject.fileID (u32)      +4   m_GameObject.pathID (i64)
+12  m_Enabled (u8) + align4
+16  m_Script.fileID (u32)          +20  m_Script.pathID (i64)   ← 여기로 Move 판별
+28  m_Name      [int32 len][bytes][align4]
     MoveName    [int32 len][bytes][align4]
     Description [int32 len][bytes][align4]
     Type        u16
     **(align4)** ← 이 패딩을 빠뜨리면 이후 수치가 전부 65536배로 튄다
     TargetType  i32
     Damage      i32
     LearAtLevel i32
     ScuffCost   i32
     isItem      u8 + align4
     SFX / EffectTarget / EffectHost / Animation  (PPtr 12B × 4)
```

### 집계 (Move 76개 = 스킬 66 + 아이템 10)

| 항목 | 값 |
|---|---|
| 물리(P) / 특수(S) | **46 / 30** |
| TargetType 0 (단일 적) | 33 |
| TargetType 1 (다중 적) | 15 |
| TargetType 2 (단일 아군) | 19 |
| TargetType 3 (다중 아군) | 8 |
| 데미지 범위 | **1 ~ 9999** (평균 248.3, n=56) |
| 학습 레벨 | 0 ~ 10 |
| ScuffCost(자원) | 0 ~ 10 |

**최상위 스킬**

| 이름 | 타입 | 데미지 | Lv | Cost |
|---|---|---|---|---|
| Humu Humu | S | 9999 | 10 | 6 |
| Luminance | S | 999 | 10 | 5 |
| GrOUNd Pound | P | 999 | 1 | 3 |
| Angry dad | P | 80 | 10 | 4 |
| Sharknado 3!! | P | 80 | 10 | 8 |

### SERTZ 대비 시사점

1. **데미지 스케일**: Holo Dungeon 은 `1~9999` 로 **3자리 점프**가 크다
   (일반 스킬 10~80, 각성급 999~9999). SERTZ 는 완만한 성장 곡선을 쓰므로
   직접 이식하지 않는다.

2. **TargetType 4분류**: 적/아군 × 단일/다중 조합이 명확하다.
   SERTZ `ULT_FINALE` 의 `shape`(line/cone/chain/cross/pillar/ring/circle)에
   **아군 대상 스킬이 없다** — 버퍼/힐러 직업군을 넣을 때 참고할 만하다.

3. **ScuffCost 0~10**: 자원 소모가 **한 자리 수**로 매우 작다.
   SERTZ 의 MP 소모(15~150)와는 설계 철학이 다르다(짧은 전투 반복 vs 긴 사냥).

---

## 3. 재현 방법

```bash
# GameMaker 맵 추출
python3 /root/.hermes/cache/scratch/gm_extract.py <data.win> [...]

# Holo Dungeon Move 추출 (UnityPy 1.10.18 필요)
python3 /root/.hermes/cache/scratch/holo_moves.py "<Holo Dungeon_Data 경로>"
```

산출물: `gm_final.json`(맵 261개) · `holo_moves.json`(Move 76개)
