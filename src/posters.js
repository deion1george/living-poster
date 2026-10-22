// One entry per printed poster. The slug is the URL path the poster's QR code
// opens (https://battle-of-the-boroughs.netlify.app/<slug>) and the folder under
// public/posters/<slug>/ holding poster.jpg, video.mp4 and target.mind.
// Never rename a slug once its poster is printed.
export const SITE_URL = 'https://battle-of-the-boroughs.netlify.app';

export const posters = [
  { slug: 'london', name: 'B-Boy London' },
];
