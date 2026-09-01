#!/usr/bin/env python3
# 아뜰란티스 게임 에셋 준비: 업로드 팩 → public/atlantis/img/
import os, math, random
from PIL import Image, ImageDraw
import numpy as np

AW = '/home/z/my-project/asset_work'
OUT = '/home/z/my-project/public/atlantis/img'
random.seed(30417)

def ensure(d):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)

for d in ['characters','mobs','bosses','tiles','props','icons']:
    ensure(d)

def P(*p): return os.path.join(AW, *p)

def load(*p): return Image.open(P(*p)).convert('RGBA')

def save(im, d, name):
    im.save(os.path.join(OUT, d, name))
    return name

# ---------- 1) 플레이어 ----------
pl = load('mystic_woods_free_2.2','sprites','characters','player.png')
save(pl, 'characters', 'player.png')

def recolor(im, hair=None, shirt=None, pants=None, alpha=255, crown=False):
    a = np.array(im).astype(np.float32)
    r,g,b,al = a[...,0],a[...,1],a[...,2],a[...,3]
    # 머리: 갈색 (r>g>b, r 80~150)
    hm = (r>70)&(r<170)&(g>45)&(g<130)&(b<110)&(r>g+15)&(g>b+5)
    # 셔츠: 파란 계열
    sm = (b>r+25)&(b>60)&(g<b)&(r<120)
    # 바지: 어두운 청색
    pm = (r<70)&(g<80)&(b>40)&(b<140)&(r<b)
    def apply(mask, col):
        for i,c in enumerate(col):
            if c is None: continue
            ch = a[...,i]
            ch[mask] = c
            a[...,i] = ch
    if hair: apply(hm, hair)
    if shirt: apply(sm, shirt)
    if pants: apply(pm, pants)
    a[...,3] = np.minimum(a[...,3], alpha)
    out = Image.fromarray(a.astype(np.uint8))
    if crown:  # 왕관 (idle 행 기준, 머리 위 y=14~20, x=16~32)
        d = ImageDraw.Draw(out)
        for fr in range(6):
            x0 = fr*48
            d.rectangle([x0+17,14,x0+31,15], fill=(255,215,60,255))
            for cx in (18,24,30): d.rectangle([x0+cx,11,x0+cx+1,14], fill=(255,215,60,255))
            d.rectangle([x0+20,16,x0+28,16], fill=(200,60,60,255))
    return out

npcs = {
 'npc_grandma': dict(hair=(190,190,195), shirt=(150,80,160)),
 'npc_king':    dict(hair=(120,90,60),  shirt=(200,40,50), crown=True),
 'npc_smith':   dict(hair=(160,60,40),  shirt=(120,80,50)),
 'npc_fairy':   dict(hair=(90,210,120), shirt=(170,240,180)),
 'npc_guard':   dict(hair=(60,55,70),   shirt=(170,175,190)),
 'npc_ghost':   dict(hair=(210,225,240),shirt=(150,200,220), alpha=200),
 'npc_mermaid': dict(hair=(40,190,180), shirt=(60,140,200)),
 'npc_sage':    dict(hair=(225,225,225),shirt=(90,70,110)),
}
for name,kw in npcs.items():
    save(recolor(pl, **kw), 'characters', name+'.png')

# 닭/소 (Sprout Lands)
save(load('Sprout Lands - Sprites - Basic pack','Sprout Lands - Sprites - Basic pack','Characters','Free Chicken Sprites.png'), 'characters','chicken.png')
save(load('Sprout Lands - Sprites - Basic pack','Sprout Lands - Sprites - Basic pack','Characters','Free Cow Sprites.png'), 'characters','cow.png')

# ---------- 2) 몬스터 (32rogues 32px 셀) ----------
mg = load('32rogues-0.5.0','32rogues','monsters.png')
def cell(x,y,w=32,h=32):
    return mg.crop((x*16, y*16, x*16+w, y*16+h))

def tint(im, mul=(1,1,1), lift=0, toward=None, t=0.0):
    a = np.array(im).astype(np.float32)
    for i in range(3):
        a[...,i] = np.clip(a[...,i]*mul[i]+lift, 0, 255)
    if toward is not None and t>0:
        for i in range(3):
            a[...,i] = a[...,i]*(1-t) + toward[i]*t
    return Image.fromarray(a.astype(np.uint8))

