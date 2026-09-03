#!/usr/bin/env python3
"""
SERTZ 디자인 개편 — 업로드 에셋 → public/assets 컨버팅 (v3.0.8)
트랙: B아이콘 / B2스킬아이콘 / A UI스킨 / D타일·데코 / C VFX 스트립
규약: 아이템/타일 키(파일명) 불변 → 코드 무변경, 신규 키는 skillicon/·ui2/·vfx2_* 네임스페이스
"""
import os, re, glob
from PIL import Image, ImageEnhance

UP = "/home/z/my-project/upload"
A = "/home/z/my-project/public/assets"
IC = f"{UP}/extracted/icons"
SH = f"{UP}/extracted/SharpUI/SharpUI/Textures"
SER = f"{UP}/extracted/Serene_Village_revamped_v1.9/SERENE_VILLAGE_REVAMPED"
CUR = f"{UP}/extracted/Free-Cursed-Land-Top-Down-Pixel-Art-Tileset/PNG"
RF = "/home/z/my-project/upload/extracted/RF_Catacombs_v1.0"
WF = f"{UP}/extracted/Warped Shooting Fx/Warped Shooting Fx/Pixel Art"
CF = f"{UP}/extracted/Cartoon FX Remaster/Cartoon FX Remaster/CFXR Assets/Graphics"
UI2 = f"{A}/ui2"
SK = f"{A}/skillicon"
os.makedirs(UI2, exist_ok=True)
os.makedirs(SK, exist_ok=True)

def icon(cat, name):
    return Image.open(f"{IC}/{cat}/{name}.png").convert("RGBA")

def save(im, path):
    im.save(path)
    return path

report = []

# ────────────────────────── B. 아이템 아이콘 (32×32, 키 불변) ──────────────────────────
ITEMS = {
    "item_potion_hp":  ("Potions", "Icon4"),
    "item_potion_mp":  ("Potions", "Icon26"),
    "item_potion_hp2": ("Potions", "Icon33"),
    "item_potion_mp2": ("Potions", "Icon10"),
    "item_buff_atk":   ("Buffs", "Icon1"),
    "item_buff_def":   ("Buffs", "Icon2"),
    "item_buff_exp":   ("Buffs", "Icon3"),
    "item_buff_spd":   ("Buffs", "Icon4"),
    "item_weapon_1":   ("Swords", "Icon15"),
    "item_weapon_2":   ("Swords", "Icon24"),
    "item_weapon_3":   ("Swords", "Icon31"),
    "item_weapon_4":   ("Swords", "Icon17"),
    "item_weapon_5":   ("Swords", "Icon18"),
    "item_weapon_6":   ("Swords", "Icon36"),
    "item_armor_1":    ("Cuirass", "Icon1"),
    "item_armor_2":    ("Cuirass", "Icon2"),
    "item_armor_3":    ("Cuirass", "Icon3"),
    "item_armor_4":    ("Cuirass", "Icon4"),
    "item_armor_5":    ("Cuirass", "Icon5"),
    "item_armor_6":    ("Cuirass", "Icon6"),
    "item_ring_power": ("Rings_jewellery", "Icon1"),
    "item_ring_vital": ("Rings_jewellery", "Icon2"),
    "item_ring_crit":  ("Rings_jewellery", "Icon3"),
    "item_ring_guard": ("Rings_jewellery", "Icon4"),
    "item_pendant_arcane": ("Rings_jewellery", "Icon5"),
    "item_pendant_vital":  ("Rings_jewellery", "Icon6"),
    "item_scroll_return":  ("Scrolls", "Icon1"),
    "item_scroll_warp":    ("Scrolls", "Icon2"),
    "item_scroll_star":    ("Scrolls", "Icon3"),
    "item_emerald":    ("Gems1", "Icon18"),
}
for key, (cat, name) in ITEMS.items():
    try:
        save(icon(cat, name), f"{A}/{key}.png")
        report.append(f"[item] {key} <- {cat}/{name}")
    except Exception as e:
        report.append(f"[item][FAIL] {key}: {e}")

