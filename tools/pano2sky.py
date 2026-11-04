"""산수화 파노라마를 하늘 돔(정방형 2:1) 그림으로 바꾼다.
- 좌우 끝을 서로 이어지게 섞고(360도 둘러볼 때 이음새 없게)
- 그림을 지평선 위 띠에 놓고, 위쪽은 그림 꼭대기 색에서 밤하늘로, 아래쪽은 짙은 땅으로 이어 칠한다.
사용: python3 tools/pano2sky.py 입력.png public/art/sky_pano.png"""
import sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
W, H = 2048, 1024
TOP, BOTTOM = int(H * 0.16), int(H * 0.56)  # 그림이 들어갈 세로 범위 (지평선 0.5H)

im = Image.open(src).convert('L')
band_h = BOTTOM - TOP
im = im.resize((W, band_h), Image.LANCZOS)
im = im.point(lambda v: int(v * 0.62))  # 밤 톤

# 좌우 이음새: 오른쪽 끝 구간을 왼쪽 끝과 섞는다
blend = int(W * 0.08)
px = im.load()
for x in range(blend):
    t = x / blend
    for y in range(band_h):
        left = px[x, y]
        right = px[W - blend + x, y]
        px[W - blend + x, y] = int(right * (1 - t) + left * t)

out = Image.new('L', (W, H))
op = out.load()
top_row = [px[x, 0] for x in range(W)]
bot_row = [px[x, band_h - 1] for x in range(W)]
night, ground = 14, 12
for y in range(TOP):
    k = (y / TOP) ** 1.6
    for x in range(W):
        op[x, y] = int(night * (1 - k) + top_row[x] * k)
out.paste(im, (0, TOP))
for y in range(BOTTOM, H):
    k = min(1, (y - BOTTOM) / (H * 0.06))
    for x in range(W):
        op[x, y] = int(bot_row[x] * (1 - k) + ground * k)

rgb = Image.merge('RGB', (out, out.point(lambda v: int(v * 0.95)), out.point(lambda v: int(v * 0.86))))
rgb.save(dst)
print(dst, rgb.size)
