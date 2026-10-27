# SERTZ 보스 스프라이트시트 제작 프롬프트 v2 (GPT 이미지 생성용)

> **v2 변경점** — v1은 보스당 180~250단어로 "분위기 설명"에 그쳤다. v2는
> **42프레임(7행×6열)을 한 프레임씩 지시**하고, 셀 내 피벗·점유율·재질·금지사항을
> 수치로 못박는다. 이미지 생성 모델은 "화려하게 그려줘"를 해석하지 못하므로
> **무엇이 셀 어디에 얼마나 크게 있는지**를 좌표 감각으로 적어야 프레임이 안 깨진다.

근거 코드
- `src/game/textures.ts` → `BOSS_ATLAS`(fw/fh/cols), `BOSS_ATLAS_ROWS`(행별 유효 프레임), `registerBossAnims()`(행→애니 매핑 하드코딩)
- `src/game/entities/Boss.ts` → `animFor()`(mode→애니 키), `setBossAnim()`(미보유 시 idle 폴백)
- `src/game/stages.ts` → `BOSS_DEFS`(보스별 patterns/sig/orbTint)

---

# PART 0 — 마스터 스펙 (모든 보스 공통, 프롬프트 맨 앞에 그대로 붙인다)

```
=====================================================================
TASK
=====================================================================
Produce ONE sprite sheet image for a 2D top-down action MMORPG.
This is a production game asset, not concept art. It will be sliced by code
into 42 individual frames. If the grid is off by even a few pixels, the asset
is unusable and must be regenerated.

=====================================================================
CANVAS & GRID — NON-NEGOTIABLE
=====================================================================
- Single image, PNG, transparent background (real alpha, not white fill).
- Grid: exactly 6 columns x exactly 7 rows = 42 cells.
- Each cell: exactly 220 px wide x 200 px tall.
- Total image size: exactly 1320 px wide x 1400 px tall.
- Every cell must contain exactly one pose. No pose may span two cells.
- No gutters, no borders, no grid lines, no separators may be DRAWN in the
  image. The grid exists only as a slicing grid — do not paint lines on it.
- Keep all artwork inside a 208 x 188 px safe box centered in each 220 x 200
  cell. That leaves a 6 px dead margin on every side. The engine draws attack
  VFX on top and needs that margin to avoid clipping.

=====================================================================
PIVOT & GROUND LOCK — the #1 cause of rejected sheets
=====================================================================
- Define ONE ground-contact point (the feet / lowest body mass / hover base).
- That point must sit at the SAME pixel position in ALL 42 cells:
  horizontally centered (x = 110 of the cell), and vertically at
  y = 188 of the cell (18 px above the cell bottom edge).
- Consequence: the creature must NOT bob up and down between frames except
  for intentional breathing amplitude of max 3 px.
- The character must NOT shift left/right between frames of the same row.
- Do NOT rescale between frames. Frame 1 and Frame 6 of a row are the same size.

=====================================================================
FACING & CAMERA
=====================================================================
- View: 3/4 top-down (about 55~65 degrees from horizontal), the camera the
  player sees the world from.
- Facing: RIGHT in every frame. The engine mirrors the sprite horizontally for
  left movement — so never draw a left-facing variant.
- Never draw the back of the creature. It is always readable from this angle.
- Slight perspective foreshortening is fine; hard orthographic side-view is not.

=====================================================================
LIGHTING (must be identical across all 42 frames)
=====================================================================
- Key light: upper-left, about 45 degrees elevation, warm-neutral.
- Rim light: thin bright edge on the upper-right silhouette contour. This is
  what separates the creature from dark game backgrounds.
- Ambient occlusion: dark contact shadow directly under the body only — a soft
  ellipse not wider than the body itself. Never a full-cell shadow plate.
- Do NOT repaint the light direction between rows. A different light angle per
  row makes the sheet flicker when animations blend.

=====================================================================
ROW MEANING & FRAME COUNT (engine-hardcoded, do not reorder)
=====================================================================
Row 1 (top):    IDLE      6 frames    loop
Row 2:          WALK      6 frames    loop
Row 3:          ATTACK    6 frames    one-shot, impact on frames 4~5
Row 4:          SPECIAL 1 6 frames    one-shot, wide/ground area skill
Row 5:          SPECIAL 2 6 frames    one-shot, projectile volley
Row 6:          SPECIAL 3 6 frames    one-shot, ultimate / beam
Row 7 (bottom): DEATH     6 frames    one-shot, ends near-invisible

=====================================================================
ANIMATION PRINCIPLES PER ROW (apply to every boss)
=====================================================================
IDLE  — 6 frames of breathing. Frame1 and Frame6 must be visually identical
        so the loop does not pop. Suggested rhythm: 1 neutral / 2 rise 1px /
        3 rise 3px + peak / 4 hold peak / 5 settle / 6 neutral.
WALK  — 6 frames of a readable locomotion cycle. Frame1 = contact, Frame2 =
        down, Frame3 = passing, Frame4 = up, Frame5 = contact (opposite),
        Frame6 = return toward Frame1. Displacement may be up to 8 px within
        the cell but the ground point stays locked.
ATTACK— 6 frames: 1 anticipation start / 2 deep windup / 3 peak windup (the
        "tell") / 4 strike begins to travel / 5 IMPACT + max extension /
        6 recovery toward neutral. The impact pose must be the widest, most
        extended silhouette of the whole row.
SPEC1 — 6 frames: 1 gather energy at the body / 2 charge builds, body lowers /
        3 charge peaks, ground reaction begins / 4 release / 5 effect at max
        radius / 6 settle. Effect must stay NEAR THE BODY, inside the safe box.
SPEC2 — 6 frames: 1 aim / 2 draw back or open maw / 3 full charge / 4 launch /
        5 follow-through / 6 return. Projectiles may exit the cell edge but the
        body must stay in the safe box.
SPEC3 — 6 frames: 1 rise / 2 full extension (tallest silhouette of the sheet)/
        3 power culminates, brightest frame / 4 beam or burst emitted /
        5 sustained / 6 power fades. This row should be the visual climax.
DEATH — 6 frames: 1 stagger + recoil / 2 knees or body drop / 3 collapse
        begins / 4 on the ground / 5 final spasm, glow dying / 6 nearly
        dissolved (about 15% opacity remains). Do not make frame 6 fully empty —
        the engine still draws it for a beat.

=====================================================================
ART STYLE
=====================================================================
- Hand-painted 2D game art, painterly rendering, crisp readable silhouette.
- NOT pixel art. NOT voxel. NOT 3D render with visible polygonal facets.
- NOT photorealistic. NOT anime cel-shaded with thick black outlines.
- Think: modern 2D action RPG boss art — soft internal gradients, hard
  silhouette edges, controlled detail density.
- Detail budget: the sprite is displayed about 200 px tall. Any detail smaller
  than roughly 4 px in the sheet will be invisible in game — do not spend
  render effort there. Spend it on silhouette, silhouette-breaking shapes
  (horns, wings, weapon, tail), and value contrast.

=====================================================================
CONSISTENCY RULES
=====================================================================
- All 42 frames depict the SAME individual creature. Same number of horns,
  same number of eyes, same wing shape, same weapon, same armor plates,
  same scars. Count them once and keep the count.
- Clothing/armor damage state must not change across rows.
- Color values must not shift between rows. Use the specified palette exactly.
- No frame may be blank, faded to nothing, or a duplicate of a neighbouring
  frame in a different row.

=====================================================================
NEGATIVE LIST — any of these fails the asset
=====================================================================
- no background scenery, environment, floor texture, or horizon
- no full-cell drop shadow, glow plate, or vignette
- no text, letters, numbers, frame counters, watermarks, signatures, or logos
- no UI, health bars, frames, borders, or panel lines
- no motion-blur smears that cross cell boundaries
- no character drawn at a different scale in different rows
- no creature facing left
- no duplicated row content, no empty cells
- no cropped/clipped limbs at cell edges
- no multiple characters in one cell (exception: the twin-wolf boss, which is
  explicitly two wolves as ONE entity)

=====================================================================
DELIVERY
=====================================================================
Deliver a single 1320 x 1400 px PNG with alpha.
If your generator cannot produce the exact pixel size, produce the closest
6:7-ish grid at high resolution (each cell at least 220x200) and state the
actual cell size — do not silently change the column count.
```

---

# PART 1 — 보스 1: 심연의 수호자 (guardian)

**코드**: `boss` · `atl_boss.webp` · **191×146 · 8열×7행 = 1528×1022** · 챕터1 스바르트알프헤임 입구
**전투 성향**: `sig:"slam"`, aggr 1.05, p1 slam/charge/volley → p3 quake+crystalburst. **느리고 묵직, 지면을 지배**

```
=====================================================================
SUBJECT: "ABYSSAL GUARDIAN" (심연의 수호자)
=====================================================================
A colossal armored sentinel grown out of the roots of Yggdrasil. Not a man in
armor — a suit of armor that has become a creature. Roughly 3.2x as tall as it
is wide. Underneath the plate there is nothing human; violet light and root
fibers are visible through the seams.

ANATOMY, EXACTLY:
- 1 helm, faceless, a vertical slit visor leaking violet light (the only "eye")
- 2 shoulder pauldrons, each carved with one large rune, asymmetrical — the
  RIGHT pauldron is noticeably larger and cracked
- 1 chest plate with a fist-sized glowing violet core set in the center; the
  core has 4 visible cracks radiating from it
- 2 arms. RIGHT arm holds a blunt crystal-headed mace (head is a cluster of
  3 violet crystals). LEFT arm bears a tower shield with one rune on its face
- 2 legs, heavy sabatons, no visible feet articulation
- Roots of dark wood grow out of the shoulders and lower back like a cloak

MATERIALS: matte blackened steel, ashen gray stone plates, raw violet crystal
(semi-translucent, internal glow), dry dark root wood.

SILHOUETTE PRIORITY: the tower shield on the left and the mace on the right
form the widest read. Keep the shield face turned toward the camera at all
times so the rune reads. Keep the mace head outside the shoulder line so it is
never hidden behind the body.

SCALE IN CELL: fills about 78% of cell height. The mace may extend to the right
cell edge but not past the 6 px safe margin.

=====================================================================
PALETTE (use these values)
=====================================================================
Armor shadow      #14101f
Armor mid         #2a2340
Armor highlight   #4a4270
Stone plate       #6b6478
Crystal core      #9d7aff   (emissive, brightest point of the sprite)
Crystal edge      #d9c8ff
Root wood         #3b2f24
Rune glow         #b79bff   (thin, 1-2 px only)

=====================================================================
FRAME-BY-FRAME (42)
=====================================================================
ROW 1 — IDLE (slow, heavy breathing; core pulses)
F1  Neutral stance. Shield low-forward, mace resting head-down on the ground.
    Core at base brightness.
F2  Chest rises 2 px. Core brightens one step.
F3  Chest at peak, shoulders lift 3 px, head tilts down 2 degrees.
    Core at peak — brightest idle frame.
F4  Hold peak. Mace head scrapes 1 px along the ground.
F5  Settle downward, shoulders drop, head levels.
F6  Identical to F1 (loop close). Core back to base.

ROW 2 — WALK (lumbering; the ground answers)
F1  Contact. Right sabaton planted forward, shield leading, body leans 4 deg.
F2  Down. Weight transfers, body at lowest point of the cycle.
F3  Passing. Left leg swings through, shield still forward, mace trailing.
F4  Up. Body at highest point, torso rotated 6 deg toward the camera.
F5  Contact (opposite). Left sabaton planted, mace swings forward, shield wide.
F6  Return toward F1. Body rotated back, dust settles around the feet.

ROW 3 — ATTACK (overhead mace slam — the signature "slam")
F1  Anticipation. Mace begins to lift, shield tucks in to the chest.
F2  Deep windup. Mace raised high above and slightly behind the helm.
    Body leans back 8 deg. Core dims (energy going into the arm).
F3  PEAK WINDUP — the tell. Mace fully vertical behind the head, both arms up,
    chest fully opened, back arched, core at minimum. Hold this read clearly:
    the player must recognize this pose as "get out of the way".
F4  Strike travelling. Mace has swung past the helm, motion arc visible as a
    taut violet crescent BEHIND the mace head (not a smear across the cell).
F5  IMPACT + max extension. Mace head at the ground, body fully committed
    forward, front knee bent, shield thrown out to the left for balance.
    Violet shockwave emerges from the impact point — a half-ring hugging the
    ground, max 40 px radius, contained inside the safe box.
F6  Recovery. Body rising back up, mace dragging, core flaring back to life.

ROW 4 — SPECIAL 1 (ground zones / quake — the earth answers)
F1  Gather. Shield planted flat on the ground, mace held vertically beside it,
    head bowed. Core dim.
F2  Charge builds. Runes on the shield and both pauldrons ignite one by one.
    Body compresses downward 4 px.
F3  Peak charge. The four runes at max brightness, violet light pooling on the
    ground around the shield in a small ring.
F4  Release. Mace driven point-first into the ground, both arms straight down.
F5  Effect at max radius. A flat violet shockwave ring around the feet, its
    outer edge at about 88 px radius from the ground point, still soft-edged.
    The body is fully upright again, arms wide.
F6  Settle. Ring dissipating into rising violet motes, shield lifted back up.

ROW 5 — SPECIAL 2 (crystal volley)
F1  Aim. Torso rotated to face the camera-right, mace drawn back to the hip.
F2  Draw. The three crystals on the mace head detach slightly, glowing,
    forming a small triangular cluster in front of the chest.
F3  Full charge. Five crystal shards now orbit the mace head in a tight arc,
    the chest core is at maximum brightness feeding them.
F4  Launch. Shards fire toward the right in a narrow fan. The mace head is
    thrust forward, arm fully extended.
F5  Follow-through. Arm swings past the line, torso rotated further right,
    shards already off-frame to the right.
F6  Return. Arm drawing back to guard, shield rising to cover the chest.

ROW 6 — SPECIAL 3 (vertical abyssal beam — ultimate)
F1  Rise. Mace lifted to shoulder height, shield lowered, head tilting up.
F2  Full extension — TALLEST silhouette of the sheet. Both arms raised, mace
    held aloft with the crystal head pointing at the sky, body stretched,
    helm thrown back. Shield hangs at the left hip.
F3  Culmination, brightest frame. A column of violet light condenses around the
    raised mace head, pouring DOWN into it from above. Core blown out white.
    Rune light on the armor at maximum.
F4  Emission. The mace is thrust forward and a thick violet beam fires to the
    right, roughly at chest height, about 22 px thick at the muzzle.
F5  Sustained. Body braced, one leg back, beam still thick, the helm visor
    now also emitting light.
F6  Fade. Beam thins and breaks into vertical shards, arms lowering, core
    returning to normal.

ROW 7 — DEATH (armor fails, core dies)
F1  Stagger. Mace dropped from the hand, body recoiling backward, helm snapped
    to the side. Core flickering.
F2  Knees drop. One sabaton gives out, body drops 20 px, shield falling away.
F3  Collapse begins. Torso pitching forward, both arms limp and swinging,
    the chest core now visibly cracked across.
F4  On the ground. Body flat, face down, root cloak splayed out around it.
    Core light reduced to a small ember.
F5  Final spasm. The ember pulses once, the helm tilts, plates begin separating.
F6  Dissolved. Mostly gone — only the shield outline, the mace head, and a few
    drifting violet crystal fragments remain at about 15% opacity.

=====================================================================
AVOID
=====================================================================
- Do not make it fast, spiky, or ninja-like. Every pose must read as HEAVY.
- Do not draw a human face or human skin anywhere.
- Do not let the mace and shield cross the body silhouette into a muddy mass;
  they must break the outline on opposite sides.
- Do not add fire. This boss is violet abyss, not flame.
```

