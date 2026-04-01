// Dataset pour la génération de faux profils et de faux commentaires (engagement ghost admin)

export const firstNames = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'William', 'Barbara', 'David', 'Elizabeth', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Lisa', 'Daniel', 'Nancy',
  'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley',
  'Steven', 'Dorothy', 'Paul', 'Kimberly', 'Andrew', 'Emily', 'Joshua', 'Donna',
  'Kenneth', 'Michelle', 'Kevin', 'Carol', 'Brian', 'Amanda', 'George', 'Melissa',
  'Timothy', 'Deborah', 'Ronald', 'Stephanie', 'Edward', 'Rebecca', 'Jason', 'Sharon',
  'Jeffrey', 'Laura', 'Ryan', 'Cynthia', 'Jacob', 'Kathleen', 'Gary', 'Amy',
  'Nicholas', 'Angela', 'Eric', 'Shirley', 'Jonathan', 'Anna', 'Stephen', 'Brenda',
  'Larry', 'Pamela', 'Justin', 'Emma', 'Scott', 'Nicole', 'Brandon', 'Helen',
]

export const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill',
  'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell',
  'Mitchell', 'Carter', 'Roberts', 'Evans', 'Turner', 'Phillips', 'Parker', 'Collins',
  'Edwards', 'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez',
  'Ortiz', 'Morgan', 'Cooper', 'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard',
  'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson', 'Watson', 'Brooks', 'Chavez',
]

const usedUsernames = new Set()

export function generateFakeName() {
  const first = firstNames[Math.floor(Math.random() * firstNames.length)]
  const last = lastNames[Math.floor(Math.random() * lastNames.length)]
  const displayName = `${first} ${last}`

  let username
  let attempts = 0
  do {
    const suffix = Math.floor(Math.random() * 9999)
    username = `${first.toLowerCase()}${last.toLowerCase()}${suffix}`
    attempts++
  } while (usedUsernames.has(username) && attempts < 20)

  usedUsernames.add(username)
  return { displayName, username }
}

export const moods = [
  { value: 'joyeux', label: 'Joyeux 😄' },
  { value: 'en_colere', label: 'En colère 😡' },
  { value: 'triste', label: 'Triste 😢' },
  { value: 'excite', label: 'Excité 🤩' },
  { value: 'choque', label: 'Choqué 😱' },
  { value: 'indifferent', label: 'Indifférent 😐' },
  { value: 'amoureux', label: 'Amoureux 🥰' },
]

