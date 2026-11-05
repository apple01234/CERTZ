
import sys, os, json
sys.path.insert(0, "scripts")
import build_portraits as B

key = "scarlet"
dst = os.path.join(B.OUT_DIR, f"npc_{key}.png")
raw_dir = os.path.join(B.OUT_DIR, "_raw")
os.makedirs(raw_dir, exist_ok=True)
# 원본 보관 (기존 규격: source 경로가 _raw 를 가리킨다)
import shutil
shutil.copy("/root/.hermes/cache/scratch/portraits/scarlet_raw.png", os.path.join(raw_dir, f"npc_{key}_raw.png"))

spec = json.load(open("scripts/portrait_specs.json", encoding="utf-8"))
ch = {c["key"]: c for c in spec["characters"]}[key]

mp = os.path.join(B.OUT_DIR, "_map.json")
mapping = json.load(open(mp, encoding="utf-8"))
entry = {
    "src": f"/assets/npcportrait/npc_{key}.png",
    "source": f"/assets/npcportrait/_raw/npc_{key}_raw.png",
    "crop": B.face_crop_box(dst, B.SIZE),
    "sha256": B.sha256(dst),
    "generated": "higgsfield/soul_2",
}
for a in ch["mapped_as"]:
    mapping[a] = entry
json.dump(mapping, open(mp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("scarlet entry:", entry)
print("map entries:", len(mapping))
