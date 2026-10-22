"""Print-ready QR codes (high error correction), one per poster slug.
Run: pip install qrcode pillow && python3 scripts/make-qr.py london choky ...
With no slugs, makes one for every poster in src/posters.js.
Writes qr/<slug>.svg (vector, best for print) and qr/<slug>.png (2000 px)."""
import os, re, sys
import qrcode
import qrcode.image.svg

src = open("src/posters.js").read()
site = re.search(r"SITE_URL = '([^']+)'", src).group(1)
slugs = sys.argv[1:] or re.findall(r"slug: '([^']+)'", src)
os.makedirs("qr", exist_ok=True)

def make(url, **kw):
    q = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, border=4, **kw)
    q.add_data(url)
    q.make(fit=True)
    return q

for slug in slugs:
    url = f"{site}/{slug}"
    make(url, box_size=10, image_factory=qrcode.image.svg.SvgPathFillImage).make_image().save(f"qr/{slug}.svg")
    n = make(url, box_size=1).modules_count + 8
    make(url, box_size=max(1, 2000 // n)).make_image(fill_color="black", back_color="white").save(f"qr/{slug}.png")
    print(f"{url} -> qr/{slug}.svg, qr/{slug}.png")