---

# PART 2 — 보스 2: 눈보라의 거수 (behemoth)

**코드**: `boss2` · `atl_boss2.webp` · **330×212 · 12열×7행 = 3960×1484** · 챕터2 미드가르드 해적선
**전투 성향**: `sig:"spiral"`, aggr 0.95, p3 spiral+quake+frostnova. **폭풍이 무기, 주먹이 아님**

```
=====================================================================
SUBJECT: "BLIZZARD BEHEMOTH" (눈보라의 거수)
=====================================================================
A frost giant that rose out of a frozen shipwreck in the northern sea. It is
not clean ice — it is a corpse-giant wearing the wreck: frozen planks, tarred
rope, a ship's figurehead fused into one shoulder, and a glacier mantle that
has grown over its back like a second body. It drags a ship's anchor as a
weapon, held by a chain frozen solid.

ANATOMY, EXACTLY:
- 1 head, low-set and hunched, jaw hanging open, icicles hanging from the jaw
- 2 shoulders, hugely asymmetric — the LEFT shoulder carries a carved wooden
  ship figurehead (a snarling sea-serpent head) frozen in place
- 1 back mantle: a lumpy shelf of clear blue glacier ice, 4 visible facets
- 2 arms. RIGHT arm ends in a hand; LEFT arm is fused to the anchor chain
- 1 anchor: a jagged two-fluke ship anchor, carried low, chain links visible
- 2 legs, thick and short relative to the torso, feet half-frozen into blocks
- Frozen seaweed and shredded sailcloth hang from the waist like a skirt

MATERIALS: translucent blue glacier ice, dark frozen tarred wood, pitted gray
dead flesh, iron anchor, white rime crust on every upward-facing surface.

SILHOUETTE PRIORITY: the figurehead on the left shoulder and the anchor on the
right. The glacier mantle should break the back contour into hard facets so it
reads differently from a gorilla.

SCALE IN CELL: fills about 82% of cell height. This is the widest sheet in the
game (330x212 per cell); use the extra width for the anchor swing arc.
IMPORTANT: this boss is declared as 12 columns in code but only 6 frames are
used per row. Draw 6 poses in the first 6 columns of each row and leave the
remaining 6 columns of each row EMPTY (fully transparent). Do not stretch the
6 poses across 12 columns.

=====================================================================
PALETTE
=====================================================================
Ice deep          #2f5f7a
Ice mid           #6ea8c4
Ice highlight     #d7f0ff
Frozen wood       #2a2018
Ship paint (faded)#5c4a3a
Dead flesh        #7d8a8f
Rime white        #f2fbff
Frost aura        #8ad4ff  (emissive breath / rune)
Iron anchor       #4a4a52

=====================================================================
FRAME-BY-FRAME (42)
=====================================================================
ROW 1 — IDLE (breath fogs; ice sheds)
F1  Hunched neutral. Anchor head resting on the ground in front. Jaw closed.
F2  Breath begins — a small pale-blue vapor puff at the jaw.
F3  Deep inhale, chest expands 4 px, mantle ice cracks and sheds two shards.
F4  Hold. Vapor puff drifts to the right and dissolves.
F5  Exhale, shoulders drop, head dips 3 degrees.
F6  Identical to F1.

ROW 2 — WALK (dragging gait)
F1  Contact. Right foot planted, anchor dragging behind on the ground.
F2  Down. Full weight, mantle ice compresses, chain links go taut.
F3  Passing. Left leg swinging, body rolls 5 deg toward the camera.
F4  Up. Highest point, the anchor lifts off the ground 3 px and swings forward.
F5  Contact (opposite). Left foot planted, anchor now ahead of the body.
F6  Return toward F1, anchor scraping back, a frozen furrow behind it.

ROW 3 — ATTACK (two-handed downward smash → ice spikes)
F1  Anticipation. Anchor lifted off the ground with both hands, body straightens.
F2  Windup. Anchor raised to shoulder height, elbows out, head pulled back.
F3  PEAK WINDUP — the tell. Anchor fully overhead, body arched back 10 deg,
    mouth wide open in a silent bellow, mantle ice flaring bright.
F4  Strike travelling. Anchor swinging down through the front arc, chain taut.
F5  IMPACT + max extension. Anchor head smashed into the ground directly in
    front, body folded forward, both knees bent, mouth still open. Four ice
    spikes burst from the impact line, max 40 px tall, inside the safe box.
F6  Recovery. Rising heavily, anchor stuck for one beat then pulled free.

ROW 4 — SPECIAL 1 (spiraling blizzard vortex)
F1  Gather. Both arms drawn in to the chest, anchor held horizontally across
    the body, head down.
F2  Charge builds. Pale-blue vapor spirals inward toward the chest from both
    sides, mantle ice beginning to glow along its facet edges.
F3  Peak charge. A compressed ball of white-blue wind at the chest, body
    coiled, everything leaning forward.
F4  Release. Arms thrown wide, anchor flung out to the right, the vortex
    detaching from the chest.
F5  Effect at max. A visible spiral of snow and wind around the body, outer
    edge about 85 px radius, curling counter-clockwise, soft-edged, contained.
F6  Settle. Spiral thinning to drifting snow, arms coming down, ice re-frosting.

ROW 5 — SPECIAL 2 (frozen shard spread)
F1  Aim. Anchor brought up like a rifle across the chest, body squared.
F2  Draw. Ice crystallizes along the anchor's shaft in a row of small shards.
F3  Full charge. Nine shards floating in a tight line above the anchor shaft,
    all glowing pale blue.
F4  Launch. Shards fire right in a wide flat fan, anchor thrust forward.
F5  Follow-through. Body rotated right, anchor pulled back, a frost ring
    lingering at the muzzle.
F6  Return. Anchor lowered to guard, frost particles falling.

ROW 6 — SPECIAL 3 (frost nova — ultimate)
F1  Rise. Anchor dropped, both fists raised, head thrown back.
F2  Full extension — TALLEST. Both arms straight up, chest fully open, the
    glacier mantle standing up like a crown of ice spikes.
F3  Culmination, brightest frame. Every upward ice surface turns white-blue
    and emits; a ring of light gathers at the feet.
F4  Emission. Radial white-blue nova detonating outward from the body, the
    front edge at about 92 px radius but still soft (do not hard-clip).
F5  Sustained. Body braced wide, arms still up, nova ring expanding and
    thinning, breath blowing out as a long vapor plume.
F6  Fade. Arms lowering, nova reduced to a low frost ring at the feet.

ROW 7 — DEATH (freezes then shatters)
F1  Stagger. Anchor slips from the hands, body knocked back, rime bursting
    off the chest.
F2  Knees buckle. Body drops 22 px, the figurehead shoulder snapping loose.
F3  Collapse. Torso pitching forward, ice facets cracking with visible splits.
F4  Ground. Body down, the glacier mantle shattered into separate blocks.
F5  Freeze-over. A thin blue-white layer spreads across the whole body,
    the eyes going dark.
F6  Nearly gone. Only a scatter of ice blocks and the anchor remain — about
    15% opacity, no longer readable as a body.

=====================================================================
AVOID
=====================================================================
- Do not draw a clean white "ice golem" — this thing is a wreck and a corpse.
- Do not put a sail on it as clothing; the sail is a torn skirt only.
- Do not fill columns 7 through 12. They must be transparent.
- Do not draw fire, embers, or warm orange anywhere. This is the cold boss.
```

---

# PART 3 — 보스 3: 심연의 군주 (abysslord)

**코드**: `boss3` · `atl_boss3.webp` · **191×146 · 8열×7행 = 1528×1022** · 챕터3 스바르트알프헤임 심연
**전투 성향**: `sig:"greenslash"`, aggr 1.05, p3 magicburst/portalteleport. **걸어다니지 않고 미끄러지듯, 위엄과 경멸**

