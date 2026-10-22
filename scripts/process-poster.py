"""Prepare one poster's web files in public/posters/<slug>/.
Run: python3 scripts/process-poster.py <slug> <final-print.jpg> <video> [--center 0.5]
Needs Pillow and ffmpeg. --center is where the subject sits across the video
frame (0 = left edge, 1 = right edge); the crop to the poster's shape centres there.
Then compile target.mind from poster.jpg (README: "Compile the target")."""
import argparse, json, os, subprocess
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("slug")
ap.add_argument("poster")
ap.add_argument("video")
ap.add_argument("--center", type=float, default=0.5)
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
