from PIL import Image
import os
os.makedirs('tmp_design', exist_ok=True)

def preview(src, out, scale=3):
    im = Image.open(src).convert('RGBA')
    bg = Image.new('RGBA', im.size, (40, 44, 52, 255))
    bg.alpha_composite(im)
    w, h = bg.size
    bg = bg.resize((w*scale, h*scale), Image.NEAREST)
    bg.convert('RGB').save(out)
    print(out, bg.size)

base = 'upload/extracted/'
preview(base+'mystic_woods_free_2.2/sprites/characters/player.png', 'tmp_design/prev_mw_player.png', 2)
preview(base+'mystic_woods_free_2.2/sprites/characters/skeleton.png', 'tmp_design/prev_mw_skel.png', 2)
preview(base+'mystic_woods_free_2.2/sprites/characters/slime.png', 'tmp_design/prev_mw_slime.png', 2)
preview(base+'32rogues-0.5.0/32rogues/rogues.png', 'tmp_design/prev_32r_rogues.png', 3)
preview(base+'32rogues-0.5.0/32rogues/monsters.png', 'tmp_design/prev_32r_monsters.png', 2)
preview(base+'32rogues-0.5.0/32rogues/animals.png', 'tmp_design/prev_32r_animals.png', 2)
preview(base+'Assets2/Assets2/Enemy_Animations_Set/Enemy_Animations_Set/enemies-skeleton1_idle.png', 'tmp_design/prev_eas_skel1.png', 4)
preview(base+'2D Pixel Dungeon Asset Pack v2.0/2D Pixel Dungeon Asset Pack/Dungeon_Character_at.png', 'tmp_design/prev_2d_char.png', 1)
