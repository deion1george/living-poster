// One entry per printed poster. The slug is the URL path the poster's QR code
// opens (https://battle-of-the-boroughs.netlify.app/<slug>) and the folder under
// public/posters/<slug>/ holding poster.jpg, video.mp4 and target.mind.
// Never rename a slug once its poster is printed.
export const SITE_URL = 'https://battle-of-the-boroughs.netlify.app';

// ready: true once public/posters/<slug>/ has its files. Until then the page
// shows "coming soon" (its QR code still works and scans are still counted).
export const posters = [
  { slug: 'storm', name: 'Judge Storm', ready: false },
  { slug: 'prevail', name: 'Judge Prevail', ready: false },
  { slug: 'breeze', name: 'Judge Breeze', ready: false },
  { slug: 'pollo', name: 'Judge Pollo', ready: false },
  { slug: 'born-one', name: 'Judge Born-One', ready: false },
  { slug: 'kid-break', name: 'Judge Kid Break', ready: false },
  { slug: 'john-comix', name: 'Judge John Comix', ready: false },
  { slug: 'mega-flash', name: 'Judge Mega Flash', ready: false },
  { slug: 'jiggz', name: 'B-Boy Jiggz', ready: false },
  { slug: 'trinity', name: 'B-Girl Trinity', ready: false },
  { slug: 'forrest', name: 'DJ Forrest', ready: false },
  { slug: 'safire', name: 'DJ Safire', ready: false },
  { slug: 'coke-la-rock', name: 'Coke La Rock', ready: false },
  { slug: 'lucky-bling', name: 'Lucky Bling', ready: false },
  { slug: 'king-uprock', name: 'King Uprock', ready: false },
  { slug: 'tanconyc', name: 'B-Boy TancoNYC', ready: false },
  { slug: 'jojo', name: 'JoJo aka Spiderman', ready: false },
  { slug: 'spy', name: 'B-Boy Spy', ready: false },
  { slug: 'spiderweb', name: 'B-Boy Spiderweb', ready: false },
  { slug: 'trac2', name: 'B-Boy Trac2', ready: false },
  { slug: 'jayson-reyes', name: 'Jason Reyes', ready: false },
  { slug: 'kid-nice', name: 'B-Boy Kid Nice', ready: false },
  { slug: 'ron-lo', name: 'B-Boy Ron Lo', ready: false },
  { slug: 'speedy-dee', name: 'B-Boy Speedy Dee', ready: false },
  { slug: 'klown', name: 'Klown', ready: false },
  { slug: 'choky', name: 'B-Boy Choky', ready: false },
  { slug: 'charlie-stettler', name: 'Charlie Stettler', ready: false },
  { slug: 'london', name: 'B-Boy London', ready: true },
  { slug: 'kid-freeze', name: 'B-Boy Kid Freeze', ready: false },
  { slug: 'kurtis-blow', name: 'Kurtis Blow', ready: false },
  { slug: 'mr-ed', name: 'B-Boy Mr. Ed', ready: false },
];
