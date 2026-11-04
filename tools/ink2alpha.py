"""흰 바탕 수묵화를 투명 배경 PNG로 바꾼다: 먹이 진할수록 불투명.
사용: python3 tools/ink2alpha.py 입력.png public/art/이름.png [최대변 픽셀=1024]"""
import sys
from PIL import Image, ImageOps

src, dst = sys.argv[1], sys.argv[2]
max_side = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
im = Image.open(src).convert('L')
im.thumbnail((max_side, max_side), Image.LANCZOS)
# 종이색(밝은 회색 포함)은 완전히 투명, 먹은 진하기에 따라 불투명
lo, hi = 40, 235
alpha = im.point(lambda v: 255 if v <= lo else 0 if v >= hi else int(255 * (hi - v) / (hi - lo)))
ink = Image.new('L', im.size, 14)
out = Image.merge('RGBA', (ink, ink.point(lambda _: 12), ink.point(lambda _: 10), alpha))
# 가장자리 여백 잘라내기
bbox = alpha.getbbox()
if bbox: out = out.crop(bbox)
out.save(dst)
print(dst, out.size)
