// One entry per printed poster. The slug is the URL path the poster's QR code
// opens (https://battle-of-the-boroughs.netlify.app/<slug>) and the folder under
// public/posters/<slug>/ holding poster.jpg, video.mp4 and target.mind.
// Never rename a slug once its poster is printed.
export const SITE_URL = 'https://battle-of-the-boroughs.netlify.app';

// ready: true once public/posters/<slug>/ has its files. Until then the page
// shows "coming soon" (its QR code still works and scans are still counted).
export const posters = [
  { slug: 'storm', name: 'Judge Storm', ready: true },
  { slug: 'prevail', name: 'Judge Prevail', ready: true },
  { slug: 'breeze', name: 'Judge Breeze', ready: true },
  { slug: 'pollo', name: 'Judge Pollo', ready: true },
  { slug: 'born-one', name: 'Judge Born-One', ready: true },
  { slug: 'kid-break', name: 'Judge Kid Break', ready: true },
  { slug: 'john-comix', name: 'Judge John Comix', ready: true },
  { slug: 'mega-flash', name: 'Judge Mega Flash', ready: true },
  { slug: 'jiggz', name: 'B-Boy Jiggz', ready: true },
  { slug: 'trinity', name: 'B-Girl Trinity', ready: true },
  { slug: 'forrest', name: 'DJ Forrest', ready: true },
  { slug: 'safire', name: 'DJ Safire', ready: true },
  { slug: 'coke-la-rock', name: 'Coke La Rock', ready: true },
  { slug: 'lucky-bling', name: 'Lucky Bling', ready: true },
  { slug: 'king-uprock', name: 'King Uprock', ready: true },
  { slug: 'tanconyc', name: 'B-Boy TancoNYC', ready: true },
  { slug: 'jojo', name: 'JoJo aka Spiderman', ready: true },
  { slug: 'spy', name: 'B-Boy Spy', ready: true },
  { slug: 'spiderweb', name: 'B-Boy Spiderweb', ready: true },
  { slug: 'trac2', name: 'B-Boy Trac2', ready: true },
  { slug: 'jayson-reyes', name: 'Jason Reyes', ready: true },
  { slug: 'kid-nice', name: 'B-Boy Kid Nice', ready: true },
  { slug: 'ron-lo', name: 'B-Boy Ron Lo', ready: true },
  { slug: 'speedy-dee', name: 'B-Boy Speedy Dee', ready: false },
  { slug: 'klown', name: 'Klown', ready: false },
  { slug: 'choky', name: 'B-Boy Choky', ready: false },
  { slug: 'charlie-stettler', name: 'Charlie Stettler', ready: false },
  { slug: 'london', name: 'B-Boy London', ready: true },
  { slug: 'kid-freeze', name: 'B-Boy Kid Freeze', ready: false },
  { slug: 'kurtis-blow', name: 'Kurtis Blow', ready: true },
  { slug: 'mr-ed', name: 'B-Boy Mr. Ed', ready: false },
];
