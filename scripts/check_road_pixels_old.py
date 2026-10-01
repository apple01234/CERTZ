"""v2.6 도로 베이스 렌더 검증 — 스크린샷 픽셀 샘플링"""
from PIL import Image

img = Image.open("/tmp/sertz_kingdom.png").convert("RGB")
# 화면 1280x720. 도로 띠는 화면 중앙(y≈290~450 근처). 카메라가 플레이어(≈225,365)를 따라감.
# 샘플: 도로 띠 내부 "초록 보이는" 지점 vs 띠 밖 순수 초록 지점
samples_inside = [(500, 300), (700, 420), (900, 320), (300, 430), (1000, 300)]
samples_outside = [(500, 550), (700, 560), (900, 100), (300, 100), (1000, 560)]
print("=== 구버전 도로 띠 내부 ===")
for x, y in samples_inside:
    print(f"({x},{y}) = {img.getpixel((x, y))}")
print("=== 구버전 도로 띠 외부 ===")
for x, y in samples_outside:
    print(f"({x},{y}) = {img.getpixel((x, y))}")
