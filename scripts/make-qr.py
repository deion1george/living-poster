"""Print-ready QR code for the poster (high error correction).
Run: pip install qrcode pillow && python3 scripts/make-qr.py https://SITE.netlify.app
Writes qr/qr.svg (vector, best for print) and qr/qr.png (2000 px)."""
import sys, os
import qrcode
import qrcode.image.svg

url = sys.argv[1]
os.makedirs("qr", exist_ok=True)
make = lambda **kw: qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, border=4, **kw)

q = make(box_size=10, image_factory=qrcode.image.svg.SvgPathFillImage)
q.add_data(url); q.make(fit=True)
q.make_image().save("qr/qr.svg")

q = make(box_size=1)
q.add_data(url); q.make(fit=True)
n = q.modules_count + 8
q = make(box_size=max(1, 2000 // n))
q.add_data(url); q.make(fit=True)
q.make_image(fill_color="black", back_color="white").save("qr/qr.png")
print(f"{url} -> qr/qr.svg, qr/qr.png ({q.modules_count} modules)")
