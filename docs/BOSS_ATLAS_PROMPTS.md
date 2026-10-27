# SERTZ 보스 스프라이트시트 제작 프롬프트 (GPT 이미지 생성용)

작성 기준: 실제 코드(`src/game/textures.ts` BOSS_ATLAS / BOSS_ATLAS_ROWS, `src/game/entities/Boss.ts` animFor)
이 문서의 규격을 **1픽셀이라도 어기면 코드에서 프레임이 잘리거나 빈 프레임이 나온다.**

---

## 0. 모든 보스에 공통으로 붙는 마스터 프롬프트

GPT에 보낼 때 **아래 [공통 규칙] + [해당 보스 블록]을 합쳐서** 한 번에 보낸다.

```
You are producing a 2D game sprite sheet (sprite atlas) for a top-down 2D MMORPG
called SERTZ, set in Norse mythology (Yggdrasil, nine realms).

=== OUTPUT FORMAT (STRICT) ===
- A single sprite sheet image, sprite-sheet layout, grid aligned, transparent
  background (PNG with alpha).
- Exactly 7 horizontal rows, exactly 6 columns. Do NOT add or remove rows/columns.
- Every cell is exactly 220 x 200 pixels. Total sheet size must be 1320 x 1400 px.
- Each frame must be fully contained inside its own cell. Nothing may cross a cell
  border. Keep at least 6px padding inside every cell so no part is clipped.
- Draw the character in a consistent 3/4 top-down view, facing RIGHT (the game
  flips the sprite for left movement).
- The character's feet/ground contact point must sit at the same position in
  every frame, so the animation does not jitter vertically.
- Same scale in all frames. Do not zoom in/out between frames.

=== ROW MEANING (this order is mandatory) ===
Row 1 (top):    IDLE      - breathing loop, 6 frames
Row 2:          WALK/RUN  - locomotion loop, 6 frames
Row 3:          ATTACK    - melee/basic attack, 6 frames (impact around frame 3-4)
Row 4:          SPECIAL 1 - heavy area skill, 6 frames (windup then release)
Row 5:          SPECIAL 2 - projectile volley / radial burst, 6 frames
Row 6:          SPECIAL 3 - ultimate beam or signature move, 6 frames
Row 7 (bottom): DEATH     - collapse and fade, 6 frames (last frame nearly gone)

=== ART DIRECTION ===
- Hand-painted / painterly 2D game art with readable silhouettes, NOT pixel art,
  NOT 3D render, NOT photorealistic.
- Consistent lighting: light from upper-left, rim light on the silhouette edges.
- Strong value contrast so the silhouette reads when the sprite is scaled to
  about 200px tall on screen.
- Leave room for game VFX drawn on top by the engine: do not bake huge screen-wide
  explosions into the sheet. Effects must stay near the body and inside the cell.
- Transparent margins only. No background scenery, no ground shadow plate that
  fills a cell, no text, no UI, no frame numbers, no watermark, no labels.

=== CONSISTENCY ===
- All 42 frames must show the SAME creature: same proportions, same colors,
  same horn/wing/armor count. Only pose changes.
- No frame may be empty. If a row would be empty, use a strong pose variant instead.
```

---

## 1. 심연의 수호자 (guardian) — 1장 스바르트알프헤임 입구

**코드 키**: `boss` · **현재 시트**: `atl_boss.webp` 1528×1022 (191×146, 8열×7행)

```
[SUBJECT]
"Abyssal Guardian" (심연의 수호자) - a massive armored sentinel born from the roots
of Yggdrasil. Colossal knight-like humanoid fused with dark violet crystal.
Heavy stone-and-crystal plate armor, cracked glowing purple core in the chest,
a single enormous rune-carved tower shield and a blunt crystal-headed mace.
Violet (#9d7aff) energy leaks from the seams of the armor.

[PERSONALITY / MOTION]
Slow, crushing, deliberate. Every movement carries weight - the ground answers.
Idle: shoulders rise and fall heavily, core pulses.
Walk: lumbering, shield forward, dust displaced.
Attack: overhead mace slam, whole body committed, then recover slowly.
Sp1: raises mace, violet shockwave ring erupts from the ground.
Sp2: slams shield, a fan of crystal shards fires forward.
Sp3: plants shield and unleashes a vertical violet beam of abyssal light.
Death: armor cracks, core light dies out, body collapses into rubble.

[PALETTE]
Deep violet, abyssal blue-black, ashen gray stone, cold white crystal highlights.

[NOTE]
This boss originally used an 8-column sheet. If your generator can only do 6
columns, produce 6 columns but tell me - I will re-slice.
```