# ────────────────────────── B2. 스킬 아이콘 (신규 /assets/skillicon/) ──────────────────────────
SKILLS = {
    "warrior":     ("Swordsman_skills", "Icon25", "Swordsman_skills", "Icon28"),
    "berserker":   ("Barbarian_skills", "Icon1",  "Barbarian_skills", "Icon13"),
    "guardian":    ("Swordsman_skills", "Icon17", "Swordsman_skills", "Icon3"),
    "ranger":      ("Archer", "Icon5",  "Archer", "Icon23"),
    "sniper":      ("Archer", "Icon47", "Archer", "Icon48"),
    "windrunner":  ("Archer", "Icon43", "Archer", "Icon3"),
    "mage":        ("Pyromanser", "Icon25", "Warlock", "Icon16"),
    "archmage":    ("Lightning_mage_pack", "Icon13", "Cryomancer", "Icon25"),
    "sage":        ("Priest_Skill_Icons", "Icon25", "Priest_Skill_Icons", "Icon16"),
    "thief":       ("Thief", "Icon25", "Thief", "Icon16"),
    "warlord":     ("Barbarian_skills", "Icon24", "Swordsman_skills", "Icon20"),
    "paladin":     ("Paladin", "Icon12", "Paladin", "Icon7"),
    "eagleeye":    ("Archer", "Icon38", "Archer", "Icon46"),
    "tempest":     ("Archer", "Icon44", "Archer", "Icon19"),
    "stormbringer":("Lightning_mage_pack", "Icon31", "Pyromanser", "Icon33"),
    "chronicle":   ("Priest_Skill_Icons", "Icon31", "Priest_Skill_Icons", "Icon2"),
    "assassin":    ("Thief", "Icon3",  "Thief", "Icon20"),
    "swashbuckler":("Pirate_Skill_Icons_Icon13.png", None, "Pirate_Skill_Icons_Icon25.png", None),
    "warbringer":  ("Barbarian_skills", "Icon17", "Swordsman_skills", "Icon42"),
    "crusader":    ("Paladin", "Icon1",  "Paladin", "Icon21"),
    "deadeye":     ("Archer", "Icon6",  "Archer", "Icon7"),
    "skylord":     ("Archer", "Icon42", "Archer", "Icon11"),
    "arclord":     ("Lightning_mage_pack", "Icon25", "Cryomancer", "Icon31"),
    "eternal":     ("Priest_Skill_Icons", "Icon5", "Priest_Skill_Icons", "Icon33"),
    "nightblade":  ("Thief", "Icon31", "Necromancer_Skill_Icons_Icon25.png", None),
    "duelist":     ("Pirate_Skill_Icons_Icon31.png", None, "Swordsman_skills", "Icon30"),
    "shadowlord":  ("Necromancer_Skill_Icons_Icon13.png", None, "Thief", "Icon5"),
    "blademaster": ("Swordsman_skills", "Icon33", "Pirate_Skill_Icons_Icon5.png", None),
}
# flatten 시 카테고리 prefix로 저장된 것 처리: flat 파일 우선
def skill_src(cat, name):
    p = f"{IC}/{cat}/{name}.png"
    if os.path.exists(p):
        return Image.open(p).convert("RGBA")
    p2 = f"{IC}/{cat}_{name}.png" if not cat.endswith(".png") else f"{IC}/{cat}"
    if os.path.exists(p2):
        return Image.open(p2).convert("RGBA")
    return None

for cls, (c1, n1, c2, n2) in SKILLS.items():
    for slot, (c, n) in (("s1", (c1, n1)), ("s2", (c2, n2))):
        im = None
        if n is None:  # flat 파일 경로
            p = f"{IC}/{c}"
            if os.path.exists(p):
                im = Image.open(p).convert("RGBA")
        else:
            im = skill_src(c, n)
        if im is not None:
            save(im, f"{SK}/{cls}_{slot}.png")
            report.append(f"[skill] {cls}_{slot}")
        else:
            report.append(f"[skill][FAIL] {cls}_{slot}: {c}/{n}")

# ────────────────────────── A. UI 스킨 (SharpUI → ui2/) ──────────────────────────
def down(src, w, h=None):
    im = Image.open(src).convert("RGBA")
    if h is None:
        h = int(im.height * w / im.width)
    return im.resize((w, h), Image.LANCZOS)

