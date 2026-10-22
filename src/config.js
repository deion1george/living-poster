import { posters } from './posters.js';

// Shared settings. Per-poster files live in public/posters/<slug>/.
export const config = {
  event: 'Battle of the Boroughs',
  loop: true,

  // MindAR smoothing. Lower filterMinCF / filterBeta = less jitter but more lag.
  // Override on a phone without rebuilding: ?minCF=0.0001&beta=10&miss=8&warmup=3
  tracking: {
    filterMinCF: 0.0001,
    filterBeta: 10,
    missTolerance: 8,
    warmupTolerance: 3,
  },

  firstRevealMs: 1200, // poster -> video transition, first find only
  refindFadeMs: 250,
};

// The poster for the current URL path, with its asset paths, or null.
export function currentPoster() {
  const slug = location.pathname.split('/').filter(Boolean)[0]?.toLowerCase();
  const p = posters.find((x) => x.slug === slug);
  if (!p) return null;
  const dir = `/posters/${p.slug}`;
  return {
    ...p,
    // Exact final print artwork used for the target; shown over the tracked
    // poster and faded into the video the first time it's found.
    posterSrc: `${dir}/poster.jpg`,
    // H.264/AAC MP4, faststart, cropped to the poster's aspect ratio.
    videoSrc: `${dir}/video.mp4`,
    targetSrc: `${dir}/target.mind`,
  };
}
