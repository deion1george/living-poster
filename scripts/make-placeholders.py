"""Generate a detail-rich placeholder poster and a matching test clip.
Run: python3 scripts/make-placeholders.py  (needs Pillow + ffmpeg)"""
import random, subprocess, math
from PIL import Image, ImageDraw, ImageFont

W, H = 1000, 1414  # A-series portrait (1 : 1.414)
random.seed(7)
img = Image.new("RGB", (W, H), (245, 236, 220))
d = ImageDraw.Draw(img)
pal = [(20, 20, 24), (214, 40, 57), (247, 178, 37), (30, 110, 200), (40, 160, 90), (250, 250, 250)]
# Non-repeating shapes everywhere so there are features across the whole art.
for _ in range(900):
    x, y, r = random.randint(0, W), random.randint(0, H), random.randint(4, 60)
    c = random.choice(pal)
    k = random.random()
    if k < 0.35:
        d.ellipse([x - r, y - r, x + r, y + r], outline=c, width=random.randint(2, 6))
    elif k < 0.65:
        d.polygon([(x + r * math.cos(a), y + r * math.sin(a)) for a in
                   [random.uniform(0, 6.28) for _ in range(random.randint(3, 6))]], fill=c)
    else:
        d.line([x, y, x + random.randint(-90, 90), y + random.randint(-90, 90)], fill=c, width=random.randint(2, 7))
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 92)
small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 40)
d.rectangle([60, 520, W - 60, 860], fill=(20, 20, 24))
d.text((W / 2, 620), "BATTLE OF THE", font=small, fill=(247, 178, 37), anchor="mm")
d.text((W / 2, 720), "BOROUGHS", font=font, fill=(250, 250, 250), anchor="mm")
d.text((W / 2, 810), "PLACEHOLDER POSTER", font=small, fill=(214, 40, 57), anchor="mm")
img.save("public/media/poster.jpg", quality=92)

# 10s test clip, same aspect as the poster, with a tone so audio can be checked.
subprocess.run([
    "ffmpeg", "-y", "-loglevel", "error",
    "-f", "lavfi", "-i", "testsrc2=size=720x1018:rate=30:duration=10",
    "-f", "lavfi", "-i", "sine=frequency=440:beep_factor=4:duration=10",
    "-vf", "drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:"
           "text='TEST CLIP %{pts\\:hms}':fontsize=48:fontcolor=white:box=1:boxcolor=black@0.6:"
           "x=(w-tw)/2:y=h*0.8",
    "-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p", "-crf", "26",
    "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", "-shortest",
    "public/media/clip.mp4"], check=True)