mobs = {
 'goblin':(0,0),'goblin_s':(4,0),'orc':(6,0),'imp_red':(12,0),'troll':(0,2),
 'golem':(4,4),'slime':(0,4),'skeleton':(0,8),'ranger':(2,8),'wizard':(4,8),
 'darkknight':(6,8),'zombie':(8,8),'werewolf':(10,8),'ghost':(0,10),'reaper':(2,10),
 'pmage':(4,10),'impstaff':(6,10),'demon':(8,10),'eyebat':(2,12),'spider_red':(8,12),
 'wolf_blue':(10,12),'bat':(12,12),'spider_s':(14,12),'treant':(0,14),'stag':(2,14),
 'mammoth':(4,14),'satyr':(6,14),'snakeblade':(8,14),'elk':(10,14),'aztec':(12,14),
 'pigorc':(14,14),'ostrich':(16,14),'medusa':(18,14),'croc':(0,16),'dragon_green':(4,16),
 'cobra':(8,16),'bear_brown':(0,18),'vulture':(0,20),'angel':(0,22),'demonbat':(2,22),
 'spider_demon':(4,24),'rat':(22,12),'bear_dark':(20,12),
}
for n,(x,y) in mobs.items():
    save(cell(x,y), 'mobs', n+'.png')

bosses = {
 'boss_nidhogg':   ('dragon_green', (0.75,1.25,0.7)),
 'boss_surtr':     ('golem',        (1.5,0.55,0.25)),
 'boss_fenrir':    ('werewolf',     None),  # toward white
 'boss_jormungand':('cobra',        (0.5,1.4,1.35)),
 'boss_ragnarok':  ('reaper',       (1.15,0.55,1.5)),
 'boss_trollking': ('troll',        (1.0,0.95,0.85)),
 'boss_elfwarden': ('angel',        (1.35,1.2,0.6)),
 'boss_flamelord': ('demon',        (1.6,0.7,0.3)),
 'boss_abyss':     ('darkknight',   (0.9,0.6,1.6)),
}
for n,(src,mul) in bosses.items():
    im = cell(*mobs[src])
    if src=='werewolf':
        im = tint(im, toward=(225,240,255), t=0.62)
    else:
        im = tint(im, mul=mul)
    save(im, 'bosses', n+'.png')

# ---------- 3) 타일 ----------
grass = load('mystic_woods_free_2.2','sprites','tilesets','grass.png')
water_sheet = load('mystic_woods_free_2.2','sprites','tilesets','water1.png')

def hueshift(im, deg=0, sat=1.0, val=1.0):
    a = np.array(im).astype(np.float32)/255.0
    r,g,b = a[...,0],a[...,1],a[...,2]
    mx = np.max(a[...,:3],axis=-1); mn = np.min(a[...,:3],axis=-1)
    c = mx-mn
    h = np.zeros_like(mx)
    m = c>1e-6
    idx = m&(mx==r); h[idx] = ((g-b)[idx]/c[idx]) % 6
    idx = m&(mx==g); h[idx] = ((b-r)[idx]/c[idx]) + 2
    idx = m&(mx==b); h[idx] = ((r-g)[idx]/c[idx]) + 4
    h = h*60
    h = (h+deg)%360
    s = np.where(mx>1e-6, c/(mx+1e-6), 0)*sat
    v = mx*val
    hh = (h/60).astype(int)%6
    f = h/60 - np.floor(h/60)
    p = v*(1-s); q = v*(1-f*s); t2 = v*(1-(1-f)*s)
    r2 = np.select([hh==0,hh==1,hh==2,hh==3,hh==4,hh==5],[v,q,p,p,t2,v])
    g2 = np.select([hh==0,hh==1,hh==2,hh==3,hh==4,hh==5],[t2,v,v,q,p,p])
    b2 = np.select([hh==0,hh==1,hh==2,hh==3,hh==4,hh==5],[p,p,t2,v,v,q])
    out = np.zeros_like(a)
    out[...,0],out[...,1],out[...,2],out[...,3] = r2,g2,b2,a[...,3]
    return Image.fromarray((out*255).astype(np.uint8))

grounds = {
 'midgard':   dict(deg=0,   sat=1.0,  val=1.0),
 'cusodia':   dict(deg=-8,  sat=1.12, val=0.97),
 'forest':    dict(deg=6,   sat=1.1,  val=0.9),
 'alfheim':   dict(deg=-18, sat=0.95, val=1.13),
 'jotunheim': dict(deg=-42, sat=0.9,  val=1.05),
 'jormungand':dict(deg=120, sat=0.7,  val=0.95),
 'nevada':    dict(deg=-72, sat=0.5,  val=1.02),
 'niflheim':  dict(deg=150, sat=0.08, val=1.22),
 'muspelheim':dict(deg=-88, sat=0.28, val=0.55),
 'asgard':    dict(deg=-55, sat=0.16, val=1.3),
 'svartalf':  dict(deg=180, sat=0.2,  val=0.5),
}
for n,kw in grounds.items():
    save(hueshift(grass, **kw), 'tiles', f'ground_{n}.png')