```
=====================================================================
SUBJECT: "ABYSSAL LORD" (심연의 군주)
=====================================================================
The crowned sovereign of the deep dark. A wraith-king: an empty suit of ornate
armor worn over nothing, draped in regal robes that move like they are
underwater. No face — where the head should be, there is a hollow hood with two
crimson points of light. A jagged iron crown floats just above the hood,
disconnected from it.

ANATOMY, EXACTLY:
- 1 floating crown, 5 asymmetric spikes, tarnished black iron with green patina
- 1 hood/helm, empty, with 2 crimson light points (never more, never fewer)
- 1 chest plate, narrow and elegant, with a small vertical green rune slit
- 2 shoulder pieces, sharp and swept back like fins
- 1 long robe with about 6 visible tattered tails; the robe has no feet — the
  bottom of the robe dissolves into black mist, there is no ground contact by
  flesh, the robe hem touches the ground plane
- 2 hands, long-fingered, clawed, held out to the sides (no weapon in the
  right hand for most rows)
- 1 crescent-bladed scepter, held in the RIGHT hand: a thin black shaft with a
  single curved blade like a sliver of moon, edge glowing venom green

MATERIALS: blackened silver, verdigris green patina, void-black cloth with
green sheen in the folds, semi-translucent black mist at the robe hem.

SILHOUETTE PRIORITY: the floating crown above, the swept fin-shoulders, and the
crescent scepter. The robe hem should always dissolve rather than end in a
hard cut — that is its identifying trait.

SCALE IN CELL: fills about 72% of cell height. Slender. It is the only boss
that appears to FLOAT — the robe hem hovers 4 px above the ground point.

=====================================================================
PALETTE
=====================================================================
Armor black       #0e1216
Verdigris         #3f6b52
Patina highlight  #79b28c
Robe black        #16121c
Robe green sheen  #2b4a3a
Venom green       #3bff9a
Venom core        #b8ffd9
Crown iron        #3a3a44
Crimson eye       #ff5a7a
Mist              #1a1e22  (30~50% alpha)

=====================================================================
FRAME-BY-FRAME (42)
=====================================================================
ROW 1 — IDLE (underwater drift)
F1  Neutral. Scepter held low at the right side, robe hem misting at the base.
    Crown level above the hood, eyes at base brightness.
F2  Robe tails drift right, crown rotates 3 degrees clockwise.
F3  Chest rises as if inhaling, hood tilts 2 deg, eyes brighten one step.
F4  Robe tails drift back left, crown completes a slow half-rotation.
F5  Settle, mist at the hem thickens briefly.
F6  Identical to F1.

ROW 2 — WALK (glides, does not step)
F1  Gliding forward. Robe tails streaming behind, scepter trailing.
F2  Slight roll to the right, mist trailing in a thin line.
F3  Passing. Hood turned toward the camera, one hand raised in a lazy gesture.
F4  Slight roll back, robes flaring wider.
F5  Forward glide with the scepter now leading, robe hem stretched.
F6  Return toward F1, mist settling.

ROW 3 — ATTACK (GreenSlash — wide diagonal venom crescent)
F1  Anticipation. Scepter drawn across to the left hip, body coiling.
F2  Windup. Scepter raised to the left shoulder height, blade edge up.
F3  PEAK WINDUP — the tell. Scepter fully cocked back over the left shoulder,
    torso rotated 20 deg away, robe wrapping tight, eyes at maximum crimson.
F4  Strike travelling. The crescent blade cutting down-right, a thin green
    trail following the blade tip only (max 14 px behind the tip).
F5  IMPACT + max extension. Scepter at the bottom-right of the swing, body
    rotated fully, robe thrown wide, and a broad green crescent of light
    expanding along the swing path — about 30 px wide, inside the safe box.
F6  Recovery. Scepter rising back, crescent fading to green specks.

ROW 4 — SPECIAL 1 (Vanish — dissolves into mist)
F1  Gather. Both hands drawn together at the chest, scepter vertical between
    them, crown descending toward the hood.
F2  Body blurs. The robe's edges begin to break into mist, the chest rune
    glowing through.
F3  Half-dissolved. Lower robe is mist, the hood and crown are the only solid
    parts remaining, eyes bright.
F4  Fully dissolved into a vertical column of black-green mist. No body.
    The crown is still faintly visible inside the mist.
F5  Re-forming. The hood congeals first, then the shoulders, robe still mist.
F6  Fully solid again but shifted 6 px to the right of where it began, scepter
    already in guard, eyes settling.

ROW 5 — SPECIAL 2 (ShieldCast — hexagonal rune ward)
F1  Aim. Scepter pointed forward, off-hand open and raised.
F2  Build. Green runes gathering in a ring in front of the raised hand.
F3  Full charge. A hexagonal ward assembling, 6 rune segments, each glowing
    from dim to bright.
F4  Cast complete. The ward fully formed in front of the body, about 70 px
    across, edges crisp, the body braced behind it.
F5  HOLD — sustain pose. The ward at full brightness with visible facets,
    the lord standing straight and untouchable, robe still.
F6  Release. Ward collapsing inward into the scepter, which is now glowing.

ROW 6 — SPECIAL 3 (PortalTeleport + MagicBurst — ultimate)
F1  Rise. Both arms spread wide, crown rising higher above the hood.
F2  Full extension — TALLEST. Arms at shoulder height, robe flaring into a
    full circle, the crown at its highest point, eyes blazing.
F3  Culmination. A vertical portal ring opening BEHIND the lord, its edge
    green-black, and the chest rune at maximum brightness.
F4  Emission. A burst of green magic fired forward through the portal, emerging
    to the right of the body as a wedge of light, plus thin rune projectiles.
F5  Sustained. Body arched, arms still wide, portal fully open and churning.
F6  Fade. Portal closing to a line, arms lowering, crown descending.

ROW 7 — DEATH (crown shatters, robe collapses inward)
F1  Stagger. Scepter dropped, one hand clutched at the chest rune, eyes flaring.
F2  Crown cracks — 2 visible splits, one spike breaking off and falling.
F3  Collapse begins. The hood deflating inward, robe losing its shape.
F4  On the ground. Only a mound of black cloth with green light leaking out.
    The crown in pieces around it.
F5  The last ember. Everything has collapsed except one crimson point of light
    floating above the cloth.
F6  Nearly gone. The crimson point only, tiny, at about 15% opacity. No body.

=====================================================================
AVOID
=====================================================================
- Do NOT draw a face, mask, or skull. The hood must stay empty except the two
  light points. This is critical to the character.
- Do not give it legs. It has no visible feet.
- Do not use blue or violet energy. This boss is green/black only.
- Do not make the robe look like a solid cloak — the hem must always be mist.
```

---

# PART 4 — 보스 4: 탐식의 드래곤 니드호그 (nidhog)

**코드**: `boss_nidhog` · `atl_boss_nidhog.webp` · **156×162 · 11열×7행 = 1716×1134** · 챕터4 알프헤임 수목
**전투 성향**: `sig:"poisonfield"`, p3 beam+summon+poisonfield. **시체를 먹는 용, 갉아먹는 이빨**

```
=====================================================================
SUBJECT: "NIDHOGG, DRAGON OF DEVOURING" (탐식의 드래곤 니드호그)
=====================================================================
The corpse-eating serpent dragon that gnaws the roots of Yggdrasil. It is a
SCAVENGER first and a dragon second: gaunt, rib-showing, unhealthy, more
serpent than wyrm. Its wings are stretched membrane, thin enough to see the
bones. Rot and root fiber are tangled into its scales. It is always eating.

ANATOMY, EXACTLY:
- 1 long neck, S-curved, longer than a normal dragon's, carried low
- 1 head with an overlong jaw that does not close cleanly; visible teeth
  irregular, some broken, some too long
- 5 small eyes total: 2 primary at the brow, 3 smaller running back along the
  right side of the snout. Keep this exact count in every frame.
- 2 wings, membrane, 3 finger-bones each, tattered trailing edges
- 1 body, narrow and ribbed, individual ribs visible pushing at the skin
- 4 legs, thin, hooked claws, front legs shorter than rear
- 1 tail, long, ending in a frayed mass of root fibers (not a blade)
- Corrosive green ichor drips from the jaw and from splits in the belly

MATERIALS: rotting black-green scale, exposed bone-white rib, wet membranous
wing, dry root fiber, corrosive glowing ichor.

SILHOUETTE PRIORITY: the overlong low-carried neck and the frayed root tail.
The head should be the darkest mass with the brightest eyes. The wings must
never fully cover the ribcage — the ribs are a signature.

SCALE IN CELL: fills about 76% of cell height, but the body is long — it
occupies the full cell width when the neck is extended. Cells are narrow
(156 px), so compose VERTICALLY where possible: the neck rises, the tail drops.

=====================================================================
PALETTE
=====================================================================
Scale black       #10160f
Scale green       #2c3d24
Bone white        #cfcbb4
Wing membrane     #3a2f2a  (with 60% alpha edges)
Root fiber        #4a3b2a
Poison green      #7dff9a
Poison core       #d6ffe0
Ichor highlight   #aaffc0
Eye               #b8ff7a

=====================================================================
FRAME-BY-FRAME (42)
=====================================================================
ROW 1 — IDLE (restless, always chewing)
F1  Neutral. Neck low and forward, head level, jaw slightly open, wings folded.
F2  Jaw works — closes partway, a bead of ichor drops from the lower jaw.
F3  Neck raises 3 px, eyes narrow, tail root-fibers twitch.
F4  Wings shift and resettle, one membrane fold opening.
F5  Head dips back down, tongue flicks out and back.
F6  Identical to F1.

ROW 2 — WALK (low prowl, tail dragging)
F1  Contact. Front-right foot planted, body low, neck extended forward.
F2  Down. Weight on the front, ribs visibly compressing, tail dragging.
F3  Passing. Rear-left leg swinging through, wings held slightly out for balance.
F4  Up. Highest point, neck pulling back, tail lifting off the ground.
F5  Contact (opposite). Front-left planted, head turned slightly toward camera.
F6  Return toward F1, tail settling with a trail of ichor behind.

ROW 3 — ATTACK (full-length lunging bite)
F1  Anticipation. Neck coiling back, head drawn toward the chest, jaw opening.
F2  Deep windup. Neck fully compressed, S-shape tight, wings spreading for brace.
F3  PEAK WINDUP — the tell. Head pulled all the way back over the shoulders,
    jaw open at maximum, teeth all visible, ichor strands between the jaws.
F4  Strike travelling. Neck extending forward, head halfway to the target,
    a thin green trail at the jaw only.
F5  IMPACT + max extension. Neck fully extended to the right, jaw clamped shut
    on empty air or a tiny green burst at the bite point, front legs off the
    ground, body stretched, wings full out.
F6  Recovery. Neck retracting in a curve, jaw opening again, drool trailing.

ROW 4 — SPECIAL 1 (poison field — vomits a spreading pool)
F1  Gather. Head pulled down and back, throat swelling visibly.
F2  Build. The throat bulge travels up the neck, glow visible through the skin.
F3  Peak. Throat at maximum, green light leaking from the mouth, body braced low.
F4  Release. Head thrust forward and down, jaw wide, a thick stream of ichor
    leaving the mouth toward the ground in front of the body.
F5  Effect at max. A puddle of green poison on the ground in front, its edge
    irregular and steaming, radius about 60 px, plus rising fumes. Body still
    low and extended, tongue out.
F6  Settle. Head lifting, ichor dripping from the jaw, the pool still visible
    but flatter. Do not remove the pool entirely — it is the point of the move.

ROW 5 — SPECIAL 2 (corrosive glob spray)
F1  Aim. Head raised and turned to face right, throat beginning to swell.
F2  Draw. Neck arched back, 3 visible globs forming in the open jaw.
F3  Full charge. 5 globs floating in a loose arc in front of the mouth, all
    glowing green, the neck coiled.
F4  Launch. Globs fired right in a wide arc, head snapping forward, jaw closing.
F5  Follow-through. Head low, body turned right, arcs of green residue trailing.
F6  Return. Head coming back level, jaw wiping with the tongue.

ROW 6 — SPECIAL 3 (sustained acid beam — ultimate)
F1  Rise. Neck lifting, head tilting up, chest expanding.
F2  Full extension — TALLEST. Neck straight up, head at the highest point,
    wings fully spread, the whole body stretched to a vertical line.
F3  Culmination, brightest. Jaw wide open with a dense green light building
    between the teeth, the eyes blown out white-green.
F4  Emission. A thick acid beam fired to the right at head height, about 20 px
    thick, with a frothing edge and droplets falling from it.
F5  Sustained. Head braced, neck angled down slightly, beam still thick, the
    wings fighting the recoil.
F6  Fade. Beam breaking into dripping segments, neck coming down, jaw closing.

ROW 7 — DEATH (deflates and dissolves into rot)
F1  Stagger. Head thrown back, wings collapsing, ichor spurting from the belly.
F2  Legs give out — the front legs fold first, the body drops 18 px.
F3  Collapse. Neck falling to the side, head hitting the ground, jaw open.
F4  Ground. Body flat, wings splayed, the ribcage caving inward.
F5  Dissolving. Scales sloughing off as dark specks, green light leaking out
    of every joint, the head already half gone.
F6  Nearly gone. A low mound of rot, root fibers, and green smoke — about 15%
    opacity, no longer a recognizable creature.

=====================================================================
AVOID
=====================================================================
- Do not make it powerful, muscular, or majestic. It must look SICK.
- Do not make the wings leathery-dragon-bat. They are thin, torn, bony.
- Do not give it a blade or spiked tail tip. The tail ends in roots.
- Do not use red, orange, or violet. This boss is green and bone only.
- Do not hide the ribcage behind the wings in idle/walk rows.
```

---

# PART 5 — 보스 5: 화염의 거인 수르트 (surt)

**코드**: `boss_surt` · `atl_boss_surt.webp` · **272×186 · 6열×7행 = 1632×1302** · 챕터5 무스펠헤임
**전투 성향**: `sig:"firepillars"`, aggr 0.9, p3 quake+beam+firepillars. **라그나로크의 종결자, 세계를 태우는 자**