---

## 2. 눈보라의 거수 (behemoth) — 2장 미드가르드 해적선

**코드 키**: `boss2` · **현재 시트**: `atl_boss2.webp` 3960×1484 (330×212, 12열×7행)

```
[SUBJECT]
"Blizzard Behemoth" (눈보라의 거수) - a frost giant of the frozen northern sea,
risen from a shipwreck. Titanic hunched humanoid draped in frozen seaweed and
shattered ship timber, ice fused into its shoulders like a glacier mantle,
one arm ending in a jagged ice anchor. Breath and aura are pale ice blue (#8ad4ff).

[PERSONALITY / MOTION]
Avalanche-slow but unstoppable. The storm is its weapon, not its fists.
Idle: breath fogs, ice crust creaks and sheds.
Walk: dragging gait, ice anchor scraping the deck.
Attack: two-handed downward smash that shatters the ground into ice spikes.
Sp1: inhales and exhales a spiraling blizzard vortex.
Sp2: hurls a spread of frozen shards from the anchor arm.
Sp3: rears back and calls a frost nova - radial white-blue detonation.
Death: body freezes over, then breaks apart into drifting ice chunks.

[PALETTE]
Pale ice blue, glacier white, dark frozen wood brown, deep sea teal shadows.

[NOTE]
This is the widest sheet in the game. Very high resolution required.
```

---

## 3. 심연의 군주 (abysslord) — 3장 스바르트알프헤임 심연

**코드 키**: `boss3` · **현재 시트**: `atl_boss3.webp` 1528×1022 (191×146, 8열×7행)

```
[SUBJECT]
"Abyssal Lord" (심연의 군주) - the crowned sovereign of the deep dark, a wraith-
king in tattered regal robes over a hollow armor shell. A floating jagged crown,
no visible face (only twin crimson lights inside the hood), long clawed hands,
a crescent-bladed scepter that bleeds green-black venom light (#ff5a7a accents).

[PERSONALITY / MOTION]
Regal, contemptuous, eerie. Moves like it is teleporting rather than walking.
Idle: robes drift as if underwater, crown slowly rotates.
Walk: glides forward, robe tails trailing.
Attack (GreenSlash): a wide diagonal venom-green crescent slash, robe flaring.
Sp1 (Vanish): dissolves into black mist and reforms a step away.
Sp2 (ShieldCast): raises a hexagonal ward of green runes that holds the pose.
Sp3: opens a portal behind itself and fires a magic burst through it.
Death: crown shatters, robe collapses inward, only a red ember remains.

[PALETTE]
Venom green, void black, royal purple, crimson eye-light.

[NOTE]
This boss originally used an 8-column sheet.
```

---

## 4. 탐식의 드래곤 니드호그 (nidhog) — 4장 알프헤임 수목

**코드 키**: `boss_nidhog` · **현재 시트**: `atl_boss_nidhog.webp` 1716×1134 (156×162, 11열×7행)

