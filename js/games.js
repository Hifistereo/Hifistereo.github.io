/* The catalogue of games, shared by index.html, kolekcija.html and vecakiem.html.
   One place to add a game, so a new one cannot appear on the home page but go
   missing from the collection or the parent rollup. */

export const GAMES = [
  {
    id: 'PrataSala',
    path: '/PrataSala/',
    title: 'Prāta piedzīvojumu sala',
    short: 'Prāta sala',
    accent: 'prata',
    icon: '🏝️',
    tag: 'Domāšanai',
    cta: 'Spēlēt',
    // INFERRED, not stated by the app — it never declares an age anywhere.
    // Mini-games for attention, memory and problem solving need more than a
    // toddler can give. Adjust here if that is wrong; nothing else reads it.
    ages: [4, 7],
    agesSource: 'inferred',
  },
  {
    id: 'Paint',
    path: '/Paint/',
    title: 'Little Fingers Paint',
    short: 'Paint',
    accent: 'paint',
    icon: '🎨',
    tag: 'Radošumam',
    cta: 'Zīmēt',
    // INFERRED. Finger painting asks nothing of a child except a finger, so
    // it spans the whole range the site serves.
    ages: [2, 7],
    agesSource: 'inferred',
  },
  {
    id: 'KidlaTest',
    path: '/KidlaTest/',
    title: 'Burtu Feja',
    short: 'Burtu Feja',
    accent: 'kidla',
    icon: '🧚',
    tag: 'Lasīšanai',
    cta: 'Spēlēt',
    ages: [5, 6],          // stated on its own welcome screen
    agesSource: 'stated',
  },
  {
    id: 'ENG-learning',
    path: '/ENG-learning/',
    title: 'Mācāmies angliski!',
    short: 'Angliski',
    accent: 'eng',
    icon: '🐲',
    tag: 'Valodai',
    cta: 'Mācīties',
    ages: [2, 7],          // stated in its manifest
    agesSource: 'stated',
  },
  {
    id: 'Memory',
    path: '/Memory/',
    title: 'Ciparu dārzs',
    short: 'Ciparu dārzs',
    accent: 'memory',
    icon: '🔢',
    tag: 'Skaitļiem',
    cta: 'Spēlēt',
    ages: [2, 6],          // stated in its description
    agesSource: 'stated',
  },
];

export const byId = (id) => GAMES.find((g) => g.id === id) || null;

/** Does this game suit the child? Unknown age means "show everything equally". */
export function suitsAge(game, ageYears) {
  if (!ageYears) return true;
  return ageYears >= game.ages[0] && ageYears <= game.ages[1];
}

/** "2–7 gadi" */
export const ageLabel = (game) => `${game.ages[0]}–${game.ages[1]} gadi`;
