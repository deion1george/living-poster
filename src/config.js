// Everything you'd change when swapping in the final poster and footage lives here.
export const config = {
  // Compiled image target (see README: "Compile the target").
  targetSrc: '/targets.mind',
  // Exact final artwork used for the target. Shown on top of the tracked
  // poster and faded out into the video the first time it's found.
  posterSrc: '/media/poster.jpg',
  // H.264/AAC MP4, faststart, cropped to the same aspect ratio as the poster art.
  videoSrc: '/media/clip.mp4',
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
