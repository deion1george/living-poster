"""Prepare one poster's web files in public/posters/<slug>/.
Run: python3 scripts/process-poster.py <slug> <final-print.jpg> <video> --name "B-Boy London" [--center 0.5]
Needs Pillow and ffmpeg. --center is where the subject sits across the video
frame (0 = left edge, 1 = right edge); the crop to the poster's shape centres there.
Also writes download.mp4: the full, uncropped frame at higher quality with a
branded end card, which is what the Save video button gives viewers.
Then compile target.mind from poster.jpg (README: "Compile the target")."""
import argparse, json, os, subprocess
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument("slug")
ap.add_argument("poster")
ap.add_argument("video")
ap.add_argument("--name", required=True, help="name shown on the end card")
ap.add_argument("--center", type=float, default=0.5)
ap.add_argument("--event", default="Battle of the Boroughs")
ap.add_argument("--website", default="BattleBoroughs.com")
ap.add_argument("--card-seconds", type=float, default=3.5)
a = ap.parse_args()

out = f"public/posters/{a.slug}"
os.makedirs(out, exist_ok=True)

# Poster: ~1000 px wide is plenty for tracking and the on-screen reveal.
im = Image.open(a.poster).convert("RGB")
ratio = im.height / im.width
im.resize((1000, round(1000 * ratio)), Image.LANCZOS).save(f"{out}/poster.jpg", quality=90)

# Video: crop to the poster's aspect ratio (largest window that fits), then
# cap the height at 1080 and encode H.264/AAC with faststart for the web.
probe = json.loads(subprocess.check_output([
    "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
    "stream=width,height:stream_side_data=rotation", "-of", "json", a.video]))
s = probe["streams"][0]
w, h = s["width"], s["height"]
rot = abs(int(next((d.get("rotation", 0) for d in s.get("side_data_list", [])), 0)))
if rot in (90, 270):
    w, h = h, w
if w / h > 1 / ratio:  # video wider than poster: crop sides
    cw, ch = int(h / ratio) // 2 * 2, h // 2 * 2
else:                  # video taller: crop top and bottom (keep the top, where faces are)
    cw, ch = w // 2 * 2, int(w * ratio) // 2 * 2
x = min(max(0, round(a.center * w - cw / 2)), w - cw)
y = 0
scale = f",scale=-2:'min(1080,ih)'"
subprocess.run([
    "ffmpeg", "-y", "-loglevel", "error", "-i", a.video,
    "-map", "0:v:0", "-map", "0:a:0?",
    "-vf", f"crop={cw}:{ch}:{x}:{y}{scale},format=yuv420p",
    "-c:v", "libx264", "-profile:v", "main", "-preset", "slow", "-crf", "25",
    "-maxrate", "1500k", "-bufsize", "3000k",
    "-c:a", "aac", "-b:a", "96k", "-ac", "2", "-movflags", "+faststart",
    f"{out}/video.mp4"], check=True)
mb = os.path.getsize(f"{out}/video.mp4") / 1e6
print(f"{a.slug}: poster {im.width}x{im.height} -> 1000px, video crop {cw}x{ch}+{x} -> {mb:.1f} MB")


# ---------- Download copy: full frame, sharper, with an end card ----------
def font(size):
    for f in ["/System/Library/Fonts/Supplemental/Arial Bold.ttf",
              "/Library/Fonts/Arial Bold.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]:
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default(size)

ow, oh = min(w, 1920) // 2 * 2, 0
oh = round(h * ow / w) // 2 * 2
card = Image.new("RGB", (ow, oh), (11, 22, 48))
d = ImageDraw.Draw(card)
for yy in range(oh):  # subtle vertical gradient
    t = yy / oh
    d.line([(0, yy), (ow, yy)], fill=(int(11 + 10 * t), int(22 + 8 * t), int(48 + 12 * t)))
thumb = Image.open(a.poster).convert("RGB")
th = int(oh * 0.8)
thumb = thumb.resize((round(th / ratio), th), Image.LANCZOS)
landscape = ow > oh
if landscape:
    tx, ty = int(ow * 0.08), (oh - th) // 2
    card.paste(thumb, (tx, ty))
    x0 = tx + thumb.width + int(ow * 0.06)
    cy = oh // 2
    d.text((x0, cy - oh * 0.16), a.event.upper(), font=font(int(oh * 0.045)), fill=(247, 140, 30), anchor="lm")
    d.text((x0, cy - oh * 0.04), a.name, font=font(int(oh * 0.1)), fill="white", anchor="lm")
    d.text((x0, cy + oh * 0.12), a.website, font=font(int(oh * 0.065)), fill=(247, 140, 30), anchor="lm")
else:
    th = int(oh * 0.5)
    thumb = thumb.resize((round(th / ratio), th), Image.LANCZOS)
    card.paste(thumb, ((ow - thumb.width) // 2, int(oh * 0.1)))
    y0 = int(oh * 0.1) + th + int(oh * 0.06)
    d.text((ow / 2, y0), a.event.upper(), font=font(int(ow * 0.045)), fill=(247, 140, 30), anchor="mm")
    d.text((ow / 2, y0 + oh * 0.07), a.name, font=font(int(ow * 0.085)), fill="white", anchor="mm")
    d.text((ow / 2, y0 + oh * 0.15), a.website, font=font(int(ow * 0.065)), fill=(247, 140, 30), anchor="mm")
card_path = f"{out}/.endcard.png"
card.save(card_path)

has_audio = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries",
                            "stream=index", "-of", "csv=p=0", a.video],
                           capture_output=True, text=True).stdout.strip() != ""
cs = a.card_seconds
fc = (f"[0:v]scale={ow}:{oh},setsar=1,fps=30,format=yuv420p[v0];"
      f"[1:v]scale={ow}:{oh},setsar=1,fps=30,format=yuv420p,fade=in:0:15[v1];"
      + ("[0:a]aresample=48000,aformat=channel_layouts=stereo[a0];" if has_audio else
         f"anullsrc=r=48000:cl=stereo[a0n];[a0n][0:v]atrim=0:1[a0];")
      + f"anullsrc=r=48000:cl=stereo,atrim=0:{cs}[a1];"
      "[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]")
subprocess.run([
    "ffmpeg", "-y", "-loglevel", "error", "-i", a.video,
    "-loop", "1", "-t", str(cs), "-i", card_path,
    "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "20",
    "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart",
    f"{out}/download.mp4"], check=True)
os.remove(card_path)
print(f"{a.slug}: download copy {ow}x{oh} -> {os.path.getsize(f'{out}/download.mp4') / 1e6:.1f} MB")