```
=====================================================================
SUBJECT: "SURT, THE FIRE GIANT" (화염의 거인 수르트)
=====================================================================
The ruler of Muspelheim who burns the world at Ragnarok. A colossal humanoid
of black basalt with molten magma running in the seams between plates. He
carries Laevateinn, a sword of living fire nearly as tall as he is. He does not
walk much — he arrives and then everything is on fire.

ANATOMY, EXACTLY:
- 1 head, basalt-plated, no visible mouth (the face is split by magma crevices),
  2 eyes of pure white-hot light, 1 crest of live flame rising about 40 px
  above the skull in 3 tongues
- 2 shoulders, massive, black rock with magma seams, the RIGHT one crusted
  with cooling slag
- 1 torso, a furnace: a wide vertical crack down the center glowing orange-white
- 2 arms, thick, oversized hands; the RIGHT hand grips Laevateinn
- 1 sword Laevateinn: total length about 165 px, a broad blade of solid flame
  with a black obsidian core running down the middle, a crossguard of black rock
- 2 legs, short and wide, feet like cooled lava slabs
- Magma drips continuously from the shoulders and the sword hand

MATERIALS: matte black basalt, glowing orange-white magma (emissive), obsidian
(glossy black, sharp highlights), live fire (translucent), cooling gray slag.

SILHOUETTE PRIORITY: the flame crest above the head and the sword. The sword
must break the silhouette clearly — never hidden in front of the torso. Because
cells are wide (272 px), give the sword room to swing to the right.

SCALE IN CELL: fills about 80% of cell height. The largest, heaviest boss.
The sword may extend to the cell's right edge but must stay inside the safe box.

=====================================================================
PALETTE
=====================================================================
Basalt black      #0f0c0a
Rock mid          #2b2420
Rock highlight    #514540
Magma deep        #c2400c
Magma mid         #ff7a1e
Magma white-hot   #ffd08a
Flame core        #fff2c0
Obsidian          #16131a  (with sharp #6b6480 specular)
Slag gray         #6a625c
Ember             #ffb35a

=====================================================================
FRAME-BY-FRAME (42)
=====================================================================
ROW 1 — IDLE (magma breathes in the seams)
F1  Neutral. Sword point resting on the ground at the right, both hands on the
    grip. Magma at base brightness.
F2  The chest furnace brightens one step; a magma drip falls from the shoulder.
F3  Shoulders lift 3 px, the flame crest rising and splitting into 4 tongues.
F4  Hold. Sword hand tightens, embers drift up from the blade.
F5  Settle, crest back to 3 tongues, magma dimming.
F6  Identical to F1.

ROW 2 — WALK (massive deliberate strides)
F1  Contact. Right foot forward, sword lifted off the ground, blade angled back.
F2  Down. Full weight lands, a ring of embers kicked out from the foot.
F3  Passing. Left leg swinging, torso turned 8 deg, the chest furnace flaring.
F4  Up. Highest point, sword swung forward slightly, flame crest streaming back.
F5  Contact (opposite). Left foot planted, sword high and behind, a fire trail
    on the ground where it passed.
F6  Return toward F1, embers settling.

ROW 3 — ATTACK (sweeping horizontal fire-sword slash)
F1  Anticipation. Sword raised across the body to the LEFT, both hands on grip.
F2  Deep windup. Sword drawn further left and back, body coiling, torso rotated
    25 deg away from the camera.
F3  PEAK WINDUP — the tell. Sword cocked fully behind the left shoulder, blade
    pointing up-left, the flame along it at maximum, body fully wound, the
    chest furnace blazing.
F4  Strike travelling. The sword sweeping down and across, a fire arc following
    the blade edge (about 18 px wide) but not filling the cell.
F5  IMPACT + max extension. Sword at the bottom-right of the arc, body rotated
    fully forward, one leg braced back, and a wide crescent of fire along the
    whole swing path — brightest frame of the row.
F6  Recovery. Sword rising back to guard, fire crescent dissolving into embers.

ROW 4 — SPECIAL 1 (fire pillars — sword plunged down)
F1  Gather. Sword raised point-up overhead with both hands, body straightening.
F2  Build. The chest furnace opens wider, magma running up the arms.
F3  Peak. Sword at highest point, entire blade white-hot, the crest roaring.
F4  Release. Sword driven point-first into the ground in front, both arms
    straight, knees bent.
F5  Effect at max. Three to four pillars of fire erupting from the ground in
    a pattern around the sword — each pillar about 24 px wide and 90 px tall,
    positioned to the sides and front, inside the safe box. Body braced low.
F6  Settle. Pillars shrinking to flame jets, sword pulled free, blade cooling.

ROW 5 — SPECIAL 2 (radial fire ring)
F1  Aim. Sword held horizontally at hip height, pointing right, body squared.
F2  Draw. Magma surging from the chest down through the sword arm.
F3  Full charge. Blade glowing white, a small ring of sparks orbiting the body
    at ankle height.
F4  Launch. Sword swung in a full flat circle at hip height, ring of fire
    leaving the blade.
F5  Follow-through. Ring expanded to about 86 px radius, lying flat on the
    ground, body still in the follow-through twist, sword out to the right.
F6  Return. Ring fading to a low scorch line, sword returning to guard.

ROW 6 — SPECIAL 3 (colossal fire beam — ultimate)
F1  Rise. Sword lifted to shoulder height, point forward, crest rising.
F2  Full extension — TALLEST. Sword thrust straight up, both arms extended,
    the flame crest at its highest, the whole body outlined in fire.
F3  Culmination, brightest frame. Fire pouring down the blade from the sky into
    the sword, the obsidian core white-hot, the eyes blown out.
F4  Emission. A colossal fire beam fired to the right from the sword point —
    about 30 px thick, tapering (thick at the sword, thin at the far end).
F5  Sustained. Body braced hard, one foot back, the beam still dense with
    visible rolling fire inside it.
F6  Fade. Beam breaking into sheets of flame, sword lowering, crest shrinking.

ROW 7 — DEATH (magma cools to black stone, then crumbles)
F1  Stagger. Sword dropped, body knocked back, magma seams sputtering.
F2  Knees buckle. The body drops 24 px, the chest furnace visibly dimming to
    a dull red.
F3  Collapse begins. Torso pitching forward, arms hanging, the crest collapsing
    into smoke.
F4  Ground. Body down on one knee and one hand, the magma now fully dark on the
    extremities.
F5  Cooling. The whole body now black rock, faint orange only at the chest,
    visible cracks spreading.
F6  Nearly gone. A pile of dark broken slabs and gray ash with a few last
    embers — about 15% opacity, no longer a figure.

=====================================================================
AVOID
=====================================================================
- Do not draw a human face, mouth, or expression. The face is rock and light.
- Do not put clothing, cape, or armor decoration on it. It is bare rock.
- Do not make the sword look like a metal sword that is on fire — the blade
  itself must be fire with an obsidian core.
- Do not use ice, blue, or green. This boss is black/basalt + orange/white.
- Do not let fire effects leave the safe box, especially in rows 4 and 6.
```

---

# PART 6 — 보스 6: 탐욕의 늑대 펜리르 (fenrir)

**코드**: `boss_fenrir` · `atl_boss_fenrir.webp` · **220×200 · 6열×7행 = 1320×1400** · 챕터6 니플헤임 설원
**전투 성향**: `sig:"charge"`, aggr 0.85, `chargeChain:2`, p2 blink, p3 frostnova. **사슬에 묶인 종말의 늑대**

> **이 시트가 표준 규격이다.** 220×200 · 6열 · 1320×1400 — PART 0의 마스터 스펙과 완전히 일치한다.
> 다른 보스를 만들 때도 이 격자에 맞추면 코드 수정 없이 그대로 쓸 수 있다.

```
=====================================================================
SUBJECT: "FENRIR, WOLF OF GREED" (탐욕의 늑대 펜리르)
=====================================================================
The chained apocalyptic wolf of Norse myth, grown monstrous — the size of a
house, not of a wolf. White-silver winter fur crusted with frost. His jaws do
not close properly: the lower jaw hangs slightly open always, showing a dark
interior. He is still in Gleipnir's broken remains — shattered chain links
drag from his forelegs and clatter on the ice.

ANATOMY, EXACTLY:
- 1 head, oversized relative to the body, long muzzle, lower jaw hanging open
- 2 ears, torn — the LEFT ear has a visible notch missing
- 4 eyes? NO — exactly 2 eyes, glowing pale violet, no pupils
- 1 body, lean and deep-chested, built like a wolf pushed past its limit
- 4 legs, heavy paws with black claws, frost crusted between the toes
- 1 tail, thick and low, dragging
- 1 broken chain: about 7 visible links + 1 shackle on the RIGHT foreleg,
  with 2 severed trailing links. The chain is dull iron, not glowing.
- Frost vapor leaves the mouth continuously; small ice crystals form and
  fall from the jaw and chest

MATERIALS: coarse white-silver winter fur, frost crystal, dark leather paw pads,
dull blackened iron chain, wet dark flesh inside the mouth.

SILHOUETTE PRIORITY: the huge open-jaw head at one end and the low dragging
chain at the other. The chest ruff should be the thickest mass. Never let the
tail read as a second head.

SCALE IN CELL: fills about 74% of cell height, and he is LONG — in attack and
charge poses the body spans the full cell width. Compose horizontally, keeping
the paws on the locked ground line.

=====================================================================
PALETTE
=====================================================================
Fur shadow        #6f7d92
Fur mid           #c9d6e4
Fur highlight     #ffffff
Frost crystal     #dff2ff
Eye glow          #c08aff   (emissive)
Mouth interior    #301c2c
Chain iron        #4c4a52
Chain highlight   #8e8b96
Frost aura        #bde4ff

=====================================================================
FRAME-BY-FRAME (42)
=====================================================================
ROW 1 — IDLE (low head, chained paw shifting, frost breath)
F1  Neutral. Head low and forward, weight even on all four paws, chain slack
    on the ice. Eyes at base glow.
F2  Chest rises 2 px, a frost vapor puff leaves the jaw and drifts right.
F3  Head lifts 3 px, ears rotate forward, the shackle shifts with a spark.
F4  Hold. Eyes brighten one step; two ice crystals fall from the chest ruff.
F5  Head lowers back, chain drags 2 px, vapor dissipates.
F6  Identical to F1.

ROW 2 — WALK (prowling circle, chain dragging)
F1  Contact. Front-right paw forward, head level, chain dragging behind.
F2  Down. Weight on the front, shoulders compress, frost kicked up.
F3  Passing. Rear-left swinging through, body low, tail sweeping.
F4  Up. Highest point, head rising slightly, chain lifting off the ice.
F5  Contact (opposite). Front-left paw planted, head turned a few degrees
    toward the camera.
F6  Return toward F1, chain settling back down with a light scratch trail.

ROW 3 — ATTACK (lunging charge — the signature "charge")
F1  Anticipation. Weight shifting to the rear, head pulled back, front paws
    gathering under the chest.
F2  Deep windup. Hips loaded, body coiled like a spring, fur bristling, the
    chain pulled taut against the ice.
F3  PEAK WINDUP — the tell. Fully crouched, rear legs compressed to the limit,
    head at its lowest, jaws beginning to open, eyes at maximum glow.
F4  Strike travelling. Front paws off the ground, body launching forward at a
    shallow upward angle, jaws wide, chain trailing behind in a straight line.
F5  IMPACT + max extension. The widest silhouette of the sheet: body fully
    extended in the air, jaws clamped, front paws reaching the right edge of
    the safe box, chain stretched straight behind. A thin frost wake along the
    body line only.
F6  Recovery. Landing on the front paws, body compressing on impact, head
    still forward, chain swinging back in.

ROW 4 — SPECIAL 1 (blink-slam — shadow dash to the flank)
F1  Gather. Body low, head down, frost gathering under the paws in a ring.
F2  Charge builds. The fur along the spine stands up; a violet shadow pools
    directly beneath the body.
F3  Peak charge. The body half-dissolved into violet smoke at its edges, still
    readable, eyes blazing, the chain already faded out.
F4  Gone. Only a burst of violet smoke and a frost scar on the ice, no body.
F5  Re-forming. The body congealing from smoke 8 px to the right, head and
    forepaws solid first, one forepaw raised to strike.
F6  Fully solid, mid-slam — front paws coming down, jaws open, shadow smoke
    still trailing off the rear half.

ROW 5 — SPECIAL 2 (howling frost-and-shadow shockwave)
F1  Aim. Weight back on the haunches, chest lifting, head starting to rise.
F2  Draw. Neck arched back, throat exposed, frost gathering in a ring at the
    paws.
F3  Full charge. Head thrown fully back, jaws wide toward the sky, a dense ring
    of frost and violet shadow starting to expand at ground level.
F4  Launch. The howl released — mouth at maximum, visible vapor jet upward,
    ring expanding outward past the paws.
F5  Effect at max. Radial ring of frost and shadow at about 84 px radius, lying
    flat, body braced low with head still up. Soft-edged, contained.
F6  Return. Head coming down, ring dissolving into falling snow and violet
    motes, chain settling.

ROW 6 — SPECIAL 3 (winter moonlight beam — ultimate)
F1  Rise. Head lifting, chest expanding, front legs straightening.
F2  Full extension — TALLEST. Head at the highest point, neck vertical, frost
    crest rising off the shoulders, chain pulled taut, eyes white-violet.
F3  Culmination, brightest. A cold violet-white light gathering inside the open
    jaws, frost streaming INTO the mouth from both sides, body outlined in rime.
F4  Emission. A concentrated beam fires right at head height, about 18 px
    thick, white core with violet edge, frost falling off the beam line.
F5  Sustained. Head braced forward, body low behind it, beam still dense, the
    chain vibrating on the ice.
F6  Fade. Beam breaking into sparkling shards, head lowering, glow receding.

ROW 7 — DEATH (chain shatters, legs buckle, body sinks into snow)
F1  Stagger. Head thrown back to the side, front legs sliding out, chain
    snapping apart at a link with visible fragments.
F2  Knees buckle. Body drops 22 px, chest hitting the ice, the broken chain
    scattering.
F3  Collapse. Torso rolling onto its side, one forepaw still reaching forward,
    eyes starting to dim.
F4  On the ice. Body lying flat on the side, head on the ground, jaws slack
    and open, fur flattening.
F5  Sinking. The lower body fading into the snow; only the head, chest, and one
    foreleg still solid, eyes down to a dim flicker.
F6  Nearly gone. The head and one foreleg only, already half-dissolved into
    frost and shadow, about 15% opacity.

=====================================================================
AVOID
=====================================================================
- Do not give him a second head or a second tail. One head, one tail.
- Do not make the chain glow or look magical. It is broken dull iron.
- Do not draw him standing tall and proud like a mascot. He is a chained
  monster — head low, weight forward, hostile.
- Do not use warm colors. This boss is white-silver with pale violet only.
- Do not let the jaws close fully in any frame except death frame 4 onward.
```

---

# PART 7 — 보스 7: 교만의 쌍랑 스콜 & 하티 (skoll)

