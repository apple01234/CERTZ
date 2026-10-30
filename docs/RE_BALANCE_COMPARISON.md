# RE 실측 기반 밸런스 대조 — Holo Dungeon / GameMaker 3종

리버스 엔지니어링으로 추출한 실측치를 SERTZ 현재 값과 대조한 기록.
근거 데이터: `docs/RE_HOLO_MOVES.json`(Move 76개), `docs/RE_GAMEMAKER_MAPS.json`(맵 261개)

---

## 1. 맵 크기 — SERTZ가 3~7배 컸다

| 게임 | 맵 수 | 중앙 면적 | 최대 면적 |
|---|---|---|---|
| Vampire_NoSurvivors | 4 | 518,400 px² | 800,000 px² |
| SangTDB | 27 | 4,000,000 px² | 4,194,304 px² |
| flooded_burials | 230 | 314,360 px² | 1,559,040 px² |
| **전체 261개** | | **중앙 332,280 px²** | **p75 459,837 px²** |

**조정 전 SERTZ**: 챕터 1,425,000 ~ 3,240,000 px² → RE 중앙값의 **4.3~9.8배**, p75의 **3.1~7.0배**

### 왜 문제인가
- 카메라 컷씬이 맵 가장자리로 팬할 때 **맵 밖(검은 여백)이 노출**된다 (지시 #7)
- `cam.pan()` 은 `setBounds()` 를 무시하므로 맵이 클수록 밖으로 나갈 여지가 커진다
- 이동 거리가 길어 템포가 느려진다

### 조정 (vc206)
비율만 축소하고 **밀도(장식/몬스터/타일 수)는 보존** — 퀄리티 저하 없음.

| 스테이지 | 이전 | 이후 | 감소 |
|---|---|---|---|
| forest | 2400×1350 (3,240,000) | **1900×1070 (2,033,000)** | −37% |
| kingdom | 2200×1250 (2,750,000) | **1750×990 (1,732,500)** | −37% |
| alfheim | 1900×1080 (2,052,000) | **1500×860 (1,290,000)** | −37% |
| niflheim | 2100×1200 (2,520,000) | **1670×950 (1,586,500)** | −37% |
| cave | 2100×1200 | **1670×950** | −37% |
| nidavellir | 2100×1200 | **1670×950** | −37% |
| hel | 2100×1200 | **1670×950** | −37% |
| abyss | 1800×1050 (1,890,000) | **1430×830 (1,186,900)** | −37% |

결과: 1.19M ~ 2.03M px² → RE p75의 **2.6~4.4배** (장르 특성상 SERTZ가 더 큰 것은 유지)

---

## 2. 스킬 대상 구조 — SERTZ는 광역 90%, Holo는 단일 50%

### Holo Dungeon 실측 (스킬 66개)

| TargetType | 의미 | 개수 | 비율 |
|---|---|---|---|
| 0 | 단일 적 | **33** | **50%** |
| 1 | 다중 적 | 15 | 23% |
| 2 | 단일 아군 | 12 | 18% |
| 3 | 다중 아군 | 5 | 8% |
| 99 | 특수 | 1 | 2% |

- 타입: 물리(`P`) **46** / 특수(`S`) **30**
- 데미지 분포: 1–20 (18개) · 21–50 (24개) · 51–100 (11개) · 501–999 (2개) · 9999 (1개)
- 학습 레벨 0~10, 자원 비용(ScuffCost) 0~10

### SERTZ 실측

- `getAllTargetsIn()` 호출 **108회** 중 반경 300px 이상이 **97회 (90%)**
- `targetsAround()` 22회 추가
- 스테이지당 몬스터 평균 **4.4마리**

### 해석
Holo Dungeon은 **적 3~4마리 상대 턴제**라 단일 대상 스킬이 절반을 차지한다.
SERTZ는 실시간 액션 + 몬스터 4.4마리 밀집이라 광역이 합리적이다.

**따라서 스킬 구조 자체는 바꾸지 않는다.** 다만 아래 두 가지를 참고한다:

1. **단일 대상 고배율 스킬의 가치** — Holo의 `Humu Humu`(9999 dmg, cost 6)처럼
   단일 대상에 몰아넣는 고배율기는 SERTZ에 `snipe`(저격) 계열로 이미 존재.
   광역 90% 환경에서 단일 고배율의 상대 가치가 낮으므로 **보스전 전용 배율 상향** 여지.
2. **자원 비용 대비 데미지 효율** — Holo 상위: `Humu Humu` 1666.5 / `GrOUNd Pound` 333.0 /
   `Luminance` 199.8. SERTZ는 MP 고정비라 효율 개념이 없어 직접 비교 불가.

---

## 3. 반영하지 않은 것 (근거 부족)

| 항목 | 이유 |
|---|---|
| 스킬 데미지 절대값 이식 | 두 게임의 스탯 스케일이 다름 (Holo 최대 HP 대비 SERTZ ATK 체계) |
| TargetType 분포 변경 | 장르(턴제 vs 실시간 액션)와 몬스터 밀도가 달라 직접 이식 부적절 |
| 자원 비용 체계 도입 | SERTZ는 MP 단일 자원 — 새 자원 추가는 범위 밖 |

---

## 4. 추출 방법 (재현용)

### GameMaker `data.win`

```
청크   : 'FORM'+total(8B) 뒤 [name 4][size 4][data size] 반복
STRG   : [count u32][ptr u32 × count][문자열 블록]
         ptr = 절대 파일 오프셋, 그 지점에 [len u32][bytes]
ROOM   : [count u32][roomPtr u32 × count]   ← roomPtr 은 절대 오프셋
         room: [nameRef][captionRef][width][height]
         nameRef 는 문자열 **끝**을 가리킴 → 앞쪽 [len][ascii] 역산으로 복원
```

### Unity 2019.4 (typetree stripped)

```
UnityPy read_typetree() 는 m_GameObject/m_Enabled/m_Script/m_Name 만 반환한다.
→ 디컴파일 소스의 필드 선언 순서로 raw 바이트를 직접 파싱해야 한다.

MonoBehaviour 헤더 (28B):
  +0  m_GameObject.fileID(u32)  +4  pathID(i64)
  +12 m_Enabled(u8) + align4
  +16 m_Script.fileID(u32)      +20 pathID(i64)
  +28 m_Name (aligned string)

Move 레코드:
  m_Name → MoveName → Description
  → Type(u16) → **[align4]** → TargetType/Damage/LearnLv/ScuffCost(i32×4) → isItem(u8)

  ⚠ char(u16) 뒤 align4 를 빠뜨리면 수치가 65536배로 튄다 (실제로 겪음)
```

Move MonoScript pathID = **1271** (`globalgamemanagers.assets`).
이 pathID 를 m_Script 로 참조하는 MonoBehaviour 가 실제 Move 오브젝트다 (76개).
