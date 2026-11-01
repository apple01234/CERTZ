# vc226 — 남은 에셋 3곳 실측 조사

`docs/VC224_ASSET_SURVEY.md` 에서 "조사하지 않았다"고 남긴 영역.
**결론: 게임에 바로 쓸 수 있는 것은 거의 없다.** 이유를 측정값으로 남긴다.

---

## 1. `assets_in/sonniss` — 897MB — **부적합**

| 항목 | 값 |
|---|---|
| 전체 크기 | 897MB |
| **오디오 파일 수** | **46개** (WAV 46 / xlsx 1 / txt 1 / pdf 1) |
| 게임이 이미 쓰는 오디오 | **401개** (mp3/ogg) |

**897MB에 오디오가 46개뿐인 이유**: 파일 하나가 거대하다.

| 팩 | 크기 | 성격 |
|---|---|---|
| The Noisery - City Rain | **254M** | 도시 빗소리 앰비언스 |
| The Noisery - Transit Tunes (German Train) | **234M** | 기차 내부 소리 |
| Victor Ermakov - Industrial Ambiences | 93M | 조선소/공장 환경음 |
| TheWorkRoom - South African Walla | 75M | 군중 웅성거림 |
| TheWorkRoom - Wire Cars | 48M | 장난감 자동차 |
| TheWorkRoom - Flip Flops | 41M | 슬리퍼 발소리 |

이건 **GDC 게임 오디오 번들의 환경음/필드레코딩 라이브러리**다. BGM·스킬 효과음이 아니다.
게임은 이미 BGM 401개를 갖고 있고, 필요한 것은 짧은 SFX인데 여기 있는 건
수 분짜리 루프 원음이다.

**판정**: 쓰려면 앰비언스 레이어(마을 빗소리 등)로만 가능하고, 그건 별도 사운드 설계 결정이다.
지금 게임에 넣을 이유가 없다. **미사용 유지.**

---

## 2. `assets_in/uni` — 445MB — **일부만 유효**

| 팩 | 크기 | PNG | shader | 판정 |
|---|---|---|---|---|
| **HeroEditor4D** | 116M | **2,765** | 2 | **최대 자산** — 캐릭터 파츠 |
| Classic_RPG_GUI | 131M | 173 | 0 | **UI 후보** |
| Hovl Studio | 72M | 40 | 0 | VFX 프리렌더 (일부 사용 중) |
| UNI VFX | 44M | 28 | 1 | VFX 프리렌더 (일부 사용 중) |
| JMO Assets | 41M | 160 | 1 | 판타지 이펙트 |
| Toon Shaders Pro | 26M | 9 | **9** | **Unity 전용 — 쓸 수 없음** |
| GameVFX Buff Collection | 12M | 39 | 2 | VFX |
| Watercolor | 5.7M | 16 | 2 | 셰이더 |

### HeroEditor4D (2,765 PNG) — 구조

```
Common/Icons/BodyParts/Beard/Basic/Type1.png …
FantasyHeroes/
FantasyGoblins/
```

**수염·머리·의상 등 파츠를 레이어 합성해 캐릭터를 만드는 에디터용 라이브러리**다.
`Common/Icons/` 아래는 **아이콘**이라 게임 캐릭터로 직접 못 쓴다.
`FantasyHeroes`/`FantasyGoblins` 쪽 PNG 는 3D 모델 텍스처 또는 파츠 아틀라스다.

**판정**: 아이콘 2,765개는 **이미지 조합으로 캐릭터를 만드는 용도**라
현재 파이프라인(아틀라스 애니메이션)과 맞지 않는다. 캐릭터 커스터마이징을
레이어 합성으로 재설계할 때나 쓴다. **즉시 사용 불가.**

### Toon Shaders Pro (shader 9) — **쓸 수 없음**

`.shader` / `.shadergraph` 는 **Unity ShaderLab / Shader Graph** 형식이고,
이 프로젝트는 Phaser(WebGL)다. GLSL 로 포팅해야 하는데 파일마다 다시 쓰는 수준이다.
게다가 이 게임은 이미 `ToonFX.ts`(카메라 필터)와 `DissolveFX`/`DangerFX`(GLSL)를 갖고 있다.
**번역 비용 대비 이득 없음.**

### Classic_RPG_GUI (173 PNG)

판타지 RPG 창/버튼/프레임 세트. 현재 UI 는 **React 컴포넌트**(`src/components/game/`)로
DOM 오버레이다. 이 PNG 를 쓰면 React UI 를 이미지로 교체해야 해서 접근성·반응형·다국어가
전부 깨진다. `web-game-foundations` 규칙 5(UI는 DOM 오버레이)에도 어긋난다.
**미사용 유지.**

---

## 3. `_assets_in/x1` — 1.7GB — **부적합**

| 팩 | 크기 | PNG |
|---|---|---|
| **PuzzleLevelMapPack** | **1.7G** | 769 |
| Content | 49M | 57 |
| Prefabs | 4.2M | 0 |
| 2DGamekit | 3.5K | 0 |

### PuzzleLevelMapPack

```
1_ForestLevelMapMaker  523M
3_AquaMap              509M
2_CandyLevelMapMaker   396M
4_CityScapesMap        198M
0_Common                34M
```

**퍼즐 게임(매치3/캐주얼)용 레벨 맵 메이커**다. 스프라이트가 아니라
`MapMaker` 프리팹·레벨 데이터가 대부분을 차지한다. 이 게임(2D 액션 MORPG)과 장르가 다르다.

`0_Common/Sprites/Lobby/` 의 `CandyIcon.png` `AquaIcon.png` 같은 **캐주얼 퍼즐 로비 아이콘**이라
SERTZ 판타지 톤과 맞지 않는다.

**판정**: 쓸 것이 없다.

---

## 종합

| 영역 | 크기 | 쓸 수 있는 것 | 즉시 사용 |
|---|---|---|---|
| sonniss | 897M | 환경음 46개 (앰비언스 한정) | **아니오** |
| uni / Toon Shaders | 26M | — (Unity 전용) | **아니오** |
| uni / Classic_RPG_GUI | 131M | UI PNG 173 | **아니오** (React UI 와 충돌) |
| uni / HeroEditor4D | 116M | 파츠 2,765 | **아니오** (합성 방식 상이) |
| uni / VFX 5종 | 174M | 프리렌더 시트 | **부분** (이미 19개 사용 중) |
| x1 / PuzzleLevelMapPack | 1.7G | — (퍼즐 장르) | **아니오** |
| x1 / Content·Prefabs | 53M | — (Unity 전용) | **아니오** |

**11.2GB 중 게임에 쓸 수 있는 새 자산은 사실상 없다.**
이미 뽑아 쓴 것(VFX 프리렌더 19개, `_assets_in/x2`의 FA 팩·Warrior 세트)이 실질 전부였다.

## 왜 이렇게 되나

에셋 폴더는 **용량이 아니라 적합성**으로 봐야 한다. 큰 폴더 3곳이 모두 안 맞은 이유:

1. **장르 불일치** — 퍼즐 맵 메이커, 캐주얼 로비 아이콘
2. **엔진 불일치** — Unity `.shader`/`.prefab`/`.anim` (이미 `.anim`만 FA/Warrior에서 뽑아 씀)
3. **용도 불일치** — 캐릭터 합성 파츠(레이어), 필드레코딩 앰비언스(수 분 루프)

**남은 11GB 를 굳이 파고들 이유가 없다.** 정말 필요한 것이 생기면
(예: 캐릭터 커스터마이징 재설계, 마을 앰비언스 레이어) 그때 해당 폴더만 보면 된다.