**코드**: `boss_skoll` · `atl_boss_skoll.webp` · **126×200 · 11열×7행 = 1386×1400** · 챕터8 니다벨리르
**전투 성향**: `sig:"blink"`, aggr 0.9, `chargeChain:2`, p2 beam+blink+frostnova. **해와 달을 쫓는 쌍둥이 늑대**

> **⚠️ 가장 중요한 규칙**: 이것은 **늑대 두 마리**다. 두 머리 늑대가 **절대 아니다**.
> `src/game/data.ts` v4.1.3 주석에 명시된 신화 고증 사항이며, 과거에 "쌍두"로 잘못 만들어졌다.
> 코드는 `boss_skoll`과 `boss_hati` 두 개의 텍스처를 따로 등록해 쌍둥이를 동기화한다.
> 이 시트에는 **두 마리가 함께** 그려져야 한다(한 셀 안에 두 개체 = 하나의 유닛).

```
=====================================================================
SUBJECT: "SKOL AND HATI, THE TWIN WOLVES OF PRIDE" (교만의 쌍랑)
=====================================================================
Two separate wolves, always together, hunting as one unit. They are NOT a
two-headed wolf. Each has its own four legs, own tail, own head. They circle,
overlap, and cross each other. They are proud and synchronized — arrogant as
only a matched pair can be.

THE TWO WOLVES — their differences must read instantly even at small scale:
  SKOL (moon-chaser)
    - silver-white fur, colder and paler than Hati
    - pale blue emissive glow inside the chest and along the spine
    - leaner, longer-legged, built for speed
    - runs with the head low and the tail straight out
  HATI (sun-chaser)
    - ash-black fur with a MOLTEN GOLD MANE running from the skull down the
      spine to the shoulders; embers drift off the mane
    - warm orange-gold emissive glow, no blue
    - heavier build, thicker neck, shorter legs
    - runs with the head up and the tail curved

ANATOMY PER WOLF: 1 head / 2 eyes / 2 ears / 4 legs / 1 tail. Exactly that,
for each wolf. Two wolves = 2 heads, 4 eyes, 8 legs, 2 tails in every frame
where both are visible.

SILHOUETTE PRIORITY: the COLOR CONTRAST is the read — one pale silver-blue,
one black-gold. Keep them on opposite sides of the cell whenever possible so
both silhouettes stay legible. When they cross, let the crossing wolf pass in
FRONT with a slight overlap, never merge into one shape.

SCALE IN CELL: cells are narrow and tall (126 x 200). Compose VERTICALLY:
one wolf slightly higher or further back, the other lower and nearer. Each
wolf fills about 55% of cell height; together they fill the width edge to edge.
Keep both wolves fully inside the safe box — do not let a paw or tail clip.

=====================================================================
PALETTE
=====================================================================
SKOL
  fur shadow      #7e93ad
  fur mid         #cddcec
  fur highlight   #ffffff
  moon glow       #a9d8ff   (emissive, chest + spine)
HATI
  fur shadow      #14100e
  fur mid         #2a2320
  fur highlight   #4a3c33
  mane gold       #ffb347   (emissive, skull → shoulders)
  ember           #ff7a1e
SHARED
  eye (Skol)      #bfe6ff
  eye (Hati)      #ffd08a
  claw / paw pad  #1a1a1e

=====================================================================
FRAME-BY-FRAME (42)
=====================================================================
ROW 1 — IDLE (circling each other slowly, tails high, snapping)
F1  Both standing, facing slightly inward. Skol left-rear, Hati right-front.
    Skol's head low, Hati's head high.
F2  Skol steps 2 px right; Hati's mane embers drift up.
F3  They turn their heads toward each other, ears forward, both glowing
    one step brighter.
F4  Hati snaps at the air toward Skol; Skol's tail flicks up.
F5  Both settle back, Hati's head lowering slightly, embers falling.
F6  Identical to F1.

ROW 2 — WALK (running side by side in a loose V)
F1  Contact. Skol forward-left, Hati forward-right, both front paws planted.
F2  Down. Both compress, Hati's mane streaming back, Skol's glow trailing.
F3  Passing. Legs crossing under both bodies, the V tightening.
F4  Up. Both at highest point, Skol's tail straight out, Hati's curved.
F5  Contact (opposite). Both planted, Hati now slightly ahead of Skol.
F6  Return toward F1, formation opening back into the V.

ROW 3 — ATTACK (alternating lunges — Skol first, Hati immediately after)
F1  Anticipation. Skol coils low at the left, Hati braces behind-right,
    both heads pulled back.
F2  Skol launches — front paws off the ground, jaws open, Hati still loading.
F3  PEAK WINDUP for Hati — Skol is mid-air at maximum extension, and Hati is
    fully coiled behind with jaws just opening. This frame must show the relay.
F4  Hati launches through the space Skol vacated; Skol is landing on the left.
F5  IMPACT + max extension. Hati at full extension with jaws clamped at the
    right edge of the safe box; Skol braced low on the left, having landed.
    Both at maximum glow.
F6  Recovery. Hati landing, Skol already turning back inward, both heads
    coming around toward each other.

ROW 4 — SPECIAL 1 (crossing charge — both leap from opposite sides)
F1  Gather. Both wolves split apart, moving to opposite edges of the cell,
    heads low, one at upper-left, one at lower-right.
F2  Charge builds. Both crouch simultaneously, glow building at both chests,
    a faint blue line and a faint gold line on the ground between them.
F3  Peak charge. Both fully coiled at opposite edges, mirrored poses, both
    showing teeth, the two glows meeting in the middle of the cell.
F4  Release. Both have launched toward the center, one from each side, bodies
    crossed in an X, still distinct color masses.
F5  Effect at max. Both have passed through — Skol now at lower-right, Hati at
    upper-left, back to back, and a crossed pair of light trails remains in the
    center where they intersected.
F6  Settle. Both landing and turning inward, trails fading to sparks.

ROW 5 — SPECIAL 2 (twin howl — ring of light and shadow)
F1  Aim. Both wolves step together into the center, shoulders almost touching,
    heads rising.
F2  Draw. Both necks arch back, Skol's blue glow and Hati's gold glow building
    at their throats.
F3  Full charge. Both heads fully back, mouths opening, a split ring at the
    ground — cold blue on Skol's half, warm gold on Hati's half.
F4  Launch. Both howl simultaneously, mouths at maximum, vapor jets upward.
F5  Effect at max. A radial ring expanding outward — one half blue, one half
    gold — at about 82 px radius, lying flat, both wolves braced side by side
    in the center.
F6  Return. Heads lowering, ring breaking into falling blue ice and gold embers.

ROW 6 — SPECIAL 3 (merged frost-and-flame beam — ultimate)
F1  Rise. Both wolves stand shoulder to shoulder facing right, heads level.
F2  Full extension — TALLEST. Both necks fully extended forward and slightly
    up, bodies stretched, Skol's glow and Hati's mane both at maximum.
F3  Culmination, brightest. Two separate lights converge between their muzzles
    — cold blue from Skol, molten gold from Hati — forming one bright core.
F4  Emission. A single thick beam fires right, about 22 px thick, with a cool
    blue upper half and a hot gold lower half, clearly split down the middle.
F5  Sustained. Both wolves braced hard against the recoil, heads still level,
    the beam still split-toned.
F6  Fade. Beam separating into two thinning streams, heads lowering, glows
    dimming.

ROW 7 — DEATH (one falls, the other howls and lies beside it, both fade)
F1  Stagger. Hati is hit and knocked sideways; Skol's head snaps toward it.
F2  Hati down. Hati collapses onto its side at the right; Skol is still
    standing but its glow is flickering hard.
F3  Skol's howl. Skol stands over Hati, head thrown back, a thin vapor jet
    upward, its blue glow at maximum for one frame — grief, not attack.
F4  Skol lies down. Skol folds its legs and lies pressed against Hati's body,
    head resting on Hati's flank. Both glows now dim.
F5  Both fading. Skol's blue glow and Hati's gold mane both dying; the two
    bodies beginning to break into particles.
F6  Nearly gone. Two low glowing outlines side by side — one faint blue, one
    faint gold — at about 15% opacity. They remain together.

=====================================================================
AVOID
=====================================================================
- ABSOLUTELY NO two-headed wolf. Two separate animals, always.
- Do not draw three or more wolves.
- Do not put both wolves in the same color scheme. The contrast IS the design.
- Do not let one wolf completely disappear to make room for the other —
  except in death frame 2 onward where Hati is down.
- Do not swap which one is black — Hati is always the black-and-gold one.
- Do not merge them into a single silhouette in the ultimate row.
```

---

# PART 8 — 보스 8: 혈안의 문지기 가름 (gram)

**코드**: `boss_gram` · `atl_boss_gram.webp` · **220×200 · 6열×7행 = 1320×1400** · 챕터9 헬
**전투 성향**: `sig:"counter"`, aggr 1.0, p2 counter+blink+blinkslash, p3 quake. **헬의 대문을 지키는 사냥개**

> 이 시트가 이번에 고친 `cols: 6` 버그의 대상이다. 표준 격자(220×200)와 일치한다.
> 신화 고증: **가름(Garmr)** — 헬의 문을 지키는 사냥개. "그람(Gram)"은 시구르드의 검이므로 혼동 금지.

```
=====================================================================
SUBJECT: "GARMR, THE BLOOD-EYED GATEKEEPER" (혈안의 문지기 가름)
=====================================================================
The hound that guards the gate of Hel. Not a normal wolf grown large — a
hellhound of bloated muscle and stretched-wrong skin. It is standing at a gate
no one else can see, and it has been standing there for a very long time.

ANATOMY, EXACTLY:
- 1 head, broad and blunt, more mastiff than wolf, with FAR TOO WIDE jaws
- 4 EYES total — this is the signature. 2 primary forward-facing, 2 smaller
  set above and outside them. All four are bloodshot with crimson irises.
  Count is exactly 4 in every frame.
- 1 mane of broken iron spearheads and torn chain fragments pushed through the
  flesh of the neck and shoulders — about 9 visible spikes of irregular length
- 1 ribcage visible through splits in the hide, with pale green deathlight
  glowing from INSIDE the chest cavity (the light is internal, not a halo)
- 2 front legs, thick and planted wide, claws blunt from scraping stone
- 2 rear legs, lower and heavier, haunches oversized
- 1 tail, short and docked, not a long wolf tail
- Blood is always present: on the jaws, dripping to the ground, in the pawsteps

MATERIALS: bloated dark hide stretched over bone, wet matted fur at the
extremities, corroded iron spikes, exposed bone rib, blood, internal green light.

SILHOUETTE PRIORITY: the iron-spike mane and the ribcage gap are the two
unmistakable reads. The blocky wide-jawed head must never look lupine-elegant.
Four eyes must be countable.

SCALE IN CELL: fills about 80% of cell height. Broad and heavy — wider than
tall in the torso. Keep the front paws on the locked ground line.

=====================================================================
PALETTE
=====================================================================
Hide shadow       #14090c
Hide mid          #2e1519
Hide highlight    #4a2228
Dry blood         #7c1420
Fresh blood       #b81e2c
Bone rib          #d8cbb0
Iron spike        #3d3a3f
Iron rust         #6b4a30
Deathlight        #8affc0   (emissive, internal)
Deathlight core   #e0fff0
Eye               #ff2a3a   (emissive, all four)

=====================================================================
FRAME-BY-FRAME (42)
=====================================================================
ROW 1 — IDLE (head low, chain mane rattling, four eyes tracking)
F1  Neutral. Head low and forward, all four paws planted, jaws slightly open,
    blood dripping from the lower jaw. Ribcage glow at base level.
F2  Chest expands 2 px, the ribcage glow brightens, a blood drop hits the ground.
F3  Head lifts 2 px, all four eyes shifting right, mane spikes settle.
F4  Hold. Jaws part slightly wider; the deathlight pulses once inside the ribs.
F5  Head lowers back, mane rattling, blood drip resumes.
F6  Identical to F1.

ROW 2 — WALK (heavy prowl, blood in the pawsteps)
F1  Contact. Front-right paw planted, head low, weight forward.
F2  Down. Full weight, ribcage light flaring briefly through the splits.
F3  Passing. Rear-left swinging through, mane spikes shifting with the motion.
F4  Up. Highest point, head level, blood trail visible on the ground behind.
F5  Contact (opposite). Front-left planted, head turned slightly toward camera —
    all four eyes visible in this frame, use it.
F6  Return toward F1, blood pooling under the paw.

ROW 3 — ATTACK (short brutal counter-bite)
F1  Anticipation. Head pulled back and down, jaws beginning to open, front paws
    digging in.
F2  Deep windup. Neck compressed, head low between the shoulders, the iron mane
    standing up.
F3  PEAK WINDUP — the tell. Head fully withdrawn, jaws wide open with all teeth
    showing, blood strands between them, four eyes at maximum, body loaded.
F4  Strike travelling. Head thrusting forward, jaws still open, neck extending.
F5  IMPACT + max extension. Jaws slammed shut at the right edge of the safe box,
    neck fully extended, front paws off the ground, a burst of blood and green
    deathlight at the bite point. Widest silhouette of the row.
F6  Recovery. Head retracting, jaws working, blood trailing from the teeth.

ROW 4 — SPECIAL 1 (green death-shockwave from planted paws)
F1  Gather. Both front paws planted hard, head down, chest lowered toward the
    ground.
F2  Charge builds. The ribcage deathlight intensifies, visible through the
    splits as a bright internal glow.
F3  Peak charge. The light reaches maximum, spilling out through the rib splits
    and the mouth, the mane spikes all glowing at their bases.
F4  Release. Body driven down, both front paws slammed flat, head thrown back.
F5  Effect at max. A flat green shockwave ring expanding from the front paws,
    outer edge at about 86 px radius, with fragments of bone and blood thrown up
    along it. Body braced low, head up.
F6  Settle. Ring dissolving into green mist, body rising back to guard.

ROW 5 — SPECIAL 2 (blink-slash — disappears and reappears)
F1  Aim. Body lowering, head turning to face right, claws spreading.
F2  Draw. The mane spikes rattling hard, green deathlight flickering, a shadow
    pooling under the body.
F3  Full charge. The rear half of the body already dissolved into dark red
    smoke, the head and forequarters still solid, four eyes blazing.
F4  Gone. Only a burst of dark red smoke and a smear of blood on the ground.
    No body at all in this frame.
F5  Re-forming. The head and front paws congealing about 10 px to the right,
    claws already extended, a green trail behind them.
F6  Fully solid, mid-slash — front claws raking downward at the right edge of
    the safe box, smoke still trailing off the rear.

ROW 6 — SPECIAL 3 (green death-fire beam — ultimate)
F1  Rise. Head lifting, chest expanding, front legs straightening.
F2  Full extension — TALLEST. Head thrown back and up, neck vertical, jaws wide,
    the ribcage light pouring upward, mane spikes flared out.
F3  Culmination, brightest. Green fire building in the throat, visible through
    the open jaws, the whole body outlined in deathlight.
F4  Emission. A torrent of green death-fire fired right at head height, about
    24 px thick, with visible bone fragments and blood swirling inside it.
F5  Sustained. Head braced forward, body low behind it, front paws dug in, beam
    still dense.
F6  Fade. Beam breaking into dripping green fire, head lowering, jaws closing.

ROW 7 — DEATH (ribcage light goes dark, chains fall, collapses across the gate)
F1  Stagger. Head snapped to the side, front legs sliding, the mane spikes
    shedding one by one.
F2  Knees give. Body drops 24 px, the chest hitting the ground, a green light
    escaping from the ribs in a rush.
F3  Collapse. Torso rolling onto its side, front paws still reaching, the
    ribcage light dying to an ember.
F4  On the ground. Body flat on its side, head on the ground, jaws slack and
    open, mane spikes scattered around it.
F5  Darkening. The deathlight fully out, the hide going matte, the body start-
    ing to sink into the ground.
F6  Nearly gone. A dark stain, a few iron spikes, and a last wisp of green —
    about 15% opacity, no longer a creature.

=====================================================================
AVOID
=====================================================================
- Do not draw 2 or 3 eyes — there must be EXACTLY 4, countable.
- Do not make it a lean wolf. It is bloated, heavy, mastiff-jawed.
- Do not make the green light a halo or aura around the body. It is INTERNAL,
  escaping only through the rib splits and the mouth.
- Do not make the mane look like fur — it is broken iron and chain.
- Do not use purple violet or blue. This boss is blood red, iron, and green.
```

