import json, re
data = json.load(open('/tmp/pieces.json'))

THEMES = {
 "title":  ["epic","heroic","adventure","fanfare","grand","triumphant","majestic","orchestral"],
 "village":["tavern","village","folk","pastoral","cheerful","ren faire","medieval","lute","whistle","jig","merry"],
 "field":  ["adventure","march","journey","exploration","overworld","plains","upbeat","driving","quest","travel"],
 "alfheim":["fairy","mystical","ethereal","elf","magic","dreamy","whimsical","angelic","celestial","enchanted","spritely"],
 "cave":   ["dungeon","cave","dark ambient","underground","mine","dwarven","mysterious","puzzle","creep"],
 "snow":   ["snow","ice","winter","frozen","cold","glacial","northern","arctic","sleigh"],
 "abyss":  ["hell","demon","evil","sinister","horror","ominous","menacing","dread","fire","villain","grave","doom"],
 "boss":   ["boss","battle","intense","action","combat","dramatic","urgent","war","fight","chase","tension"],
}
EXCLUDE = ["comedy","quirky","silly","cartoon","goofy","bouncy",".children","lullaby"]

def blob(t):
    return " ".join([t.get("title",""),t.get("description",""),t.get("feel",""),t.get("instruments","")]).lower()

scored = {}
for theme,kws in THEMES.items():
    rows=[]
    for t in data:
        b = blob(t)
        s = sum(b.count(k) for k in kws)
        if s == 0: continue
        title_l = t.get("title","").lower()
        if any(x in b for x in ["comedy","quirky","silly","cartoon","goofy","lullaby"]): s -= 2
        # length parse "00:05:07"
        try:
            h,m,sec = t.get("length","0:0:0").split(":")
            dur = int(h)*3600+int(m)*60+int(sec)
        except: dur = 0
        if dur < 75: s -= 1  # too short for BGM rotation
        rows.append((s, dur, t["title"], t.get("feel",""), t.get("description","")[:80]))
    rows.sort(key=lambda r:-r[0])
    scored[theme]=rows

for theme in THEMES:
    print(f"\n=== {theme} ({len(scored[theme])} candidates) ===")
    for s,dur,title,feel,desc in scored[theme][:14]:
        print(f"  [{s:2d}] {dur//60}:{dur%60:02d} | {title} | {feel[:50]} | {desc}")