```
[SUBJECT]
"Nidhogg, Dragon of Devouring" (탐식의 드래곤 니드호그) - the corpse-eating serpent
dragon gnawing the roots of Yggdrasil. Gaunt, rib-showing draconic body, wings
that are more stretched membrane than feathers, a long neck of a scavenger,
decomposing bark and root fibers tangled in its scales, dripping corrosive green
ichor (#7dff9a). Multiple small eyes along the snout.

[PERSONALITY / MOTION]
Hungry, twitchy, reptilian. It bites more than it claws.
Idle: jaw working, tongue flicking, wings folding restlessly.
Walk: low, prowling, tail dragging through root matter.
Attack: lunging bite from the full length of the neck.
Sp1: vomits a spreading pool of toxic green acid.
Sp2: spits a spray of corrosive globs in an arc.
Sp3: a sustained green acid beam from the open maw.
Death: body deflates and dissolves into rot and green smoke.

[PALETTE]
Sickly acid green, rotting wood brown, black scale, bone white.

[NOTE]
11 columns x 7 rows. Frame width is narrow (156px) - the creature is tall
and vertically oriented.
```

---

## 5. 화염의 거인 수르트 (surt) — 5장 무스펠헤임

**코드 키**: `boss_surt` · **현재 시트**: `atl_boss_surt.webp` 1632×1302 (272×186, 6열×7행)

```
[SUBJECT]
"Surt, the Fire Giant" (화염의 거인 수르트) - ruler of Muspelheim, the fire giant
who ends the world at Ragnarok. Colossal humanoid of black basalt and molten
magma seams, a crown of living flame, a flaming sword of pure fire (Laevateinn)
that is nearly as tall as he is. Magma drips from his shoulders. Orange-gold
heat (#ffa05a) and ember particles around the body.

[PERSONALITY / MOTION]
Wrathful, world-ending, unbelievably heavy. He barely steps; he devastates.
Idle: magma breathes in the seams, flame crown flickers upward.
Walk: massive deliberate strides, fire trail behind the sword.
Attack: sweeping horizontal fire-sword slash that leaves a burning arc.
Sp1: plunges the sword down, pillars of fire erupt from the ground.
Sp2: slams the sword, a radial ring of fire expands.
Sp3: raises the sword and unleashes a colossal fire beam.
Death: magma seams go dark, body cracks and cools to black stone, then crumbles.

[PALETTE]
Molten orange, gold, charred basalt black, deep crimson heat shadow.

[NOTE]
Widest frames in the set (272x186). The sword must stay inside the cell.
```

---

## 6. 탐욕의 늑대 펜리르 (fenrir) — 6장 니플헤임 설원

**코드 키**: `boss_fenrir` · **현재 시트**: `atl_boss_fenrir.webp` 1320×1400 (220×200, 6열×7행) ← 표준 규격

```
[SUBJECT]
"Fenrir, Wolf of Greed" (탐욕의 늑대 펜리르) - the chained apocalyptic wolf of
Norse myth, grown monstrous. A white-silver winter wolf the size of a house,
shaggy frost-crusted fur, jaws that do not close properly, glowing pale violet
eyes (#c08aff), a broken Gleipnir chain with shattered links still dragging from
his forelegs. Breath comes out as freezing vapor with small ice crystals.

[PERSONALITY / MOTION]
Feral, ravenous, explosive when it commits. Constant low growl.
Idle: low head, chained paw shifting, frost breath.
Walk: prowling circle, chain links dragging and sparking on ice.
Attack: lunging charge - full-body horizontal leap with jaws open.
Sp1: bounds forward then shadow-dashes to the target's flank (blink-slam).
Sp2: rears back and howls, a radial shockwave of frost and shadow.
Sp3: opens jaws and fires a concentrated beam of winter moonlight.
Death: chain finally shatters, legs buckle, body sinks into the snow.

[PALETTE]
Frost white, silver gray, pale violet eye glow, deep blue shadow, broken steel.

[NOTE]
This is the REFERENCE STANDARD sheet - 220x200 per frame, 6 columns, 7 rows,
1320x1400 total. Use this as the template for all other bosses where possible.
```

---

## 7. 교만의 쌍랑 스콜 & 하티 (skoll) — 8장 니다벨리르

**코드 키**: `boss_skoll` · **현재 시트**: `atl_boss_skoll.webp` 1386×1400 (126×200, 11열×7행)

