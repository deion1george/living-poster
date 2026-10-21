# Living Poster

Web AR for the Battle of the Boroughs poster featuring B-Boy London. Scan the QR code, tap
to start, point the phone at the poster, and the artwork turns into a video locked to the print.
No app install.

Built with [MindAR](https://github.com/hiukim/mind-ar-js) 1.2.5 (image tracking),
three.js 0.186.1 and Vite 8.3.5, all pinned.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
```

Desktop test: open the page on a laptop, then point the webcam at `public/media/poster.jpg`
shown on a phone or second screen. `localhost` counts as secure, so the camera works.
Phones need https, so test those on the Netlify deploy.

Tracking smoothing can be tuned live without rebuilding, e.g.
`?minCF=0.0001&beta=10&miss=8&warmup=3`. Lower `minCF`/`beta` = steadier but laggier.
Put the values you like into `src/config.js`.

## Swap in the real poster and video

1. **Poster art** → `public/media/poster.jpg`. Use the exact final print artwork, cropped to the
   tracked area only (no QR margin). About 1000–1500 px on the long side is plenty.
2. **Compile the target**: with `npm run dev` running, open
   http://localhost:5173/tools/compile.html, pick the same image, and save the downloaded
   `targets.mind` into `public/`. (MindAR's online compiler works too.)
3. **Video** → `public/media/clip.mp4`, cropped to the poster's aspect ratio, ~720 px wide,
   10 MB or less:

   ```sh
   # Example for an A-series portrait poster (1:1.414). Adjust crop to frame London's face.
   ffmpeg -i source.mov -vf "crop=ih/1.414:ih,scale=720:-2" \
     -c:v libx264 -profile:v main -pix_fmt yuv420p -crf 26 -preset slow \
     -c:a aac -b:a 128k -movflags +faststart public/media/clip.mp4
   ```

4. Paths and timings live in `src/config.js`.

`scripts/make-placeholders.py` regenerates the placeholder poster and test clip.

## How it works

- `src/main.js` handles the start screen, the audio unlock (the video is played inside the
  tap so iOS allows sound later), error screens, the scan hint, mute, and pause on target
  lost / resume on target found. The first time the poster is found, the artwork lifts and
  dissolves into the video.
- `src/ar.js` drives MindAR's `Controller` directly with modern three.js. MindAR's bundled
  three.js helper uses `sRGBEncoding`, which three.js removed in r162.
- `.npmrc` sets `ignore-scripts=true` because mind-ar depends on the native `canvas` package
  (only used by its Node compiler), which fails to build on many machines.

## Deploy (Netlify)

`netlify.toml` builds with `npm run build` and publishes `dist`. Headers are in
`public/_headers`, so they also apply to a drag-and-drop deploy of `dist`.

## Poster tips

- Fine detail and contrast across the whole art; avoid big blank areas and repeating patterns.
- QR code goes in a margin outside the tracked art.
- Matte paper tracks better than gloss.