---

# PART 9 — 보스 9: 종언의 마룡 아부디토스 (abudditos) — 최종 보스

**코드**: `boss_abudditos` · `atl_boss_abudditos.webp` · **156×162 · 11열×7행 = 1716×1134** · 챕터10 최종
**전투 성향**: `sig:"ring"`, aggr 0.8, `chargeChain:2`, p3 = 전 시그니처 총동원 + holymantle. **세계의 종언 그 자체**

```
=====================================================================
SUBJECT: "ABUDDITOS, THE DEMON DRAGON OF THE END" (종언의 마룡 아부디토스)
=====================================================================
THE FINAL BOSS. The primordial end-being from Atlantis — older than the nine
realms, the thing Yggdrasil's roots were grown to hold back. It is not a
monster that wants to destroy; it is destruction that happens to be shaped
like a dragon. It is serene. It is inevitable. It does not rage.

Its body is not fully organic: obsidian-black hide is shot through with
cracking red-gold fractures of pure ending-light, like a vessel loaded past its
limit. Its wings are not membranes — they are torn openings in reality, edged
in that same red-gold light.

ANATOMY, EXACTLY:
- 1 head, long and narrow, crowned with antlers of calcified world-tree root
  (3 main points per side, branching)
- 6 EYES — this is the signature. Six narrow slit eyes, arranged 2 rows of 3
  along the skull. Always exactly 6.
- 2 wings, each a ragged tear in space edged with red-gold light, no feather,
  no membrane, no bone. Through them the background would show if there were one.
- 1 long body, serpentine but with a distinct chest and shoulders
- 4 legs, thin and long, ending in claws of black glass
- 1 tail, long, splitting into 2 frayed ends near the tip
- 1 tattered golden covenant-seal worn at the neck — a broken ring of ancient
  gold with a missing segment. It is the only warm non-hostile element.

MATERIALS: obsidian hide (glossy black, sharp specular), red-gold fracture
light (emissive, running in branching cracks), calcified root antler (bone-gray),
ancient tarnished gold, void (inside the wings).

SILHOUETTE PRIORITY: the branching antlers, the six eyes, and the torn-reality
wings. The wings must break the silhouette with hard jagged edges, never soft
feathers. The fracture light lines must follow the body's contour, not float.

SCALE IN CELL: cells are narrow (156 x 162), so the creature reads TALL and
LONG. It fills about 78% of cell height, and in extension poses the antlers
reach near the top of the safe box. Compose vertically; let the tail drop.

=====================================================================
PALETTE
=====================================================================
Hide black        #0a0a0e
Hide sheen        #1e1c24
Fracture deep     #8a1024
Fracture mid      #ff3a6a
Fracture white-hot#ffd0d8
Antler bone       #a89a8a
Claw glass        #14121a
Covenant gold     #b08a3a   (tarnished)
Covenant highlight#f0d28a
Void (wings)      #050408   (with light edge only)

=====================================================================
FRAME-BY-FRAME (42)
=====================================================================
ROW 1 — IDLE (hovering, fractures pulsing like a slow heartbeat, no breath)
F1  Neutral. Body slightly above the ground line, wings half-torn open, head
    level, all six eyes at base glow. Fractures at base brightness.
F2  The fractures brighten along the chest and shoulder, one pulse.
F3  Body rises 2 px, the antlers tilt 2 degrees, wings opening slightly.
F4  HOLD — brightest idle frame. All six eyes brighten one step, the covenant
    seal catching light.
F5  Body settles, fractures dimming back, wings folding.
F6  Identical to F1.

ROW 2 — WALK (gliding, wings leaving afterimages of void)
F1  Gliding forward. Body level, wings swept back, tail trailing.
F2  Slight downward pitch, fractures streaming along the body line.
F3  Passing. Wings drawn in, body at its most compact, head turned a few
    degrees toward the camera — all six eyes visible here.
F4  Up. Wings opening wide again, body rising, tail lifting.
F5  Forward glide with the head leading, one foreleg reaching.
F6  Return toward F1, void afterimages behind the wing edges.

ROW 3 — ATTACK (a single contemptuous claw-sweep)
F1  Anticipation. One foreleg drawn up and back, body rotating slightly away.
F2  Deep windup. The foreleg raised high, claws spread, the fractures along
    that arm at maximum.
F3  PEAK WINDUP — the tell. Arm fully cocked back over the shoulder, body
    coiled away, the six eyes narrowed, the covenant seal swinging forward.
F4  Strike travelling. The arm sweeping down through the front arc, a thin
    red-gold line following the claw tips only.
F5  IMPACT + max extension. Claws at the end of the sweep at the bottom-right,
    body rotated fully forward, wings thrown wide, and a red-gold arc of torn
    space left along the swing path — about 26 px wide, inside the safe box.
F6  Recovery. Arm returning to the body, the arc closing into a seam, eyes
    returning to neutral.

ROW 4 — SPECIAL 1 (radial field of ending-light — the signature "ring")
F1  Gather. Wings drawn in tight, head lowered, body compacting.
F2  Charge builds. The fracture light runs from the head down the spine into
    the chest, gathering.
F3  Peak charge. A tight compressed sphere of red-gold light at the chest,
    the wings vibrating, all six eyes white-hot.
F4  Release. Wings snapped fully open, head thrown back, the sphere leaving
    the body.
F5  Effect at max. A radial ring of ending-light expanded to about 88 px radius,
    its leading edge sharp and its interior showing a distorted, darkened field.
    Body braced at the center, wings still wide.
F6  Settle. Ring thinning to a seam and closing, wings folding, head leveling.

ROW 5 — SPECIAL 2 (three void orbs — summon and fire)
F1  Aim. Body squared toward the right, head level, wings half-open.
F2  Draw. Three points of void light form in a triangle in front of the chest,
    each with a red-gold rim.
F3  Full charge. Three void orbs fully formed and orbiting slowly in front of
    the body, each about 14 px across, the fractures feeding them.
F4  Launch. Orbs fired right in a diverging spread, body recoiling slightly.
F5  Follow-through. Body rotated right, orbs already off-frame, trails of
    distorted void remaining in the air.
F6  Return. Body returning to guard, the void trails sealing shut.

ROW 6 — SPECIAL 3 (beam of raw termination — ultimate)
F1  Rise. Head lifting, wings spreading, body rising above the ground line.
F2  Full extension — TALLEST silhouette of the sheet. Body vertical, head at the
    highest point, antlers near the top of the safe box, wings fully torn open
    and wide, tail hanging straight down, all six eyes blazing.
F3  Culmination, brightest frame. Ending-light pouring INTO the open maw from
    both wings, the fractures across the whole body at maximum, the covenant
    seal glowing for the only time in the sheet.
F4  Emission. A thick beam of red-gold and absolute black fired right at head
    height — about 26 px thick, its core pure void with a red-gold edge.
F5  Sustained. Body braced forward, wings still wide, beam still dense, small
    fragments of reality peeling off along the beam line.
F6  Fade. Beam breaking into drifting black glass and golden dust, body
    lowering, wings folding.

ROW 7 — DEATH (fractures spread, shatters into black glass and golden dust — NOT a collapse)
F1  Stagger. Body recoiling backward in the air, head snapped to the side,
    fractures spreading across the flank.
F2  Fractures multiply — the whole hide is now a web of red-gold light, the
    wings beginning to tear further.
F3  Suspended. The body hanging in the air, cracks fully lit, all six eyes
    dimming together, the covenant seal falling away from the neck.
F4  Shattering begins. The outer layer of the body breaking into black glass
    fragments that drift upward, not downward.
F5  Mostly fragments. The body is now a loose collection of black shards and
    golden dust, the shape still faintly implied but dissolving upward.
F6  Nearly gone. Black glass shards and golden dust drifting UP and out, about
    15% opacity. There must NOT be a corpse on the ground — this thing does not
    leave a body.

=====================================================================
AVOID
=====================================================================
- Do not draw a normal dragon. No scales pattern, no feather wings, no horns.
  The wings are TORN SPACE, the antlers are ROOT, the hide is fractured glass.
- Do not draw 2, 4, or 8 eyes. Exactly SIX, arranged 2 rows of 3.
- Do not make it angry, roaring, or snarling in idle/walk. It is SERENE.
- Do not make death a collapse to the ground. It shatters and drifts UPWARD.
- Do not use green, blue, or purple as the main energy. Red-gold + void only.
- Do not make the covenant seal large or prominent — it is a worn detail.
```

---

# PART 10 — 보스 10: 재림의 파수꾼 베오르드 (vord)

**코드**: `boss_vord` · `atl_boss_vord.webp` · **156×162 · 11열×7행 = 1716×1134** · 재림 r5
**전투 성향**: `sig:"quake"`, aggr 1.0, p2 quake+counter+crystalburst. **아부디토스의 대척점 — 끝내는 자 vs 되돌리는 자**