UI_MAP = {
    "panel.png":   (f"{SH}/info_box.png", 512),
    "panel_big.png": (f"{SH}/background.png", 640),
    "button.png":  (f"{SH}/rect_button.png", 480),
    "input.png":   (f"{SH}/rect_input.png", 480),
    "list.png":    (f"{SH}/list_item_background.png", 320),
    "list_sel.png":(f"{SH}/list_item_background_selected.png", 320),
    "header.png":  (f"{SH}/dialog_header_background.png", 480),
    "bar_frame.png": (f"{SH}/loading_bar_frame.png", 256),
    "bar_inner.png": (f"{SH}/loading_bar_inner.png", 256),
    "res_frame.png": (f"{SH}/resourc_bar_frame.png", 256),
    "res_inner.png": (f"{SH}/resourc_bar_inner.png", 256) if os.path.exists(f"{SH}/resourc_bar_inner.png") else (f"{SH}/loading_bar_inner.png", 256),
    "avatar.png":  (f"{SH}/hero_avatar.png", 96),
    "close.png":   (f"{SH}/icon_close.png", 48),
    "check.png":   (f"{SH}/check.png", 48),
    "ab_fireball.png": (f"{SH}/ability_fireball.png", 96),
    "ab_lightning.png":(f"{SH}/ability_lightning.png", 96),
    "ab_shield.png":   (f"{SH}/ability_shield.png", 96),
    "ab_slash.png":    (f"{SH}/ability_slash.png", 96),
    "ab_sword.png":    (f"{SH}/ability_sword.png", 96),
    "ab_sword2.png":   (f"{SH}/ability_sword_double.png", 96),
    "potion_red.png":  (f"{SH}/Potions/potion_red_512.png", 64),
    "potion_blue.png": (f"{SH}/Potions/potion_blue_512.png", 64),
    "potion_green.png":(f"{SH}/Potions/potion_green_512.png", 64),
    "potion_orange.png":(f"{SH}/Potions/potion_orange_512.png", 64),
    "potion_pink.png": (f"{SH}/Potions/potion_pink_512.png", 64),
}
for out, (src, w) in UI_MAP.items():
    try:
        save(down(src, w), f"{UI2}/{out}")
        report.append(f"[ui2] {out}")
    except Exception as e:
        report.append(f"[ui2][FAIL] {out}: {e}")

# ────────────────────────── D. 타일 (64×64, 키 불변) ──────────────────────────
def cell(src, x, y, w, h, scale=1):
    im = Image.open(src).convert("RGBA").crop((x, y, x + w, y + h))
    if scale != 1:
        im = im.resize((w * scale, h * scale), Image.NEAREST)
    return im

def tint(im, rgb, strength=1.0):
    layer = Image.new("RGBA", im.size, rgb + (0,))
    base = im.copy()
    base.alpha_composite(layer)
    out = Image.blend(im, base, strength)
    return out

def hueshift(im, deg, sat=1.0, val=1.0):
    import colorsys
    im2 = im.copy().convert("RGBA")
    px = im2.load()
    for yy in range(im2.height):
        for xx in range(im2.width):
            r, g, b, a = px[xx, yy]
            if a == 0:
                continue
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            hh = (hh + deg / 360) % 1.0
            ss2 = max(0, min(1, ss * sat))
            vv2 = max(0, min(1, vv * val))
            nr, ng, nb = colorsys.hsv_to_rgb(hh, ss2, vv2)
            px[xx, yy] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
    return im2

def to64(im):
    return im.resize((64, 64), Image.NEAREST)

SER_PNG = f"{SER}/Serene_Village_32x32.png"
CUR_G = f"{CUR}/Ground.png"
RF_M = f"{RF}/mainlevbuild.png"