# 물 프레임 (행0 4프레임) + 틴트
water_frames = [water_sheet.crop((i*16,0,i*16+16,16)) for i in range(4)]
waters = {
 'midgard':(0,1,1),'cusodia':(-6,1.05,0.95),'forest':(30,0.9,0.9),
 'alfheim':(-20,0.9,1.1),'jotunheim':(-10,1,1),'jormungand':(10,1.15,0.9),
 'nevada':(0,1,1),'niflheim':(140,0.25,1.25),'muspelheim':(0,1,1),
 'asgard':(-25,0.6,1.2),'svartalf':(200,0.3,0.6),
}
for n,(deg,sat,val) in waters.items():
    if n=='muspelheim':  # 용암
        fr = [hueshift(w, 160, 1.4, 1.05) for w in water_frames]
    else:
        fr = [hueshift(w, deg, sat, val) for w in water_frames]
    sheet = Image.new('RGBA',(64,16),(0,0,0,0))
    for i,f in enumerate(fr): sheet.paste(f,(i*16,0))
    save(sheet, 'tiles', f'water_{n}.png')

# 길/테두리 타일 (PIL 생성)
def speckle(base, dot, density=0.08, seed=1):
    rng = random.Random(seed)
    im = base.copy(); d = ImageDraw.Draw(im)
    for y in range(16):
        for x in range(16):
            if rng.random()<density:
                d.point((x,y), fill=dot)
    return im

paths = {
 'midgard':((196,166,120),(168,138,96)), 'cusodia':((190,158,112),(162,132,90)),
 'forest':((160,132,96),(134,108,76)), 'alfheim':((205,182,132),(178,156,108)),
 'jotunheim':((198,172,110),(170,146,88)), 'jormungand':((176,158,128),(150,132,104)),
 'nevada':((214,178,122),(186,152,98)), 'niflheim':((205,215,228),(178,190,206)),
 'muspelheim':((110,84,74),(88,66,58)), 'asgard':((225,220,208),(198,192,180)),
 'svartalf':((96,88,104),(78,70,84)),
}
for n,(base,dot) in paths.items():
    im = Image.new('RGBA',(16,16),base+(255,))
    save(speckle(im, dot+(255,), seed=hash(n)%997), 'tiles', f'path_{n}.png')

rims = {
 'midgard':(96,128,72),'cusodia':(88,118,66),'forest':(70,100,60),'alfheim':(120,150,84),
 'jotunheim':(140,124,72),'jormungand':(60,110,100),'nevada':(150,116,74),
 'niflheim':(160,178,196),'muspelheim':(52,40,38),'asgard':(150,146,138),'svartalf':(40,36,50),
}
for n,c in rims.items():
    im = Image.new('RGBA',(16,16),c+(255,))
    d = ImageDraw.Draw(im)
    rng = random.Random(7)
    for i in range(14):
        x,y = rng.randint(0,15), rng.randint(0,15)
        d.point((x,y), fill=tuple(max(0,v-18) for v in c)+(255,))
    save(im, 'tiles', f'rim_{n}.png')

# 던전 타일 (Pixel Dungeon)
dt = load('2D Pixel Dungeon Asset Pack v2.0','2D Pixel Dungeon Asset Pack','character and tileset','Dungeon_Tileset.png')
save(dt.crop((0,96,16,112)), 'tiles','dun_floor.png')
save(dt.crop((16,96,32,112)), 'tiles','dun_floor2.png')
save(dt.crop((0,16,16,32)), 'tiles','dun_wall.png')
save(dt.crop((0,0,16,16)), 'tiles','dun_wallcap.png')
save(dt.crop((0,144,16,160)), 'tiles','torch_a.png')
save(dt.crop((16,144,32,160)), 'tiles','torch_b.png')
save(dt.crop((112,112,128,128)), 'icons','potion.png')
save(dt.crop((128,112,144,128)), 'icons','potion_big.png')
save(dt.crop((64,120,80,136)), 'props','barrel.png')