```
=====================================================================
SUBJECT: "VORD, THE WARDEN OF REBIRTH" (재림의 파수꾼 베오르드)
=====================================================================
A black dragon that guards the cycle of return. Where Abudditos ENDS things,
Vord RESTORES them — unwillingly, mechanically, forever. It is a jailer that
pities its prisoners. Its body is armored like a cathedral door: heavy plates
of black iron over a dragon frame, with warm amber light in the seams instead
of red.

It does not walk on four legs often. It advances on two hind legs with the
front limbs held off the ground, and it fights with RING OF FLOATING RUNES
rather than claws.

ANATOMY, EXACTLY:
- 1 head, blunt and helmeted, no visible mouth, 2 narrow amber eyes
- 1 crown of iron plates fused to the skull, like a doorway arch
- 2 wings, short and heavy, plated — not built for flight, built to shield
- 1 body, barrel-chested, heavily plated, the plates riveted and worn
- 2 hind legs, thick, digitigrade, planted like columns
- 2 forelimbs, held off the ground, ending in short armored claws
- 1 tail, thick, ending in a blunt iron counterweight
- 7 FLOATING RUNE TABLETS orbiting the body — flat slabs of gray stone, each
  carved with one amber rune. They orbit, they do not attach.
  Count is exactly 7 in every frame where they are visible.

MATERIALS: blackened iron plate with rivets, worn gray stone rune tablets,
warm amber emissive light in the seams and runes, no fur, no scale texture.

SILHOUETTE PRIORITY: the orbiting rune tablets and the arch-crown. The tablets
should form a readable ring around the body — they are the boss's identity and
its weapon. The blunt tail counterweight anchors the back.

SCALE IN CELL: fills about 80% of cell height, standing upright on the hind
legs. Compose vertically; the tablets orbit in the upper half of the cell.

=====================================================================
PALETTE
=====================================================================
Plate black       #101014
Plate mid         #26262e
Plate highlight   #45454f
Rivet             #5a5a66
Rune stone        #6e6a62
Rune stone light  #9a968a
Amber emissive    #ffb05a
Amber core        #ffddaa
Tarnished gold    #8a6a30

=====================================================================
FRAME-BY-FRAME (42)
=====================================================================
ROW 1 — IDLE (tablets orbit slowly, amber pulses in sequence)
F1  Neutral. Standing on both hind legs, forelimbs held at chest height,
    7 tablets in a ring. Amber at base.
F2  The tablets advance 2 degrees around the ring; the amber pulses left to
    right in sequence.
F3  Chest rises 2 px, the plate seams brightening, one tablet dipping lower.
F4  Hold. All runes at even brightness; the arch-crown catches light.
F5  Tablet ring settles back; amber dimming.
F6  Identical to F1.

ROW 2 — WALK (heavy quadruped-like advance on the hind legs)
F1  Contact. Right hind leg forward, body pitched slightly forward, tablets
    trailing behind the ring's rotation.
F2  Down. Full weight lands, the tail counterweight dropping, tablets jolting.
F3  Passing. Left hind leg swinging, forelimbs adjusting for balance, the ring
    rotating faster.
F4  Up. Highest point, body straightening, the tablets flaring once.
F5  Contact (opposite). Left leg planted, head turned a few degrees toward the
    camera, one tablet passing in front of the chest.
F6  Return toward F1, tablets resuming their slow orbit.

ROW 3 — ATTACK (foreleg slam driving runes into the ground)
F1  Anticipation. One forelimb raised, the corresponding tablet rising with it.
F2  Deep windup. Forelimb high above the head, the tablet directly above it,
    the body leaning back.
F3  PEAK WINDUP — the tell. Forelimb fully raised, the tablet glowing at maximum
    above it, the other six tablets tightening into a narrow arc, head tilted up.
F4  Strike travelling. Forelimb coming down, the tablet following it, a thin
    amber line between them.
F5  IMPACT + max extension. Forelimb slammed into the ground, the tablet driven
    with it and half-buried, and an amber shock ring at the impact point about
    40 px radius. Body fully committed forward, hind legs braced.
F6  Recovery. Forelimb lifting, the tablet pulling free, the ring fading.

ROW 4 — SPECIAL 1 (consecutive lightning strikes — the "quake")
F1  Gather. Both forelimbs raised, the body straightening, tablets spreading
    into a wide ring.
F2  Charge builds. All 7 runes brightening in sequence, amber light gathering
    above the crown.
F3  Peak charge. Every tablet at maximum, a bright amber knot above the head,
    the body fully extended upward.
F4  Release. Head thrown back, forelimbs thrown wide — the first strike
    descending at the right edge of the safe box.
F5  Effect at max. Three vertical amber lightning bolts striking the ground in
    a line to the right, each with a burst at the base, and the tablets still
    holding their ring. Body braced.
F6  Settle. Bolts breaking into falling amber sparks, tablets returning to orbit.

ROW 5 — SPECIAL 2 (defensive tablet wall + counter)
F1  Aim. The tablets swinging forward to the front of the body.
F2  Build. The 7 tablets sliding into a flat vertical wall in front of the
    chest, edges beginning to glow.
F3  Full charge. The wall fully formed — 7 slabs edge to edge, about 80 px
    wide, amber seams between them.
F4  Cast complete. The wall at full brightness, the body crouched behind it,
    only the crown and eyes visible above.
F5  HOLD — counter pose. The wall holding, and the forelimbs braced for the
    return strike, the eyes at maximum.
F6  Release. The wall exploding outward in a burst of amber shards, the body
    already lunging forward through the gap.

ROW 6 — SPECIAL 3 (amber beam of restoration-light — ultimate)
F1  Rise. Body straightening fully, forelimbs rising, the tablets spiraling
    inward toward the chest.
F2  Full extension — TALLEST. Standing at maximum height, head up, all 7 tablets
    compressed into a tight ring around the chest, the crown at the top.
F3  Culmination, brightest frame. The tablet ring fused into a single blazing
    amber annulus, the body outlined, the arch-crown white-hot.
F4  Emission. A thick amber beam fired right at chest height, about 24 px thick,
    warm at the core and white at the edges, with faint rune glyphs inside it.
F5  Sustained. Body braced, hind legs wide, beam still dense, the annulus
    beginning to break apart.
F6  Fade. Beam separating into individual falling runes, tablets scattering back
    into orbit, amber dimming.

ROW 7 — DEATH (tablets drop one by one, amber drains, kneels and stills)
F1  Stagger. Body knocked back, one forelimb buckling, one tablet already
    falling away.
F2  Knees bend. Body dropping 26 px, three tablets clattering to the ground.
F3  Collapse begins. Torso pitching forward, the remaining tablets falling in
    sequence, the amber now dim in most seams.
F4  Kneeling. Body down on both hind legs folded, both forelimbs on the ground,
    head bowed. Two tablets still faintly orbiting.
F5  Still. Head fully lowered, the last two tablets landing beside it, only a
    faint amber glow in the chest.
F6  Nearly gone. A dark plated outline, 7 fallen tablets, and a fading amber
    point — about 15% opacity. It does not shatter; it just goes still.

=====================================================================
AVOID
=====================================================================
- Do not make it look like Abudditos. Same armor idea, opposite meaning: Vord
  is IRON PLATE and AMBER, not fractured glass and red-gold.
- Do not draw 5 or 9 tablets. Exactly 7.
- Do not use claws or bites as the primary attack language. It fights with
  RUNE TABLETS.
- Do not use red, violet, or green. Warm amber and black iron only.
- Do not let it fly. The wings are short and heavy, and stay folded/serving
  as shield plating.
```

---

# PART 11 — 보스 11: 세계수를 먹는 뱀 요르문간드 (jorm)

**코드**: `boss_jorm` · `atl_boss_jorm.webp` · **272×162 · 6열×7행 = 1632×1134** · 재림 r10
**전투 성향**: `sig:"beam"`, aggr 0.9, `chargeChain:2`, p3 beam+spiral+poisonfield. **세계수를 감고 갉는 뱀**

```
=====================================================================
SUBJECT: "JORMUNGANDR, THE WORLD-SERPENT" (세계수를 먹는 뱀 요르문간드)
=====================================================================
The serpent that coils around the world and feeds on the roots of Yggdrasil.
This is not the classic sea-serpent — over ages of eating the world-tree it has
GROWN BAT-LIKE WINGS AND GOLDEN HORNS, a wyrm in the process of becoming a
dragon. Moss, root fiber, and pale bark still grow out of its scales: it is
half forest itself.

ANATOMY, EXACTLY:
- 1 head, far too large for the neck, with a heavy lower jaw and a snout that
  ends in a blunt upward hook
- 2 GOLDEN HORNS, swept back, each with 2 forks — 4 points per side is wrong;
  keep it 2 horns, each forked twice
- 2 eyes, vertical slit, pale mint
- 2 wings, bat-like, 3 finger-bones, moss growing along the leading edge,
  deliberately undersized for the body — it cannot really fly, only lunge
- 1 long serpentine body, thick as a tree trunk, coiling
- 0 visible legs — it has no limbs at all beyond the wings
- 1 tail, tapering to a thin point wrapped in root fiber
- Moss, creeping vines, and pale bark plates grow on the flank and back
- Pale mint venom glow runs the length of the belly in a continuous line

MATERIALS: deep green-black scale, creeping moss, pale dead bark, gold horn,
membraneous wing, soft mint bioluminescence.

SILHOUETTE PRIORITY: the oversized head with gold horns, and the COIL. The
coil is the identity — the body must always read as wrapped/looping, never as
a straight tube. Cells are wide (272 px) — use the width for the coil.

SCALE IN CELL: fills about 76% of cell height. The coil occupies most of the
cell width. The head should be roughly 1/4 of the cell width.

=====================================================================
PALETTE
=====================================================================
Scale black       #0c1410
Scale green       #1f3326
Scale highlight   #37513c
Moss              #4e6b3a
Bark pale         #8a7f66
Gold horn         #c9a13a   (warm metallic, not glowing)
Venom mint        #9affd0   (emissive, belly line)
Mint core         #e0fff4
Wing membrane     #2c3a30  (with 55% alpha trailing edges)
Eye               #b8ffe0

=====================================================================
FRAME-BY-FRAME (42)
=====================================================================
ROW 1 — IDLE (coil tightens and loosens, tongue tasting the air)
F1  Neutral. Body in a loose S-coil, head raised at mid height, wings folded
    against the back. Belly line at base glow.
F2  The coil tightens by 2 px; a section of moss shifts on the flank.
F3  Head lifts 3 px, tongue flicks out and back, belly glow brightening.
F4  Hold. Wings half-open and resettle; bark plates on the back catching light.
F5  Coil loosens, head lowers back, tongue retracts.
F6  Identical to F1.

ROW 2 — WALK (serpentine slither, wings folded and dragging)
F1  Contact. The body pushing forward from the rear coil, head level, wings
    dragging at the sides.
F2  Down. The forward section compressing, the coil behind bunching up.
F3  Passing. The wave of motion travelling down the body, wings shifting.
F4  Up. Head rising slightly, the rear coil extending, moss shaking loose.
F5  Contact (opposite). The body's wave reversing, head turning a few degrees
    toward the camera.
F6  Return toward F1, the coil re-forming behind.

ROW 3 — ATTACK (full-head whip strike)
F1  Anticipation. Head drawing back, the neck coiling behind it, mouth closing.
F2  Deep windup. Head fully retracted against the coil, jaw opening, belly glow
    dimming as energy goes to the strike.
F3  PEAK WINDUP — the tell. Head pulled all the way back, the neck compressed
    into tight loops, jaw wide open, mint light visible in the throat.
F4  Strike travelling. Head whipping forward, the neck uncoiling behind it, a
    thin mint trail following only the jaw.
F5  IMPACT + max extension. Head fully extended to the right edge of the safe
    box, jaw clamped, the entire body stretched into a long line from the rear
    coil, wings thrown back. Widest silhouette of the row.
F6  Recovery. Head drawing back in a curve, the body re-coiling from the tail up.

ROW 4 — SPECIAL 1 (spiral venom barrage — rings of projectiles)
F1  Gather. Body coiling inward into a tight spiral, head lowered to the center.
F2  Charge builds. The belly line brightening along its full length, the spiral
    compressing further.
F3  Peak charge. The body at maximum compression, the mint line blown bright,
    head tucked, wings clamped tight.
F4  Release. The body exploding outward from the spiral, head snapping up.
F5  Effect at max. Three concentric arcs of mint venom projectiles fanning to
    the right, each arc about 20 px apart, the body stretched in a wide C shape.
    Projectiles may exit the cell; the body stays in the safe box.
F6  Settle. The arcs dispersing into drifting mint motes, body re-coiling.

ROW 5 — SPECIAL 2 (lunge-charge, twice)
F1  Aim. Body drawing into a compressed coil, head low and forward, wings
    opening slightly.
F2  Draw. The coil at maximum compression, like a spring, wings half-spread.
F3  Full charge. The body fully loaded, head aimed right, belly glow at maximum,
    a mint line drawn on the ground beneath it.
F4  Launch. The body released — head and forward third flying right, the coil
    trailing, wings spread wide and dead in the air.
F5  In flight. The whole body extended horizontally at chest height, head at
    the right edge, wings fully out, moss tearing free.
F6  Landing / reloading. Body compressing again as it lands, head turning back
    left, preparing the second charge — this frame should look like F2 but
    shifted, not identical.

ROW 6 — SPECIAL 3 (sustained venom beam — ultimate)
F1  Rise. Head lifting, the body uncoiling upward, wings spreading.
F2  Full extension — TALLEST. The body raised into a vertical column, head at
    the highest point, wings fully spread, the belly line blazing.
F3  Culmination, brightest. Jaw wide open with dense mint light gathering, the
    whole scale surface rimmed in bioluminescence.
F4  Emission. A thick mint venom beam fired right at head height, about 22 px
    thick, with a dripping lower edge falling as droplets.
F5  Sustained. The body braced in a wide brace, head angled slightly down,
    beam still dense, wings fighting the recoil.
F6  Fade. Beam breaking into falling droplets, the body lowering, wings folding.

ROW 7 — DEATH (coils loosen, body goes limp in a spiral, dissolves into moss)
F1  Stagger. Head thrown back, the coil collapsing outward, moss bursting off
    the flank.
F2  The body loses tension — the coils falling open into a loose spiral.
F3  Head drops to the ground, jaw open, the belly line dimming along its length.
F4  Limp. The whole body lying in a flattened spiral, wings splayed, the mint
    glow reduced to a faint line.
F5  Dissolving. The scales breaking into moss and root matter, the gold horns
    the last hard elements, the head already half gone.
F6  Nearly gone. A low spiral of moss, root fiber, and drifting mint spores —
    about 15% opacity, and the gold horns are gone.

=====================================================================
AVOID
=====================================================================
- Do not draw legs. It has no limbs besides the wings.
- Do not make the wings large or functional. They are undersized, mossy, and
  it only lunges with them.
- Do not draw more than 2 horns per side, or more than 2 forks each.
- Do not make the body straight. The COIL must always be present.
- Do not use red, orange, or violet. This boss is green, moss, and mint.
- Do not make the gold horns emissive — they are plain warm metal.
```

