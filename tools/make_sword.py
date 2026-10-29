
import numpy as np
from PIL import Image

im = Image.open("public/assets/x3_sword.webp").convert("RGBA")
a = np.array(im).astype(np.int16)
r, g, b, al = a[:,:,0], a[:,:,1], a[:,:,2], a[:,:,3]

# 아이콘에 섞인 어두운 그림자 덩어리 제거 — 칼날(밝은 회청색)·가드·손잡이(갈색)는 유지
dark = (r + g + b < 150) & (al > 0) & (al < 200)
a[dark] = 0
# 남은 반투명 어두운 픽셀도 정리
dark2 = (r + g + b < 120) & (al < 255)
a[dark2, 3] = np.minimum(a[dark2, 3], 90)

out = Image.fromarray(a.astype(np.uint8), "RGBA")
# 칼날 하이라이트 — 어두운 배경에서 실루엣이 읽히게 밝기 보정 (색조 유지)
o = np.array(out).astype(np.float32)
mask = o[:,:,3] > 40
lum = o[:,:,:3].mean(axis=2)
o[:,:,:3][mask] = np.clip(o[:,:,:3][mask] * 1.28 + 12, 0, 255)
res = Image.fromarray(o.astype(np.uint8), "RGBA")
res.save("public/assets/x3_sword.webp", "WEBP", quality=93, method=6)
ys, xs = np.nonzero(np.array(res)[:,:,3] > 40)
print(f"저장 {res.size}  불투명 {len(xs)}px  bbox x[{xs.min()},{xs.max()}]")
