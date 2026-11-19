"""Derive site assets from BRAND/LOGO POSTING PNG...png (RGBA, colourtype 6).
The file has 3,865,817 fully transparent pure-black pixels, so every resize is
done on premultiplied alpha (PIL 'RGBa') to avoid dark fringes.
Run: python -I scripts/prep-assets.py"""
from PIL import Image
import numpy as np
SRC = 'BRAND/LOGO POSTING PNG...png'
im = Image.open(SRC).convert('RGBA')
a = np.array(im)[..., 3]

def crop(box):
    return im.crop(box)

def resize(img, size):
    return img.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')

ys, xs = np.where(a > 8)
x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
pad = 24
word = crop((x0 - pad, y0 - pad, x1 + pad, y1 + pad))
w = 960
word = resize(word, (w, round(word.height * w / word.width)))
word.save('src/public/brand/logo.png', optimize=True)

# mark only: columns left of the gap before the "G" (alpha empty band)
cols = (a > 8).any(axis=0)
gap = next(x for x in range(780, 900) if not cols[x])
msk = a[:, :gap] > 8
my, mx = np.where(msk)
mx0, my0, mx1, my1 = mx.min(), my.min(), mx.max() + 1, my.max() + 1
side = max(mx1 - mx0, my1 - my0) + 2 * pad
cx, cy = (mx0 + mx1) // 2, (my0 + my1) // 2
sq = crop((cx - side // 2, cy - side // 2, cx - side // 2 + side, cy - side // 2 + side))
resize(sq, (192, 192)).save('src/public/brand/mark.png', optimize=True)

# favicon: trace the real 32x32 pixel grid into SVG rects (run-length per row)
g = np.array(resize(sq, (32, 32))).astype(int)
def q(v): return min(255, (v + 4) // 8 * 8)
rows = []
for y in range(32):
    x = 0
    while x < 32:
        r, gr, b, al = g[y, x]
        al = (al + 15) // 32 * 32 if al < 255 else 255
        if al < 32:
            x += 1; continue
        key = (q(r), q(gr), q(b), min(al, 255))
        s = x
        while x < 32:
            r2, g2, b2, a2 = g[y, x]
            a2 = (a2 + 15) // 32 * 32 if a2 < 255 else 255
            if a2 < 32 or (q(r2), q(g2), q(b2), min(a2, 255)) != key: break
            x += 1
        rows.append((s, y, x - s, key))
out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" shape-rendering="crispEdges">']
out.append('<!-- traced from the 32x32 premultiplied resample of the mark in BRAND/LOGO POSTING PNG...png -->')
for s, y, n, (r, gr, b, al) in rows:
    op = '' if al >= 255 else f' fill-opacity="{al/255:.2f}"'
    out.append(f'<rect x="{s}" y="{y}" width="{n}" height="1" fill="#{r:02x}{gr:02x}{b:02x}"{op}/>')
out.append('</svg>')
open('src/public/favicon.svg', 'w').write('\n'.join(out))
print('logo', word.size, 'mark gap col', gap, 'favicon rects', len(rows))