# grass 후보: 세렌 아틀라스 (96,0) 32×32 → ×2
grass = cell(SER_PNG, 96, 0, 32, 32, 2)
save(to64(grass), f"{A}/tile_grass.png"); report.append("[tile] tile_grass <- serene grass")
# path: 세렌 흙길 — 실측 (192,32) 셀이 순수 흙색 (196,159,82)
path = cell(SER_PNG, 192, 96, 32, 32, 2)
save(to64(path), f"{A}/tile_path.png"); report.append("[tile] tile_path <- serene dirt(192,96)")
# dark(알프헤임 보라 숲): grass → 보라 시프트 (채도↑)
save(to64(hueshift(grass, 95, 1.0, 0.75)), f"{A}/tile_dark.png"); report.append("[tile] tile_dark <- grass purple v2")
# magma(무스펠하임): 저주 땅 플랫 필 (352,96) 16px → red-orange
cur_flat = cell(CUR_G, 352, 96, 16, 16, 4)
save(to64(hueshift(cur_flat, -18, 1.15, 0.95)), f"{A}/tile_magma.png"); report.append("[tile] tile_magma <- cursed red")
# snow: grass → 청백 데색 (밝기 과노출 수정)
snow = hueshift(grass, 130, 0.30, 1.18)
snow = ImageEnhance.Brightness(snow).enhance(1.05)
save(to64(snow), f"{A}/tile_snow.png"); report.append("[tile] tile_snow <- grass icy v2")
# cave: 카타콤 바닥 (736,208) 16px
cave = cell(RF_M, 736, 208, 16, 16, 4)
save(to64(cave), f"{A}/tile_cave.png"); report.append("[tile] tile_cave <- catacomb floor")
# stone: 카타콤 바닥 변형 (832,208)
stone = cell(RF_M, 832, 208, 16, 16, 4)
save(to64(stone), f"{A}/tile_stone.png"); report.append("[tile] tile_stone <- catacomb floor v2")
# hel: cursed 플랫 → 딥 퍼플
save(to64(hueshift(cur_flat, 210, 0.9, 0.75)), f"{A}/tile_hel.png"); report.append("[tile] tile_hel <- cursed purple")
# abyss: 카타콤 다크 필 (736,416) 16px → 인디고
abyss = cell(RF_M, 736, 416, 16, 16, 4)
save(to64(hueshift(abyss, 40, 1.1, 0.85)), f"{A}/tile_abyss.png"); report.append("[tile] tile_abyss <- catacomb dark")
# path 변형 3종 — 동일한 흙 셀(192,96) 기준
d = cell(SER_PNG, 192, 96, 32, 32, 2)
save(to64(hueshift(d, -25, 1.2, 0.9)), f"{A}/tile_magma_path.png")
ice = hueshift(d, 130, 0.3, 1.3)
save(to64(ice), f"{A}/tile_ice.png")
save(to64(ImageEnhance.Brightness(d).enhance(0.55)), f"{A}/tile_path_dark.png")
report.append("[tile] path 변형 3종")
# 던전 벽 x2_bricks (48×16 유지) — 카타콤 벽돌 3칸
bricks = Image.open(RF_M).convert("RGBA").crop((272, 208, 320, 224)).resize((48, 16), Image.NEAREST)
save(bricks, f"{A}/x2_bricks.png"); report.append("[tile] x2_bricks <- catacomb bricks")

# ── 데코 ──
try:
    tree = Image.open(SER_PNG).convert("RGBA").crop((288, 432, 352, 528))
    tree = tree.resize((64, 96), Image.NEAREST)
    save(tree, f"{A}/tree.png"); report.append("[decor] tree <- serene 64x96")
except Exception as e:
    report.append(f"[decor][FAIL] tree: {e}")
try:
    pine = Image.open(SER_PNG).convert("RGBA").crop((416, 432, 480, 528))
    pine = pine.resize((64, 96), Image.NEAREST)
    save(pine, f"{A}/pine.png"); report.append("[decor] pine <- serene teal")
except Exception as e:
    report.append(f"[decor][FAIL] pine: {e}")
try:
    rock = Image.open(SER_PNG).convert("RGBA").crop((16, 480, 48, 512))
    rock = rock.resize((48, 48), Image.NEAREST)
    save(rock, f"{A}/rock.png"); report.append("[decor] rock <- serene")
except Exception as e:
    report.append(f"[decor][FAIL] rock: {e}")
