import colorsys, hashlib, json, os
import numpy as np
from PIL import Image

ROOT = "C:/coding/CERTZ"
os.chdir(ROOT)

for p in ["public/assets/house_a.png", "public/assets/house_b.png", "public/assets/house_a.webp", "public/assets/house_b.webp"]:
    im = Image.open(p)
    print(p, im.size, im.mode, "colors=", len(np.unique(np.asarray(im.convert("RGBA")).reshape(-1,4), axis=0)))

# obj_town_house_blue at base commit
import subprocess
out = subprocess.run(["git","show","d3233b4f:public/assets/objects/town/obj_town_house_blue.png"], capture_output=True)
open("_tmp_house_blue.png","wb").write(out.stdout)
im = Image.open("_tmp_house_blue.png").convert("RGBA")
a = np.asarray(im)
alpha = a[:,:,3]
print("house_blue size", im.size, "opaque ratio", float((alpha>0).mean()), "colors", len(np.unique(a.reshape(-1,4),axis=0)))
# top rows opaque ratio
h = a.shape[0]
for frac in (0.1,0.2,0.22,0.3,0.4,0.5):
    r = int(h*frac)
    print(f"  top {frac:.2f} rows opaque={float((alpha[:r]>0).mean()):.3f}")

# ground_meadow seam ratios as the test measures (claim 1.899 @256 -> 0.946 @128)
def seam(path):
    im = Image.open(path).convert("RGB")
    w,h = im.size; px = im.load()
    def d(p,q): return abs(p[0]-q[0])+abs(p[1]-q[1])+abs(p[2]-q[2])
    s=0;n=0
    for y in range(h):
        for x in range(w-1):
            v=d(px[x,y],px[x+1,y])
            if v: s+=v; n+=1
    inner=s/max(n,1)/3
    s2=0;n2=0
    for y in range(h):
        v=d(px[0,y],px[w-1,y])
        if v: s2+=v; n2+=1
    slr=s2/max(n2,1)/3
    s3=0;n3=0
    for x in range(w):
        v=d(px[x,0],px[x,h-1])
        if v: s3+=v; n3+=1
    stb=s3/max(n3,1)/3
    return slr/max(inner,0.01), stb/max(inner,0.01)

print()
print("seam 256:", [round(v,3) for v in seam("public/assets/ground/ground_meadow.png")])
im = Image.open("public/assets/ground/ground_meadow.png").convert("RGB")
im128 = im.resize((128,128), Image.NEAREST)
im128.save("_tmp_meadow128.png")
print("seam 128:", [round(v,3) for v in seam("_tmp_meadow128.png")])

print()
print("=== old (base) seam measurement formula on new tiles: would it fail? ===")
def old_seam(path):
    im = Image.open(path).convert("RGB")
    w,h=im.size; px=im.load()
    inner=sum(abs(px[x,y][0]-px[x+1,y][0])+abs(px[x,y][1]-px[x+1,y][1])+abs(px[x,y][2]-px[x+1,y][2]) for y in range(h) for x in range(w-1))/(3*h*(w-1))
    slr=sum(abs(px[0,y][i]-px[w-1,y][i]) for y in range(h) for i in range(3))/(3*h)
    stb=sum(abs(px[x,0][i]-px[x,h-1][i]) for x in range(w) for i in range(3))/(3*w)
    return slr/max(inner,0.01), stb/max(inner,0.01)

import glob
for p in sorted(glob.glob("public/assets/ground/ground_*.png")):
    o = old_seam(p); nw = seam(p)
    print(f"{os.path.basename(p):26} old=({o[0]:7.3f},{o[1]:7.3f})  new=({nw[0]:7.3f},{nw[1]:7.3f})")