---

# PART 12 — 보스 12: 요툰헤임 얼음 골렘 나그르 (nagr)

**코드**: `boss_nagr` · `atl_boss_nagr.webp` · **156×162 · 11열×7행 = 1716×1134** · 재림 r15
**전투 성향**: `sig:"beam"` 계열, p1 slam/volley/zones, p3 beam+quake. **걷는 빙하**

```
=====================================================================
SUBJECT: "NAGR, THE ICE COLOSSUS OF JOTUNHEIM" (요툰헤임 얼음 골렘)
=====================================================================
A giant assembled from stacked glacial blocks, held together by ancient frost
runes. Where a head should be, there is a frozen giant's SKULL with blue
corpse-light burning in the sockets. It does not dodge. It does not flinch. It
is a walking glacier that has been given a job and will not stop doing it.

ANATOMY, EXACTLY:
- 1 head: a frozen giant's skull, jaw hanging loose, 2 eyes as corpse-blue
  lights deep in the sockets. No flesh, no lips, no tongue.
- 2 shoulder masses, each a cluster of ice blocks with rune carvings
- 1 torso, a stack of 5~6 visible glacial slabs, irregular, with frost runes
  carved on the front face, blue light in the seams between slabs
- 2 arms, each ending in a hammer-like fist of CLEAR blue ice (not opaque)
- 2 legs, short and thick, blocks piled like a cairn
- 0 weapon — the fists are the weapons
- Rime and snow continuously shed from every upper surface
- 4 visible frost runes total on the torso front (do not add more)

MATERIALS: translucent glacial blue ice with internal bubbles and fracture
planes, white rime crust, dark winter slate in the deep seams, corpse-blue
emissive light.

SILHOUETTE PRIORITY: the skull head and the two clear ice fist-hammers. The
blocky stacked construction must read as ARTIFICIAL — this is built, not grown.
Straight block edges, not organic curves.

SCALE IN CELL: fills about 82% of cell height, wide and top-heavy. Cells are
narrow (156 px), so compose vertically with the arms hanging close to the body.

=====================================================================
PALETTE
=====================================================================
Ice deep          #2a5a78
Ice mid           #5f93b4
Ice clear         #bce4f4   (translucent, fist hammers)
Ice highlight     #f0fbff
Slate seam        #2a2f38
Rime white        #ffffff
Rune light        #5fdcff   (emissive)
Corpse-eye        #7fd8ff   (emissive, in the skull sockets)

=====================================================================
FRAME-BY-FRAME (42)
=====================================================================
ROW 1 — IDLE (rune light pulses, ice crust cracks and re-forms)
F1  Neutral. Standing planted, both fists at the sides, skull head level,
    4 torso runes at base glow.
F2  The runes brighten in sequence left to right; a sheet of rime falls from
    the left shoulder.
F3  Chest rises 2 px — the top slab lifting, blue light spilling from the seams.
F4  Hold. Both corpse-eyes brighten; a fracture line appears on the right fist
    and immediately re-freezes.
F5  The top slab settles back, rime shedding from both shoulders.
F6  Identical to F1.

ROW 2 — WALK (slow tectonic steps)
F1  Contact. Right leg block planted forward, body pitched slightly forward,
    left fist swinging back.
F2  Down. Full weight lands, the torso slabs compressing, rime shaken loose.
F3  Passing. Left leg block swinging through, torso rotating 5 degrees, the
    runes flaring as the seams shift.
F4  Up. Highest point, body straightening, both fists rising slightly.
F5  Contact (opposite). Left leg planted, right fist swinging forward, the
    skull head turning a few degrees toward the camera.
F6  Return toward F1, slabs settling with a visible compression.

ROW 3 — ATTACK (both fists raised and smashed down together)
F1  Anticipation. Both fists beginning to rise, the torso leaning back.
F2  Deep windup. Both fists above the shoulders, the skull head tilting back,
    the runes at maximum.
F3  PEAK WINDUP — the tell. Both fists fully overhead and touching, body arched
    back, the seams between the torso slabs glowing brightly, corpse-eyes white.
F4  Strike travelling. Both fists coming down together through the front arc,
    a thin frost trail behind them.
F5  IMPACT + max extension. Both fists smashed into the ground directly in
    front, body folded forward, knees bent, and a burst of ice shards and white
    rime thrown up at the impact point (max 36 px tall, inside the safe box).
F6  Recovery. Body rising, fists pulling apart, frost falling from the shoulders.

ROW 4 — SPECIAL 1 (stomp → ring of ice spikes)
F1  Gather. Weight shifting onto the right leg, the left fist drawn in.
F2  Charge builds. The torso runes all brightening together, the body coiling
    downward.
F3  Peak charge. The body at its lowest compression, all runes at maximum, a
    blue line gathering on the ground at the feet.
F4  Release. The right leg block stomping the ground, both fists thrown out.
F5  Effect at max. A radial ring of ice spikes bursting from the ground, each
    spike about 18 px wide and 50 px tall, arranged at about 72 px radius, all
    inside the safe box. Body braced upright at the center.
F6  Settle. Spikes sinking back into the ground, the runes dimming.

ROW 5 — SPECIAL 2 (ice spear fired from the chest)
F1  Aim. Torso rotated to face right, both fists drawn back.
F2  Draw. The top torso slab sliding open, blue light gathering in the gap.
F3  Full charge. A spear of clear ice formed and protruding forward from the
    chest, about 60 px long, the seams at maximum brightness.
F4  Launch. The spear fired right at chest height, the torso slabs snapping
    back together.
F5  Follow-through. Body rotated further right, frost ring at the launch point,
    the spear already off-frame.
F6  Return. Torso returning to square, the runes settling.

ROW 6 — SPECIAL 3 (blizzard beam — ultimate)
F1  Rise. The body straightening, both fists raised to shoulder height.
F2  Full extension — TALLEST. Standing at maximum height, arms spread wide,
    the skull head thrown back, every rune blazing.
F3  Culmination, brightest. All seams and runes white-blue, a ring of gathered
    frost condensing in front of the skull, the corpse-eyes blown out.
F4  Emission. A wide beam of freezing wind fired right, about 30 px thick with
    sharp icy tendrils at the edges, pale white-blue.
F5  Sustained. Body braced hard, one leg back, the beam still dense and swirling.
F6  Fade. Beam breaking into falling ice particles, arms lowering, runes dimming.

ROW 7 — DEATH (runes fail, blocks separate, skull falls last and shatters)
F1  Stagger. The body knocked back, one arm block breaking off and falling.
F2  The seams go dark — the rune light dying in sequence from the feet upward.
F3  Collapse begins. The torso slabs sliding apart, the body losing its shape,
    fists dropping.
F4  Down. A pile of ice blocks on the ground, the skull still on top of the pile
    with the eyes flickering.
F5  The skull tilts and begins to crack — 2 visible fractures across the cranium.
F6  Nearly gone. A cairn of ice rubble with the shattered skull pieces on top,
    about 15% opacity, only the rime still white.

=====================================================================
AVOID
=====================================================================
- Do not draw an organic ice creature or a yeti. It is BUILT from blocks.
- Do not give it a face. The skull is bone, with light inside — no expression.
- Do not make the ice opaque white. The body is translucent blue; the fists are
  nearly clear.
- Do not add more than 4 torso runes.
- Do not use fire, green, or violet. This boss is ice blue and slate only.
```

---

# 부록 A — 규격 요약표 (코드에 등록된 실제 값)

| 코드 키 | 프레임 | 열 | 행 | 시트 크기 | 행별 프레임 | 비고 |
|---|---|---|---|---|---|---|
| `boss` guardian | 191×146 | 8 | 7 | 1528×1022 | 8,8,8,8,8,8,8 | |
| `boss2` behemoth | 330×212 | 12 | 7 | 3960×1484 | 6,6,6,6,6,6,6 | 6~12열 투명 |
| `boss3` abysslord | 191×146 | 8 | 7 | 1528×1022 | 8,8,8,8,8,8,8 | |
| `boss_nidhog` | 156×162 | 11 | 7 | 1716×1134 | 11,11,10,11,11,11,11 | 3행 10장 |
| `boss_surt` | 272×186 | 6 | 7 | 1632×1302 | 6,6,6,6,6,6,6 | |
| `boss_fenrir` | 220×200 | 6 | 7 | 1320×1400 | 6,6,6,6,6,6,6 | **표준** |
| `boss_skoll` | 126×200 | 11 | 7 | 1386×1400 | 11×7 | 쌍랑(두 마리) |
| `boss_nagr` | 156×162 | 11 | 7 | 1716×1134 | 11,11,10,11,11,11,11 | |
| `boss_hati` | 191×146 | 8 | 7 | 1528×1022 | 8×7 | 쌍랑 개별 |
| `boss_jorm` | 272×162 | 6 | 7 | 1632×1134 | 6,6,5,6,6,6,6 | 3행 5장 |
| `boss_abudditos` | 156×162 | 11 | 7 | 1716×1134 | 11,11,10,11,11,11,11 | 최종 보스 |
| `boss_vord` | 156×162 | 11 | 7 | 1716×1134 | 11,11,10,11,11,11,11 | |
| `boss_gram` | 220×200 | 6 | 7 | 1320×1400 | 6,6,6,6,6,6,6 | **vc198에서 수정** |

## 부록 A-2 — 11열 보스의 "빈 프레임" 주의

`boss_nidhog` / `boss_nagr` / `boss_abudditos` / `boss_vord` / `boss_skoll` 은 **11열**이다.
7행 × 11열 = 77셀이지만 실제 사용은 행별 11~10장이다. 즉:

- 11열 보스를 만들 때는 **가로 11칸**으로 그려야 코드가 프레임을 찾는다.
- 6열로 만들면 `row * 11 + i` 계산이 어긋나 **다른 행의 프레임이 섞여 나온다**.
- 만약 6열로 만들었다면 `BOSS_ATLAS`의 `cols`를 6으로 바꾸고 `BOSS_ATLAS_ROWS`를
  `[6,6,6,6,6,6,6]`으로 갱신해야 한다. **코드 수정 없이 그냥 넣으면 반드시 깨진다.**

## 부록 B — 행 순서 (게임 규약 — 절대 바꾸지 말 것)

```
행0 (맨 위)  IDLE      루프
행1          WALK/RUN  루프
행2          ATTACK    기본 공격, 1회 (타격은 4~5프레임)
행3          SPECIAL 1 광역/장판기, 1회
행4          SPECIAL 2 탄막/원형 폭발, 1회
행5          SPECIAL 3 궁극기(빔 등), 1회
행6 (맨 아래) DEATH     사망, 1회 (마지막 프레임 15% 잔존)
```

`src/game/textures.ts`의 `registerBossAnims()`가 이 순서를 **하드코딩**해서 읽는다.
`Boss.animFor()`도 이 키 이름(`-idle`, `-walk`, `-atk`, `-sp1`, `-sp2`, `-sp3`, `-die`)에 의존한다.

## 부록 C — 결과물을 받은 뒤 내가 하는 일

1. PNG를 `public/assets/atl_boss_<키>.webp`로 변환
2. `BOSS_ATLAS`의 `fw`/`fh`/`cols`를 새 시트에 맞춰 갱신
3. `BOSS_ATLAS_ROWS`의 행별 프레임 수를 실측값으로 갱신
4. 전수 검증 스크립트 실행 — `나머지(aw%fw, ah%fh) == 0` 이고 `cols == 실제열` 인지 확인

> `cols` 누락 시 기본값 12로 계산되어 프레임이 어긋나는 버그가 vc198에서 발견됐다
> (`boss_gram`: 실제 6열인데 12로 계산 → 78/42 프레임 요청). 새 시트를 넣을 때
> 이 항목을 반드시 확인해야 한다.

## 부록 D — GPT가 6열로만 생성하는 경우

GPT 이미지 생성기는 임의 격자를 정확히 못 맞추는 경우가 흔하다. 대응:

- **6열 220×200으로 통일**하고 `BOSS_ATLAS`의 `cols`를 전부 6으로, `BOSS_ATLAS_ROWS`를
  `[6,6,6,6,6,6,6]`으로 갱신한다. `fw/fh`는 시트 실측으로 맞춘다.
- 이렇게 하면 13종 전부 같은 규격이 되어 검증이 단순해진다.
- 단, `boss2`(330×212)와 `boss_surt`(272×186)처럼 프레임이 큰 보스는 6열 220×200으로
  줄이면 디테일이 손실된다. 이 둘은 별도 규격을 유지하는 편이 낫다.