# 집: 세렌 소형 집 (실측 bbox — 빨간(8,688)-(90,790), 초록(8,930)-(90,1032)) → 156×194
for out, box in {"house_a": (8, 688, 90, 790), "house_b": (8, 930, 90, 1032)}.items():
    try:
        h = Image.open(SER_PNG).convert("RGBA").crop(box)
        h = h.resize((156, 194), Image.NEAREST)
        save(h, f"{A}/{out}.png"); report.append(f"[decor] {out} <- serene house {box}")
    except Exception as e:
        report.append(f"[decor][FAIL] {out}: {e}")

# ────────────────────────── C. VFX 스트립 ──────────────────────────
def strip_from_frames(files, out, max_f=8, cell=None):
    ims = []
    for f in files[:max_f]:
        im = Image.open(f).convert("RGBA")
        if cell:
            im = im.resize(cell, Image.LANCZOS)
        ims.append(im)
    if not ims:
        return None
    fw, fh = ims[0].size
    sheet = Image.new("RGBA", (fw * len(ims), fh), (0, 0, 0, 0))
    for i, im in enumerate(ims):
        sheet.paste(im, (i * fw, 0), im)
    save(sheet, out)
    return (out, fw, fh, len(ims))

vfx_log = []
# Warped — Bolt/Charged 시퀀스
for fam, n in (("Bolt", 4), ("Charged", 6)):
    fs = sorted(glob.glob(f"{WF}/{fam}/*.png"), key=lambda p: int(re.search(r"(\d+)", os.path.basename(p)).group(1)))
    r = strip_from_frames(fs, f"{A}/vfx2_{fam.lower()}.png")
    if r:
        vfx_log.append(r); report.append(f"[vfx] {fam} {len(fs)}f -> {r[1]}x{r[2]} x{r[3]}")
# Warped Hits (히트 임팩트 4f × 3종) + Pulse + Spark
for hi in (1, 3, 5):
    fs = sorted(glob.glob(f"{WF}/Hits/Hit-{hi}/hits*.png"))
    r = strip_from_frames(fs, f"{A}/vfx2_hit{hi}.png", max_f=4, cell=(96, 96))
    if r:
        vfx_log.append(r); report.append(f"[vfx] Hit-{hi} -> vfx2_hit{hi} ({r[3]}f 96px)")
r = strip_from_frames(sorted(glob.glob(f"{WF}/Pulse/pulse*.png")), f"{A}/vfx2_pulse.png", cell=(64, 32))
if r:
    vfx_log.append(r); report.append("[vfx] Pulse -> vfx2_pulse")
r = strip_from_frames(sorted(glob.glob(f"{WF}/Spark/spark-preview*.png")), f"{A}/vfx2_wspark.png", cell=(64, 32))
if r:
    vfx_log.append(r); report.append("[vfx] Spark -> vfx2_wspark")
# CFX 그리드/수직 스트립 명시 픽
def grid_strip(path, cols, rows, fw, out, scale=128):
    im = Image.open(path).convert("RGBA")
    frames = []
    for rj in range(rows):
        for ci in range(cols):
            frames.append(im.crop((ci * fw, rj * fw, (ci + 1) * fw, (rj + 1) * fw)))
    frames = [f.resize((scale, scale), Image.LANCZOS) for f in frames]
    sheet = Image.new("RGBA", (scale * len(frames), scale), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f, (i * scale, 0), f)
    save(sheet, out)
    vfx_log.append((out, scale, scale, len(frames)))
    report.append(f"[vfx] {os.path.basename(path)} -> {os.path.basename(out)} ({len(frames)}f)")
try:
    grid_strip(f"{CF}/cfxr electric small anim 4x2.png", 4, 2, 64, f"{A}/vfx2_elec.png")
except Exception as e:
    report.append(f"[vfx][FAIL] elec: {e}")
try:
    im = Image.open(f"{CF}/cfxr hit triangle 2.png").convert("RGBA")  # 128x256 = 2f vertical
    a = im.crop((0, 0, 128, 128)).resize((128, 128), Image.LANCZOS)
    b = im.crop((0, 128, 128, 256)).resize((128, 128), Image.LANCZOS)
    sheet = Image.new("RGBA", (256, 128), (0, 0, 0, 0))
    sheet.paste(a, (0, 0), a); sheet.paste(b, (128, 0), b)
    save(sheet, f"{A}/vfx2_tri.png"); vfx_log.append((f"{A}/vfx2_tri.png", 128, 128, 2)); report.append("[vfx] hit triangle -> vfx2_tri (2f)")