export const moodPhrases = {
  joyeux: [
    "J'adore !!!",
    "Trop bien !",
    "Super contente !",
    "Ça m'a fait sourire ❤️",
    "Magnifique !",
    "Waou, j'adore vraiment !",
    "Tellement positif, merci !",
    "Ça fait du bien de voir ça !",
    "Parfait !",
    "Génial !!!",
    "C'est exactement ce qu'il fallait !",
    "Vous êtes les meilleurs !",
    "On en voulait encore !",
    "5 étoiles 🌟",
    "Bravo à toute l'équipe !",
    "Je souris en lisant ça !",
    "Trop beau 😍",
    "Franchement super !",
    "Que du bonheur !",
    "Je partage à tout le monde !",
  ],
  en_colere: [
    "C'est trop !",
    "Ils se foutent de notre gueule !",
    "Scandaleux !!!",
    "Inacceptable.",
    "J'en reviens pas...",
    "C'est une honte !",
    "On ne mérite pas ça !",
    "Sérieusement ?!",
    "Révoltant.",
    "Pourquoi ??? 😤",
    "Ça suffit maintenant !",
    "Je suis hors de moi.",
    "Non mais ils se prennent pour qui ?",
    "Stop avec ces conneries !",
    "Je suis dégoûté(e).",
    "Boycott !",
    "Vous nous prenez vraiment pour des idiots.",
    "Inadmissible !!!",
    "J'aurais jamais cru ça possible.",
    "Complètement hors sujet.",
  ],
  triste: [
    "Ça m'a brisé le cœur.",
    "Je suis dévastée...",
    "Trop triste 😢",
    "Je pleure en lisant ça.",
    "C'est tellement douloureux.",
    "Pourquoi les choses doivent être comme ça ?",
    "Je me sens si seule face à ça.",
    "Mon cœur saigne.",
    "Je pensais que ça irait mieux.",
    "C'est dur à accepter.",
    "Personne ne mérite ça.",
    "Ça me rappelle des moments difficiles.",
    "Je vous envoie plein de force 💙",
    "Je préfère ne pas y penser.",
    "Tellement injuste.",
    "Mes pensées vous accompagnent.",
    "On sera là pour vous.",
    "Restez forts.",
    "Je vous soutiens de tout cœur.",
    "C'est une vraie peine.",
  ],
  excite: [
    "OMGGGG !!!",
    "J'en reviens pas !!!",
    "INCROYABLE !!!",
    "C'est dingue !!!",
    "YESSS !!!",
    "Je suis TROP excité(e) !!",
    "Ça y est !!!!! 🎉",
    "JE CRIE !!!",
    "Ma journée est faite !!",
    "ENFIN !!!",
    "C'est OFFICIAL ??",
    "Mon Dieu je tremble !!!",
    "JE SAVAIS QUE ÇA ALLAIT ARRIVER !!!",
    "Vivement la suite !!!!!",
    "On est les premiers à savoir !!",
    "TROP TOP !!",
    "Je peux pas y croire ???",
    "OMG OMG OMG",
    "C'est le meilleur jour de ma vie.",
    "Je danse de joie là 🕺",
  ],
  choque: [
    "Quoi ?!",
    "Sérieusement ?!",
    "Je suis sans voix.",
    "Impossible...",
    "Non. Non non non.",
    "Attendez, c'est réel ?",
    "Je n'aurais jamais imaginé ça.",
    "C'est une blague ?",
    "Choqué(e) à 100%.",
    "Je dois relire ça plusieurs fois.",
    "Mes yeux me trompent.",
    "C'est du grand n'importe quoi.",
    "Comment est-ce possible ?",
    "J'hallucine complètement.",
    "Ça dépasse l'entendement.",
    "Je suis bouche bée.",
    "On nage en plein délire.",
    "Pardon ??",
    "Je ne sais pas quoi dire.",
    "C'est… inattendu.",
  ],
  indifferent: [
    "Mouais.",
    "Bof.",
    "Pas vraiment surpris.",
    "Et alors ?",
    "Ok.",
    "Rien de nouveau sous le soleil.",
    "C'est déjà vu.",
    "Sans commentaire.",
    "Peu importe.",
    "Je m'en fiche un peu.",
    "Ça ne change rien pour moi.",
    "Comme d'habitude.",
    "Ni bien ni mal.",
    "J'avais prévu ça.",
    "On verra bien.",
    "Pourquoi pas.",
    "Je reste neutre là-dessus.",
    "Ça ne m'étonne pas.",
    "Classique.",
    "Bon.",
  ],
  amoureux: [
    "Tellement beau ❤️",
    "Je t'aime trop",
    "Mon cœur 🥺",
    "Trop mignon(ne) !",
    "❤️❤️❤️",
    "Je vous adore.",
    "C'est tellement touchant.",
    "L'amour existe encore !",
    "Ça réchauffe le cœur.",
    "Vous êtes magnifiques.",
    "Je suis émue aux larmes ❤️",
    "De la beauté pure.",
    "Ça donne de l'espoir.",
    "Vous êtes faits l'un pour l'autre.",
    "Trop cute !!",
    "Je veux la même chose 😭❤️",
    "On fond devant ça.",
    "Le bonheur ça ressemble à ça.",
    "Trop d'amour pour ce post.",
    "Mes yeux brillent 🌟",
  ],
}

export function getRandomPhrase(mood) {
  const phrases = moodPhrases[mood]
  if (!phrases || phrases.length === 0) return "..."
  return phrases[Math.floor(Math.random() * phrases.length)]
}
