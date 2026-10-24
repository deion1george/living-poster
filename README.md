# Living Poster

Web AR for the Battle of the Boroughs posters. Each poster's QR code opens its own page
(`https://battle-of-the-boroughs.netlify.app/<slug>`, e.g. `/london`). Tap to start, point the
phone at the poster, and the artwork turns into a video locked to the print. No app install.

Built with [MindAR](https://github.com/hiukim/mind-ar-js) 1.2.5 (image tracking),
three.js 0.186.1 and Vite 8.3.5, all pinned. Works on iOS 15+ and current Android Chrome.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173/london
```

Desktop test: open a poster page on a laptop and point the webcam at the poster image shown on
a phone. `localhost` counts as secure, so the camera works. Phones need https, so test those on
the Netlify deploy.

Tracking smoothing can be tuned live without rebuilding, e.g.
`?minCF=0.0001&beta=10&miss=8&warmup=3`. Lower `minCF`/`beta` = steadier but laggier.
Put the values you like into `src/config.js`.

## Add a poster

1. Add `{ slug: 'choky', name: 'B-Boy Choky' }` to `src/posters.js`. The slug is the URL path,
   so never change it once the poster is printed.
2. Make its QR code: `pip install qrcode pillow && python3 scripts/make-qr.py choky`
   (writes `qr/choky.svg` for print and `qr/choky.png`). Place it on the poster in Photoshop
   and export the final print JPG.
3. Prepare the web files from the final print JPG and the video:

   ```sh
   python3 scripts/process-poster.py choky Choky-final.jpg Choky.mov --name "B-Boy Choky" --center 0.5
   ```

   This writes `public/posters/choky/poster.jpg` and `video.mp4` (cropped to the poster's
   shape; `--center` is where the person sits across the frame, 0 = left, 1 = right), plus
   `download.mp4`: the full uncropped frame at higher quality with a branded end card
   (event, name, BattleBoroughs.com), which the Save video button hands to viewers.
4. Compile the target: with `npm run dev` running, open
   http://localhost:5173/tools/compile.html, pick `public/posters/choky/poster.jpg`, and save
   the downloaded `target.mind` into `public/posters/choky/`.

Each poster folder holds `poster.jpg`, `video.mp4`, `download.mp4` and `target.mind`.

## How it works

- `src/main.js` handles the start screen, the audio unlock (the video is played inside the
  tap so iOS allows sound later), error screens, the scan hint and mute. The first time the
  poster is found, the artwork lifts and dissolves into the video. When the poster leaves the
  frame, the video lifts off and keeps playing as a card in front of the camera (X closes it);
  pointing back at the poster flies it back onto the print.
- Save video downloads the poster's `download.mp4` on the first tap, then opens the phone's
  share sheet on the second (iOS only allows the share sheet straight from a tap), where
  "Save Video" puts it in Photos. Browsers without file sharing get a normal download.
- `src/config.js` picks the poster from the URL path; `src/posters.js` lists them.
- `src/ar.js` drives MindAR's `Controller` directly with modern three.js. MindAR's bundled
  three.js helper uses `sRGBEncoding`, which three.js removed in r162.
- `.npmrc` sets `ignore-scripts=true` because mind-ar depends on the native `canvas` package
  (only used by its Node compiler), which fails to build on many machines.

## Deploy (Netlify)

Connect this repo in Netlify (Add new site → Import from Git). `netlify.toml` builds with
`npm run build` and publishes `dist`; every push to `main` deploys. `public/_redirects` sends
every poster path to the app, and `public/_headers` sets caching and camera permissions.

## Poster tips

- The tracked image must be the exact final print artwork, QR code included.
- Fine detail and contrast across the whole art; avoid big blank areas and repeating patterns.
- Print from the full-resolution file. Matte paper tracks better than gloss.

## Scan dashboard

`/stats` shows poster scans, people (each phone counted once), taps on Start,
posters found, videos saved, a ranking of every poster, scans per day and phone
types. The phone page reports each step to `netlify/functions/hit.mjs`, which
stores one Netlify Blob per step (no names or IPs). `netlify/functions/stats.mjs`
adds them up. Deploy previews write to a separate "Test" store, so testing
doesn't change the live numbers.

Setup, once: in Netlify, Site configuration → Environment variables, add
`STATS_PASSWORD` (any password you like), then redeploy.

Posters marked `ready: false` in `src/posters.js` show a "Coming soon" page;
their scans are still counted.