```
[SUBJECT]
"Skol and Hati, the Twin Wolves of Pride" (교만의 쌍랑 스콜 & 하티) - the two wolves
that chase the sun and the moon. IMPORTANT: they are TWO wolves, never a
two-headed wolf. However this sheet shows them as a fighting PAIR - for the
sprite sheet, draw BOTH wolves together in each frame:
  - Skol  = moon-chaser, silver-white with a pale blue glow, lean and fast
  - Hati  = sun-chaser, ash-black with a molten gold mane and embers, heavier
They circle each other, sometimes overlapping. Proud, synchronized, arrogant.

[PERSONALITY / MOTION]
Two bodies, one intent. They never attack alone - one sets up, the other strikes.
Idle: circling each other slowly, tails high, snapping at each other.
Walk: running side by side in a V formation.
Attack: alternating lunges - Skol first, Hati immediately after.
Sp1: both leap at once from opposite sides (crossing charge).
Sp2: both rear and howl together, a ring of light and shadow erupts.
Sp3: Skol fires a frost beam while Hati fires a flame beam - they merge.
Death: one falls, the other howls and lies down beside it, both fade.

[PALETTE]
Silver-white moon, ash-black, molten gold, pale blue, ember orange.

[NOTE]
Frames are narrow (126x200) because the composition is vertical/tall - two
wolves stacked in a dynamic pose. Keep both animals fully inside the cell.
```

---

## 8. 혈안의 문지기 가름 (gram) — 9장 헬

**코드 키**: `boss_gram` · **현재 시트**: `atl_boss_gram.webp` 1320×1400 (220×200, 6열×7행) ← 표준 규격

```
[SUBJECT]
"Garmr, the Blood-Eyed Gatekeeper" (혈안의 문지기 가름) - the hound guarding the
gate of Hel. NOT a normal wolf: a monstrous hellhound of bloated muscle and
stretched skin, four bloodshot eyes, a mane of broken iron spearheads and chain
fragments torn from the gate, exposed ribcage glowing with a pale green
deathlight (#8affc0), and blood-soaked jaws that never fully close.
Rides the boundary between life and death.

[PERSONALITY / MOTION]
A guard dog: patient, then violently territorial. It COUNTERS rather than initiates.
Idle: head low, chain mane rattling, eyes tracking.
Walk: heavy prowl, blood dripping from the jaws onto the ground.
Attack: short brutal counter-bite used the instant it is approached.
Sp1: plants front paws and lets out a green death-shockwave.
Sp2: blinks out and reappears behind the target (blink-slash with claws).
Sp3: throws its head back and vomits a torrent of green death-fire beam.
Death: glowing ribcage goes dark, chains fall, it collapses across the gate.

[PALETTE]
Fresh blood crimson, iron gray, sickly green deathlight, dark wet black fur.

[NOTE]
This is the sheet with the bug I just fixed - it needs `cols: 6`. If you
regenerate it, keep 6 columns x 220x200 x 7 rows = 1320x1400 exactly.
```

---

## 9. 종언의 마룡 아부디토스 (abudditos) — 10장 최종 보스

**코드 키**: `boss_abudditos` · **현재 시트**: `atl_boss_abudditos.webp` 1716×1134 (156×162, 11열×7행)

```
[SUBJECT]
"Abudditos, the Demon Dragon of the End" (종언의 마룡 아부디토스) - THE FINAL BOSS.
The primordial end-being from Atlantis, older than the nine realms, the thing
Yggdrasil's roots were grown to hold back. A dragon that is not fully organic:
obsidian-black hide shot through with cracking red-gold fractures of pure ending-light
(#ff3a6a), six narrow burning eyes, antlers of calcified world-tree root, wings
that are torn holes in reality rather than membranes, a long body that seems to
continue off-frame even when it does not. Wears tattered remains of an ancient
golden covenant-seal around its neck.

[PERSONALITY / MOTION]
Serene, inevitable, absolutely without mercy. It does not rage - it ENDS things.
Idle: hovering slightly, fractures pulsing like a slow heartbeat, no breath.
Walk: gliding, wings leaving afterimages of void.
Attack: one single contemptuous claw-sweep that carves the air.
Sp1: spreads wings, a radial field of ending-light expands outward.
Sp2: summons three void orbs that orbit and then fire outward.
Sp3: opens the maw and fires a sustained beam of raw termination, red-gold and black.
Death: fractures spread across the whole body, it shatters into black glass and
       golden dust that drifts upward - NOT a normal collapse.

[PALETTE]
Obsidian black, red-gold fracture light, ancient tarnished gold, void violet.

[NOTE]
Grandest silhouette in the game. 11 columns x 7 rows, 156x162 frames.
The six eyes and the antlers must read even at small scale.
```

