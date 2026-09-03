import json
data = json.load(open('/tmp/pieces.json'))
by = {t['title'].strip(): t for t in data}

PICKS = {
 "title":  ["Call to Adventure","At Launch","Noble Race","Majestic Hills","Overworld"],
 "village":["The Britons","Thatched Villagers","Village Consort","Midnight Tale","Folk Round"],
 "field":  ["Overworld","Crossing the Chasm","Fantasia Fantasia","Journey To Ascend","Darkling"],
 "alfheim":["Equatorial Complex","Dreamy Flashback","The Other Side of the Door","Magic Forest","Soaring"],
 "cave":   ["Chee Zee Caves V2","SCP-x5x (Outer Thoughts)","Night of Chaos","Scissors","Secrets of the Schoolyard"],
 "snow":   ["Frost Waltz","Frost Waltz (Alternate)","Ice Demon","Northern Glade","Night Vigil"],
 "abyss":  ["SCP-x1x (Gateway to Hell)","SCP-x2x (Unseen Presence)","River Fire","Shadowlands 3 - Machine","Welcome to HorrorLand"],
 "boss":   ["Clash Defiant","Curse of the Scarab","Volatile Reaction","Chase","Clenched Teeth"],
}
SPARES = ["Lord of the Land","Pippin the Hunchback","Enigma","Silver Flame","Send for the Horses","Blue Feather","Frost Waltz (Alternate)","Movement Proposition","Nerves","SCP-x4x (Mind Leech)","Classic Horror 3","Mighty and Meek"]

out={}
def find(title):
    t=by.get(title)
    if not t:
        # fuzzy
        cands=[k for k in by if title.lower() in k.lower()]
        if len(cands)==1: t=by[cands[0]]
    return t

allrecs={}
for theme, titles in PICKS.items():
    recs=[]
    for ti in titles:
        t=find(ti)
        if not t:
            print(f"!! MISSING: {theme} | {ti}")
            continue
        h,m,s=t['length'].split(':'); dur=int(h)*3600+int(m)*60+int(s)
        recs.append({"title":t['title'],"filename":t['filename'],"dur":dur,"feel":t.get('feel','')})
    out[theme]=recs
    print(f"== {theme} ({len(recs)}/5)")
    for r in recs: print(f"   {r['dur']//60}:{r['dur']%60:02d} | {r['title']} | {r['filename']}")
    allrecs[theme]=recs

print("\n== SPARES ==")
for ti in SPARES:
    t=find(ti)
    if t:
        h,m,s=t['length'].split(':'); dur=int(h)*3600+int(m)*60+int(s)
        print(f"   {dur//60}:{dur%60:02d} | {t['title']} | {t['filename']}")
    else:
        print(f"   !! MISSING: {ti}")

json.dump(out, open('/home/z/my-project/scripts/bgm_work/picks.json','w'), indent=1)