except Exception as e:
    report.append(f"[vfx][FAIL] tri: {e}")
for src, out in (("cfxr explosion second color map.png", "vfx2_boom"), ("cfxr blood splash.png", "vfx2_blood")):
    try:
        im = Image.open(f"{CF}/{src}").convert("RGBA").resize((128, 128), Image.LANCZOS)
        save(im, f"{A}/{out}.png"); report.append(f"[vfx] {src} -> {out} (static)")
    except Exception as e:
        report.append(f"[vfx][FAIL] {out}: {e}")
# Warped 하위 폴더 전체 목록 (추가 후보 로그)
if os.path.isdir(WF):
    report.append("[vfx] warped folders: " + ", ".join(sorted(os.listdir(WF))))
# CartoonFX — flipbook 그리드 자동 감지 → 가로 스트립 변환 (선별)
CFX_PICK = ["aura rays", "aura runic", "blood splash", "impact", "explosion", "sparks", "energy"]
picked = 0
for p in sorted(glob.glob(f"{CF}/*.png")):
    base = os.path.basename(p).lower()
    if not any(k in base for k in CFX_PICK):
        continue
    try:
        im = Image.open(p).convert("RGBA")
    except Exception:
        continue
    W, H = im.size
    n = W // H if H and W % H == 0 else 0
    if not (2 <= n <= 12):
        continue
    if picked >= 6:
        break
    frames = [im.crop((i * H, 0, (i + 1) * H, H)).resize((128, 128), Image.LANCZOS) for i in range(n)]
    sheet = Image.new("RGBA", (128 * n, 128), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        sheet.paste(fr, (i * 128, 0), fr)
    key = "vfx2_cfx" + str(picked + 1)
    save(sheet, f"{A}/{key}.png")
    vfx_log.append((f"{A}/{key}.png", 128, 128, n))
    report.append(f"[vfx] {os.path.basename(p)} -> {key} ({n}f)")
    picked += 1

# ────────────────────────── 프리뷰 몽타주 ──────────────────────────
prev = Image.new("RGBA", (1280, 800), (18, 20, 28, 255))
from PIL import ImageDraw
dr = ImageDraw.Draw(prev)
xs, ys = 4, 4
tiles = ["tile_grass", "tile_path", "tile_dark", "tile_magma", "tile_snow", "tile_cave", "tile_stone", "tile_hel", "tile_abyss", "tile_magma_path", "tile_ice", "tile_path_dark", "x2_bricks", "tree", "pine", "rock", "house_a", "house_b"]
for k in tiles:
    im = Image.open(f"{A}/{k}.png").convert("RGBA")
    if im.width > 64:
        im = im.resize((64, int(im.height * 64 / im.width)), Image.NEAREST)
    if im.width < 64:
        im = im.resize((64, int(im.height * 64 / im.width)), Image.NEAREST)
    if ys + im.height > 260:
        ys = 4; xs += 80
    prev.paste(im, (xs, ys), im)
    dr.text((xs, ys + im.height + 1), k[:10], fill=(255, 255, 160, 255))
    xs += 80 if im.width <= 64 else 170
# 아이템 2행
xs, ys = 4, 300
for k in list(ITEMS.keys()):
    im = Image.open(f"{A}/{k}.png").convert("RGBA").resize((48, 48), Image.NEAREST)
    if xs > 1230:
        xs = 4; ys += 56
    prev.paste(im, (xs, ys), im)
    xs += 52
# 스킬 아이콘 3행
xs, ys = 4, 480
for f in sorted(glob.glob(f"{SK}/*.png")):
    im = Image.open(f).convert("RGBA").resize((48, 48), Image.NEAREST)
    if xs > 1230:
        xs = 4; ys += 56
    prev.paste(im, (xs, ys), im)
    xs += 52
prev.save("/home/z/my-project/upload/redesign_preview.png")

print("\n".join(report))
print("vfx sheets:", vfx_log)
print("PREVIEW: upload/redesign_preview.png")