---

## 10. (재림 전용) 재림의 파수꾼 베오르드 (vord)

**코드 키**: `boss_vord` · **현재 시트**: `atl_boss_vord.webp` 1716×1134 (156×162, 11열×7행)

```
[SUBJECT]
"Vord, the Warden of Rebirth" (재림의 파수꾼 베오르드) - a black dragon that guards
the cycle of return. Unlike Abudditos (who ends), Vord RESTORES - its fractures
glow warm amber (#ffb05a) instead of red, and it carries a ring of floating
stone tablets and root-runes orbiting its body. Armored plating like a
cathedral door, four legs, no front claws (it uses the runes to fight).

[PERSONALITY / MOTION]
Immovable, ceremonial, sorrowful. A jailer that pities its prisoners.
Idle: rune tablets orbit slowly, amber fractures pulse in sequence.
Walk: heavy quadrupedal advance, tablets trailing.
Attack: slams a foreleg and drives runes into the ground.
Sp1: raises up and calls down consecutive lightning strikes (earthquake).
Sp2: spreads the tablets into a defensive wall and counters.
Sp3: fires an amber beam of restoration-light that burns the living.
Death: tablets drop one by one, the amber light drains, it kneels and stills.

[PALETTE]
Warm amber, black iron scale, stone gray, worn gold rune light.
```

---

## 11. (재림 전용) 세계수를 먹는 뱀 요르문간드 (jorm)

**코드 키**: `boss_jorm` · **현재 시트**: `atl_boss_jorm.webp` 1632×1134 (272×162, 6열×7행)

```
[SUBJECT]
"Jormungandr, the World-Serpent" (세계수를 먹는 뱀 요르문간드) - the serpent that
coils around the world and eats the roots of Yggdrasil. In this design it has
grown bat-like wings and golden horns (a wyrm that has begun to become a dragon).
Long coiling green-black body, moss and root fibers growing on the scales,
pale mint venom glow (#9affd0) along its belly, a fanged head too large for its
neck.

[PERSONALITY / MOTION]
Endless, coiling, patient hunger. It moves in spirals.
Idle: body coils and uncoils slowly, tongue tasting the air.
Walk: serpentine slither, wings folded and dragging.
Attack: whips its full head forward in a long strike.
Sp1: opens a spiral barrage - rings of venom projectiles.
Sp2: takes off briefly and dive-charges twice in a row.
Sp3: fires a sustained venom beam from the maw.
Death: coils loosen, body goes limp in a spiral and dissolves into moss.

[PALETTE]
Deep moss green, black scale, gold horn, mint venom glow, root brown.
```

---

## 12. (재림 전용) 요툰헤임 얼음 골렘 나그르 (nagr)

**코드 키**: `boss_nagr` · **현재 시트**: `atl_boss_nagr.webp` 1716×1134 (156×162, 11열×7행)

```
[SUBJECT]
"Nagr, the Ice Colossus of Jotunheim" (요툰헤임 얼음 골렘) - a giant built of
stacked glacial blocks held together by ancient frost-runes, with a frozen
giant's skull as its head and blue corpse-light burning in the sockets.
Both arms end in hammer-like fists of clear blue ice. Snow and rime continuously
shed from it.

[PERSONALITY / MOTION]
Practically inanimate - it does not dodge, it does not flinch. A walking glacier.
Idle: rune light pulses, ice crust cracks and re-forms.
Walk: slow tectonic steps, each one shaking the ground.
Attack: both fists raised and smashed down together.
Sp1: stomps and drives a ring of ice spikes outward.
Sp2: fires a spear of ice from its chest (ranged).
Sp3: raises both arms and calls a blizzard beam of freezing wind.
Death: runes fail, blocks separate, the skull falls last and shatters.

[PALETTE]
Glacier blue, white rime, dark winter slate, pale cyan rune light.
```

