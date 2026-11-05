import sys
from PIL import Image, ImageDraw, ImageFont

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')

# Zone of the faulty word "Tarasport" on the blue banner
X0, Y0, X1, Y1 = 206, 380, 1110, 479

# 1) Cover the word with the banner's blue (vertical gradient sampled at the banner edge)
cover = Image.new('RGB', (X1 - X0, Y1 - Y0))
top, bot = (4, 36, 134), (2, 24, 112)
d = ImageDraw.Draw(cover)
for y in range(Y1 - Y0):
    t = y / (Y1 - Y0 - 1)
    d.line([(0, y), (X1 - X0, y)], fill=tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
from PIL import ImageFilter
region = im.crop((X0, Y0, X1, Y1))
mask = Image.new('L', cover.size, 0)
mp = mask.load(); rp = region.load()
for y in range(cover.size[1]):
    for x in range(cover.size[0]):
        r, g, b = rp[x, y]
        yellow = r > 120 and b < 140
        navy = r + g + b < 75
        if yellow or navy: mp[x, y] = 255
mask = mask.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(1.5))
im.paste(cover, (X0, Y0), mask)
# stray top of the old "T" just left of the zone (above the yellow stripes)
ex = im.crop((186, 382, 212, 410)); ep = ex.load()
for y in range(ex.size[1]):
    for x in range(ex.size[0]):
        r, g, b = ep[x, y]
        if r > 120 and b < 140: ep[x, y] = (4, 34, 130)
im.paste(ex, (186, 382))

# 2) Draw "Transport" in heavy font, sheared to italic, yellow with blue outline
font = ImageFont.truetype('C:/Windows/Fonts/ariblk.ttf', 120)
text, stroke = 'Transport', 7
tmp = Image.new('RGBA', (1400, 260), (0, 0, 0, 0))
td = ImageDraw.Draw(tmp)
td.text((60, 40), text, font=font, fill=(255, 214, 0), stroke_width=stroke, stroke_fill=(6, 18, 92))
shear = 0.22
tmp = tmp.transform(tmp.size, Image.AFFINE, (1, shear, -shear * 130, 0, 1, 0), resample=Image.BICUBIC)
tmp = tmp.crop(tmp.getbbox())
W, H = 850, Y1 - Y0 - 8
sx, sy = W / tmp.width, H / tmp.height
tmp = tmp.resize((int(tmp.width * sx), int(tmp.height * sy)), Image.LANCZOS)
px = X0 + (X1 - X0 - tmp.width) // 2
py = Y0 + (Y1 - Y0 - tmp.height) // 2
im.paste(tmp, (px, py), tmp)

im.save(out, quality=92)
print('ok', out, tmp.size)