# ---------- 4) 프로프 ----------
# 상자 (MW chest_01: 4프레임)
chest = load('mystic_woods_free_2.2','sprites','objects','chest_01.png')
save(chest, 'props','chest.png')

# 모닥불 (Serene 4프레임)
save(load('Serene_Village_revamped_v1.9','SERENE_VILLAGE_REVAMPED','Animated stuff','campfire_16x16.png'), 'props','campfire.png')

# 장식 (MW decor / Sprout biome / lillies) 원본 시트 그대로 사용
save(load('mystic_woods_free_2.2','sprites','tilesets','decor_16x16.png'), 'props','decor.png')
save(load('Sprout Lands - Sprites - Basic pack','Sprout Lands - Sprites - Basic pack','Objects','Basic_Grass_Biom_things.png'), 'props','biome.png')
save(load('mystic_woods_free_2.2','sprites','tilesets','water_lillies.png'), 'props','lillies.png')

# 나무 (ForgottenMemories, 자동 컴포넌트)
from collections import deque
def components(im, min_w=20, min_h=20, pad=0):
    a = np.array(im)[:,:,3] > 8
    H,W = a.shape
    seen = np.zeros_like(a, dtype=bool)
    out=[]
    for sy in range(H):
        for sx in range(W):
            if a[sy,sx] and not seen[sy,sx]:
                q=deque([(sy,sx)]); seen[sy,sx]=True
                x0,x1,y0,y1 = sx,sx,sy,sy
                while q:
                    y,x = q.popleft()
                    x0=min(x0,x);x1=max(x1,x);y0=min(y0,y);y1=max(y1,y)
                    for dy,dx in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)):
                        ny,nx=y+dy,x+dx
                        if 0<=ny<H and 0<=nx<W and a[ny,nx] and not seen[ny,nx]:
                            seen[ny,nx]=True; q.append((ny,nx))
                if x1-x0>=min_w and y1-y0>=min_h:
                    out.append((x0,y0,x1+1,y1+1))
    return out