---

## 13. (2장 보스 대체) 심연 유령선 (boss2)

이미 `atl_boss2.webp`로 대체되어 있으므로 위 2번(눈보라의 거수) 항목을 사용한다.

---

## 부록 A. 규격 요약표 (코드에 등록된 실제 값)

| 코드 키 | 프레임 | 열 | 행 | 시트 크기 | 행별 프레임 | 비고 |
|---|---|---|---|---|---|---|
| `boss` guardian | 191×146 | 8 | 7 | 1528×1022 | 8,8,8,8,8,8,8 | |
| `boss2` behemoth | 330×212 | 12 | 7 | 3960×1484 | 6,6,6,6,6,6,6 | 최대 해상도 |
| `boss3` abysslord | 191×146 | 8 | 7 | 1528×1022 | 8,8,8,8,8,8,8 | |
| `boss_nidhog` | 156×162 | 11 | 7 | 1716×1134 | 11,11,10,11,11,11,11 | 3행 10장 |
| `boss_surt` | 272×186 | 6 | 7 | 1632×1302 | 6,6,6,6,6,6,6 | |
| `boss_fenrir` | 220×200 | 6 | 7 | 1320×1400 | 6,6,6,6,6,6,6 | **표준** |
| `boss_skoll` | 126×200 | 11 | 7 | 1386×1400 | 11×7 | 쌍랑 |
| `boss_nagr` | 156×162 | 11 | 7 | 1716×1134 | 11,11,10,11,11,11,11 | |
| `boss_hati` | 191×146 | 8 | 7 | 1528×1022 | 8×7 | 쌍랑 개별 |
| `boss_jorm` | 272×162 | 6 | 7 | 1632×1134 | 6,6,5,6,6,6,6 | 3행 5장 |
| `boss_abudditos` | 156×162 | 11 | 7 | 1716×1134 | 11,11,10,11,11,11,11 | 최종 보스 |
| `boss_vord` | 156×162 | 11 | 7 | 1716×1134 | 11,11,10,11,11,11,11 | |
| `boss_gram` | 220×200 | 6 | 7 | 1320×1400 | 6,6,6,6,6,6,6 | **이번에 수정** |

## 부록 B. 행 순서 (게임 규약 — 절대 바꾸지 말 것)

```
행0 (맨 위)  IDLE      루프
행1          WALK/RUN  루프
행2          ATTACK    기본 공격, 1회
행3          SPECIAL 1 광역/장판기, 1회
행4          SPECIAL 2 탄막/원형 폭발, 1회
행5          SPECIAL 3 궁극기(빔 등), 1회
행6 (맨 아래) DEATH     사망, 1회
```

`src/game/textures.ts`의 `registerBossAnims()`가 이 순서를 **하드코딩**해서 읽는다.
`Boss.animFor()`도 이 키 이름(`-idle`, `-walk`, `-atk`, `-sp1`, `-sp2`, `-sp3`, `-die`)에 의존한다.

## 부록 C. 결과물을 받은 뒤 내가 하는 일

1. PNG를 `public/assets/atl_boss_<키>.webp`로 변환
2. `BOSS_ATLAS`의 `fw`/`fh`/`cols`를 새 시트에 맞춰 갱신
3. `BOSS_ATLAS_ROWS`의 행별 프레임 수를 실측값으로 갱신
4. 전수 검증 스크립트 실행 — `나머지(aw%fw, ah%fh) == 0` 이고 `cols == 실제열` 인지 확인

> 3번 검증에서 **`cols` 누락 시 기본값 12로 계산되어 프레임이 어긋나는 버그**가 이번에 발견됐다(`boss_gram`). 새 시트를 넣을 때 이 항목을 반드시 확인해야 한다.
