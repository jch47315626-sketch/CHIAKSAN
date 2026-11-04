"""흰 바탕 수묵화를 투명 배경 PNG로 바꾼다.
사용: python3 tools/ink2alpha.py 입력.png 출력.png [ink|figure] [최대변=1024] [바깥점 x,y;x,y (원본 좌표)]
- ink   : 먹이 진할수록 불투명 (풀, 안개처럼 비치는 그림)
- figure: 바깥 흰 바탕만 지우고 안쪽은 불투명하게 (인물, 날개처럼 속이 채워진 그림)"""
import sys
from PIL import Image, ImageDraw, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
mode = sys.argv[3] if len(sys.argv) > 3 else 'ink'
max_side = int(sys.argv[4]) if len(sys.argv) > 4 else 1024
gray = Image.open(src).convert('L')
orig_w = gray.size[0]
gray.thumbnail((max_side, max_side), Image.LANCZOS)
k = gray.size[0] / orig_w
# 활과 시위 사이처럼 그림 안에 갇힌 바탕도 지우고 싶을 때 쓰는 추가 시작점
extra = [tuple(int(float(c) * k) for c in pt.split(',')) for pt in sys.argv[5].split(';')] if len(sys.argv) > 5 else []
lo, hi = 40, 235
ink_alpha = gray.point(lambda v: 255 if v <= lo else 0 if v >= hi else int(255 * (hi - v) / (hi - lo)))

if mode == 'figure':
    # 가장자리에서 이어진 밝은 영역 = 바깥 바탕
    mask = gray.point(lambda v: 255 if v >= 232 else 0)
    w, h = mask.size
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (0, h // 2), (w - 1, h // 2)] + extra:
        if mask.getpixel(seed) == 255:
            ImageDraw.floodfill(mask, seed, 128)
    outside = mask.point(lambda v: 255 if v == 128 else 0).filter(ImageFilter.MaxFilter(3))
    inside = outside.point(lambda v: 255 - v).filter(ImageFilter.GaussianBlur(1.2))
    # 안쪽은 불투명, 가장자리는 먹 번짐을 살린다
    alpha = Image.composite(inside, ink_alpha, inside)
    # 밤 장면에 맞게 종이색을 살짝 어둡게
    tone = gray.point(lambda v: int(v * 0.82))
    out = Image.merge('RGBA', (tone, tone.point(lambda v: int(v * 0.97)), tone.point(lambda v: int(v * 0.9)), alpha))
else:
    ink = Image.new('L', gray.size, 14)
    out = Image.merge('RGBA', (ink, ink.point(lambda _: 12), ink.point(lambda _: 10), ink_alpha))
    alpha = ink_alpha

bbox = alpha.getbbox()
if bbox:
    out = out.crop(bbox)
out.save(dst)
print(dst, mode, out.size)