trees_src = load('ForgottenMemories','Trees_seperated.png')
comps = components(trees_src, min_w=24, min_h=24)
# 위쪽 절반(첫 6개: 단풍, 청록, 금색, 소나무, 버드나무 big, 그루터기)
comps = sorted(comps, key=lambda b:(b[1]//60, b[0]))
names = ['tree_maple','tree_teal','tree_gold','tree_pine','willow','stump_willow','tree_maple2','tree_teal2','tree_gold2','tree_pine2','willow2','stump_willow2','shadow1','shadow2','shadow3','shadow4','shadowbig']
saved_trees=[]
for i,b in enumerate(comps[:len(names)]):
    nm = names[i]
    if 'shadow' in nm: continue
    crop = trees_src.crop(b)
    save(crop, 'props', nm+'.png')
    saved_trees.append(nm)

# Serene Village 프롭 자동 추출 (집/나무/바위/울타리)
serene = load('Serene_Village_revamped_v1.9','SERENE_VILLAGE_REVAMPED','Serene_Village_16x16.png')
scomps = components(serene, min_w=28, min_h=28)
scomps = sorted(scomps, key=lambda b:(b[1], b[0]))
idx=0
house_i=0; tree_i=0; rock_i=0
for b in scomps:
    w,h = b[2]-b[0], b[3]-b[1]
    crop = serene.crop(b)
    if w>=80 and h>=64:
        save(crop,'props',f'house_{house_i}.png'); house_i+=1
    elif w>=36 and h>=40 and b[1]>260 and b[1]<600:
        save(crop,'props',f'stree_{tree_i}.png'); tree_i+=1
    elif 28<=w<60 and h>=28:
        if rock_i<10:
            save(crop,'props',f'rock_{rock_i}.png'); rock_i+=1

# 저주 땅 오브젝트 (개별 파일)
cl = 'Free-Cursed-Land-Top-Down-Pixel-Art-Tileset'
for src,dst in [('Objects_separetely/Bones_shadow1_1.png','cursed_bones'),
                ('Objects_separetely/Meat_flower_shadow1_2.png','cursed_meatflower'),
                ('Objects_separetely/Rock_eyes_shadow1_1.png','cursed_rockeye'),
                ('Objects_separetely/Ruins_shadow1_5.png','cursed_ruins'),
                ('Objects_separetely/Spike_plant_shadow1_2.png','cursed_spike'),
                ('Objects_separetely/Fetus_shadow1_2.png','cursed_fetus'),
                ('Objects_separetely/Rock3_shadow1_6.png','cursed_rock')]:
    save(load(cl,'PNG',*src.split('/')), 'props', dst+'.png')

# 유적 (EPIC)
ep = 'EPIC RPG World Pack - [FREE Demo]Ancient Ruins/EPIC RPG World Pack - [FREE Demo]Ancient Ruins - Copia'
altar = load(*ep.split('/')+[ 'Props','altar 224x288 - standard.png'])
altar = altar.resize((altar.width//2, altar.height//2), Image.NEAREST)
save(altar,'props','altar.png')
fount = load(*ep.split('/')+['Props','shrine or fountain 160x128-on grass.png'])
fount = fount.resize((fount.width//2, fount.height//2), Image.NEAREST)
save(fount,'props','fountain.png')
chal = load(*ep.split('/')+['Props','golden chalice 64x64-spirits.png'])
save(chal,'props','chalice.png')

# 항아리 (자동: 왼쪽 열 3개 온전한 항아리 + 파편)
pots_src = load('Assets2','Assets2','20.05b - Breakable Pots 1.1a','breakable pots (gray).png')
pcomps = components(pots_src, min_w=8, min_h=8)
pcomps = sorted(pcomps, key=lambda b:(b[0], b[1]))
pi=0
for b in pcomps:
    w,h=b[2]-b[0],b[3]-b[1]
    if pi<3 and w<=20 and h>=18:
        save(pots_src.crop(b),'props',f'pot{pi}.png'); pi+=1
    elif pi>=3 and pi<6 and w>=10 and h>=8:
        save(pots_src.crop(b),'props',f'shard{pi-3}.png'); pi+=1

# 포탈 (8프레임 → 96x56 축소 시트)
portal = load('Resurrected RPG 1.1','portal-Sheet.png')
sheet = Image.new('RGBA',(8*96,56),(0,0,0,0))
for i in range(8):
    fr = portal.crop((i*192,0,(i+1)*192,112)).resize((96,56), Image.LANCZOS)
    sheet.paste(fr,(i*96,0))
save(sheet,'props','portal.png')

# ---------- 5) 커스텀 아이콘 ----------
def px16(draw_fn, size=16):
    im = Image.new('RGBA',(size,size),(0,0,0,0))
    d = ImageDraw.Draw(im)
    draw_fn(d)
    return im

# 성물 7종
def relic_sword(d):
    d.polygon([(8,1),(10,3),(10,9),(9,11),(7,11),(6,9),(6,3)],fill=(120,220,140,255))
    d.polygon([(8,1),(10,3),(8,5),(6,3)],fill=(180,255,190,255))
    d.rectangle([5,11,11,12],fill=(210,170,60,255)); d.rectangle([7,12,9,14],fill=(150,110,40,255))
def relic_trident(d):
    d.rectangle([7,6,9,15],fill=(90,60,50,255))
    d.polygon([(4,2),(6,2),(6,6),(4,6)],fill=(220,50,50,255))
    d.polygon([(10,2),(12,2),(12,6),(10,6)],fill=(220,50,50,255))
    d.rectangle([7,1,9,6],fill=(240,80,60,255))
    d.rectangle([5,5,11,7],fill=(220,50,50,255))
    d.rectangle([6,3,10,4],fill=(255,120,100,255))
def relic_ring(d):
    d.ellipse([4,5,12,13],outline=(200,210,225,255),width=2)
    d.polygon([(7,3),(9,3),(10,5),(6,5)],fill=(160,210,255,255))
    d.point((8,2),fill=(220,240,255,255))
def relic_necklace(d):
    d.arc([4,2,12,10],200,340,fill=(220,180,70,255),width=2)
    d.ellipse([6,9,10,13],fill=(230,190,80,255))
    d.ellipse([7,10,9,12],fill=(120,200,230,255))
def relic_shield(d):
    d.polygon([(3,2),(13,2),(13,8),(8,15),(3,8)],fill=(225,150,70,255))
    d.polygon([(4,3),(12,3),(12,7),(8,12),(4,7)],fill=(245,190,110,255))
    d.polygon([(6,4),(10,4),(10,7),(8,9),(6,7)],fill=(150,90,40,255))
    d.point((6,4),fill=(90,50,20,255)); d.point((10,4),fill=(90,50,20,255))
def relic_staff(d):
    d.line([(4,14),(10,4)],fill=(120,90,40,255),width=2)
    d.ellipse([9,1,14,6],fill=(200,160,40,255))
    d.ellipse([10,2,13,5],fill=(255,80,60,255))
def relic_bow(d):
    d.arc([3,2,11,14],-70,70,fill=(140,220,255,255),width=2)
    d.line([(7,2),(7,14)],fill=(230,245,255,255))
    d.polygon([(7,8),(13,8),(13,7),(15,8),(13,9),(7,9)],fill=(180,235,255,255))
relics = {'sword':relic_sword,'trident':relic_trident,'ring':relic_ring,
          'necklace':relic_necklace,'shield':relic_shield,'staff':relic_staff,'bow':relic_bow}
for n,f in relics.items():
    save(px16(f),'icons',f'relic_{n}.png')

# 보석 7종 (12x12 다이아)
gem_colors = {'forest':(60,200,90),'flame':(255,90,40),'frost':(120,210,255),
              'light':(255,230,110),'dark':(150,80,220),'wave':(50,120,255),'earth':(150,110,60)}
for n,c in gem_colors.items():
    def f(d,c=c):
        d.polygon([(6,0),(11,5),(6,11),(1,5)],fill=c+(255,))
        d.polygon([(6,0),(11,5),(6,5)],fill=tuple(min(255,v+70) for v in c)+(255,))
        d.polygon([(6,5),(6,11),(1,5)],fill=tuple(max(0,v-50) for v in c)+(255,))
    save(px16(f,12),'icons',f'gem_{n}.png')

# 룬석 (3색)
for n,c in [('b',(80,150,255)),('g',(90,220,120)),('r',(255,90,90))]:
    def f(d,c=c):
        d.polygon([(3,15),(3,6),(8,1),(13,6),(13,15)],fill=(120,120,135,255))
        d.polygon([(4,14),(4,7),(8,3),(12,7),(12,14)],fill=(150,150,165,255))
        d.line([(8,5),(8,11)],fill=c+(255,),width=2); d.line([(5,8),(11,8)],fill=c+(255,),width=2)
    save(px16(f),'icons',f'rune_{n}.png')

# 속성 게이트 16x32
gates = {'fire':((255,120,30),(255,220,80)),'ice':((120,200,255),(220,245,255)),
         'dark':((140,60,200),(210,140,255)),'earth':((130,90,50),(190,150,90))}
for n,(c1,c2) in gates.items():
    im = Image.new('RGBA',(16,32),(0,0,0,0)); d=ImageDraw.Draw(im)
    for y in range(32):
        if y%4<2:
            d.rectangle([0,y,16,y+1],fill=c1+(235,))
            for x in range(2,16,5): d.point((x+(y//4)%2,y),fill=c2+(255,))
    save(im,'icons',f'gate_{n}.png')

# 열쇠 / 느낌표
def keyicon(d):
    d.ellipse([2,2,8,8],outline=(240,200,60,255),width=2)
    d.line([(8,8),(14,14)],fill=(240,200,60,255),width=2)
    d.line([(11,11),(13,9)],fill=(240,200,60,255),width=2)
    d.line([(13,13),(15,11)],fill=(240,200,60,255),width=2)
save(px16(keyicon),'icons','key.png')
def exclaim(d):
    d.rectangle([0,0,15,15],fill=(255,255,255,235))
    d.rectangle([6,2,9,9],fill=(220,60,50,255))
    d.rectangle([6,11,9,13],fill=(220,60,50,255))
save(px16(exclaim),'icons','exclaim.png')
def qmark(d):
    d.rectangle([0,0,15,15],fill=(60,50,90,235))
    d.text((5,2),'?',fill=(255,230,120,255))
save(px16(qmark),'icons','qmark.png')

print("prep complete")

# ---------- 6) 검증 몽타주 ----------
import glob
files = sorted(glob.glob(os.path.join(OUT,'**','*.png'), recursive=True))
cols = 10; cell_s = 52
rows = (len(files)+cols-1)//cols
m = Image.new('RGBA',(cols*cell_s, rows*cell_s+16),(24,24,34,255))
dd = ImageDraw.Draw(m)
for i,f in enumerate(files):
    im = Image.open(f).convert('RGBA')
    s = min((cell_s-6)/im.width,(cell_s-6)/im.height,2.0)
    im2 = im.resize((max(1,int(im.width*s)),max(1,int(im.height*s))), Image.NEAREST)
    x,y = (i%cols)*cell_s, (i//cols)*cell_s+16
    m.paste(im2,(x+2,y+2),im2)
    dd.text((x+2,y-11), os.path.basename(f)[:8], fill=(255,255,120,255))
m.save('/tmp/atlantis_assets_montage.png')
print("montage saved:", len(files), "files")

