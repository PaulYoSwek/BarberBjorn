export type Lang = 'nl' | 'en'
export type ServiceId = 'cut' | 'beard' | 'both'

export type Copy = {
  seoTitle: string
  seoDescription: string
  heroHidden: string
  tagline: string
  bookCta: string
  bookKicker: string
  bookTitle: string
  bookIntro: string
  serviceLabel: string
  nameLabel: string
  phoneLabel: string
  emailLabel: string
  phoneOptional: string
  customTimeCta: string
  customTimeTitle: string
  backToAgenda: string
  noTimeYet: string
  bookSuccess: string
  requestSuccess: string
  dayLabel: string
  slotLabel: string
  sendLabel: string
  sendingLabel: string
  fieldError: string
  weekendError: string
  pastError: string
  takenError: string
  agendaHint: string
  mailFallback: string
  requestNote: string
  mailSubject: string
  servicesKicker: string
  services: { id: ServiceId; name: string; price: string; detail: string }[]
  hoursTime: string
  days: { key: string; label: string; closed: boolean }[]
  months: string[]
  monthShort: string[]
  weekPrev: string
  weekNext: string
  closedLabel: string
  aboutKicker: string
  portraitAlt: string
  aboutTitle: string
  aboutLines: string[]
  faqKicker: string
  faqTitle: string
  faq: { q: string; a: string }[]
  mapLabel: string
  directionsCta: string
  creditLabel: string
  notFoundTitle: string
  notFoundBody: string
  backHome: string
}

/** Public origin of the site, used for canonical and social tags. */
export const SITE_URL = 'https://www.barberbjorn.nl'

/** The studio that built the site. Linked from the footer. */
export const CREDIT = {
  name: 'TurboTurtle',
  url: 'https://turboturtle.nl',
}

export const CONTACT = {
  email: 'hallo@barberbjorn.nl',
  phone: '06 12 34 56 78',
  addressLine: 'Ferdinandstraat 8, Axel',
  addressFull: 'Ferdinandstraat 8, 4571 AP Axel',
}

const services = {
  nl: [
    { id: 'cut' as const, name: 'Knippen', price: '€30', detail: 'Haar, op jouw tempo' },
    { id: 'beard' as const, name: 'Baard', price: '€15', detail: 'Lijn en vorm' },
    { id: 'both' as const, name: 'Allebei', price: '€40', detail: 'Knippen + baard' },
  ],
  en: [
    { id: 'cut' as const, name: 'Cut', price: '€30', detail: 'Hair, at your pace' },
    { id: 'beard' as const, name: 'Beard', price: '€15', detail: 'Line and shape' },
    { id: 'both' as const, name: 'Both', price: '€40', detail: 'Cut and beard' },
  ],
}

export const copy: Record<Lang, Copy> = {
  nl: {
    seoTitle: 'BarberBjorn · Kapper en barbier in Axel',
    seoDescription:
      'BarberBjorn is de kapper en barbier aan de Ferdinandstraat 8 in Axel. Knippen €30, baard €15, allebei €40. Eén stoel, geen haast. Plan je afspraak online.',
    heroHidden: 'BarberBjorn, kapper en barbier in Axel',
    tagline: 'Een goede knip. Zonder haast.',
    bookCta: 'Afspraak maken',
    bookKicker: 'DE STOEL',
    bookTitle: 'Afspraak maken',
    bookIntro: 'Kies een vrije tijd. Je krijgt meteen een bevestiging per mail.',
    serviceLabel: 'Dienst',
    nameLabel: 'Naam',
    phoneLabel: 'Telefoon',
    emailLabel: 'E-mail',
    phoneOptional: 'Telefoon (niet verplicht)',
    customTimeCta: 'Ander tijdstip vragen',
    customTimeTitle: 'Ander tijdstip',
    backToAgenda: 'Terug naar het overzicht',
    noTimeYet: 'Nog geen tijd gekozen',
    bookSuccess: 'Je tijd is van jou. Er gaat een mail naartoe.',
    requestSuccess: 'Nog geen bevestiging. Je krijgt mail als Bjorn ja of nee zegt.',
    dayLabel: 'Dag',
    slotLabel: 'Tijd',
    sendLabel: 'Verstuur',
    sendingLabel: 'Even geduld…',
    fieldError: 'Vul dit nog even in.',
    weekendError: 'Zaterdag en zondag is de stoel dicht. Kies een weekdag.',
    pastError: 'Die dag is al geweest. Kies vandaag of later.',
    takenError: 'Die tijd is al weg. Kies een vrije.',
    agendaHint: 'Kies eerst een dienst.',
    mailFallback: 'De mail opent niet. Kopieer het adres en de aanvraag.',
    requestNote: 'Dit is een aanvraag, nog geen bevestiging.',
    mailSubject: 'Afspraak BarberBjorn',
    servicesKicker: 'DE STOEL',
    services: services.nl,
    hoursTime: '09:00 — 18:00',
    days: [
      { key: 'mon', label: 'ma', closed: false },
      { key: 'tue', label: 'di', closed: false },
      { key: 'wed', label: 'wo', closed: false },
      { key: 'thu', label: 'do', closed: false },
      { key: 'fri', label: 'vr', closed: false },
      { key: 'sat', label: 'za', closed: true },
      { key: 'sun', label: 'zo', closed: true },
    ],
    months: ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'],
    monthShort: ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'],
    weekPrev: 'Vorige week',
    weekNext: 'Volgende week',
    closedLabel: 'dicht',
    aboutKicker: 'OVER BJORN',
    portraitAlt: 'Bjorn, kapper en barbier bij BarberBjorn in Axel',
    aboutTitle: 'Alleen hij. Alle tijd.',
    faqKicker: 'VRAGEN',
    faqTitle: 'Voor je komt.',
    aboutLines: [
      'Hij knipt hier zelf. Geen tweede stoel.',
      'Jij kiest de muziek. Er is een drankje, en een praatje als je wilt.',
      'Niet gehaast. Je gaat weg als het echt goed zit.',
      'Hij zegt het ook als iets je beter staat.',
    ],
    faq: [
      { q: 'Moet ik een afspraak maken?', a: 'Ja. Zo blijft de stoel echt van jou. Gebruik het formulier, of bel.' },
      { q: 'Hoe lang duurt het?', a: 'Knippen zo’n 45 minuten, een baard 20 minuten, allebei rond een uur. Hij werkt niet op de klok.' },
      { q: 'Mag ik de muziek kiezen?', a: 'Ja. Zeg een artiest of een sfeer. Liever stil, dan blijft het stil.' },
      { q: 'Geeft hij advies?', a: 'Ja. Hij zegt het als een andere lengte of een andere lijn je beter staat.' },
      { q: 'Waar zit BarberBjorn?', a: 'Ferdinandstraat 8 in Axel. De kaart bovenaan wijst de deur.' },
    ],
    mapLabel: 'Ferdinandstraat 8, Axel',
    directionsCta: 'Route',
    creditLabel: 'Website door',
    notFoundTitle: 'Die pagina is er niet.',
    notFoundBody: 'Het adres klopt niet, of de pagina is weg.',
    backHome: 'Naar de voorpagina',
  },
  en: {
    seoTitle: 'BarberBjorn · Barber in Axel',
    seoDescription:
      'BarberBjorn is the barber at Ferdinandstraat 8 in Axel, the Netherlands. Cut €30, beard €15, both €40. One chair, no rush. Book your visit online.',
    heroHidden: 'BarberBjorn, barber in Axel',
    tagline: 'A proper cut. No rush.',
    bookCta: 'Book a visit',
    bookKicker: 'THE CHAIR',
    bookTitle: 'Book a visit',
    bookIntro: 'Pick a free time. You get a confirmation by mail right away.',
    serviceLabel: 'Service',
    nameLabel: 'Name',
    phoneLabel: 'Phone',
    emailLabel: 'Email',
    phoneOptional: 'Phone (optional)',
    customTimeCta: 'Request another time',
    customTimeTitle: 'Another time',
    backToAgenda: 'Back to the overview',
    noTimeYet: 'No time chosen yet',
    bookSuccess: 'That time is yours. A mail is on its way.',
    requestSuccess: 'Not confirmed yet. You will get a mail when Bjorn says yes or no.',
    dayLabel: 'Day',
    slotLabel: 'Time',
    sendLabel: 'Send',
    sendingLabel: 'One moment…',
    fieldError: 'Add this first.',
    weekendError: 'Saturday and Sunday the chair is closed. Pick a weekday.',
    pastError: 'That day has passed. Pick today or a later day.',
    takenError: 'That time is taken. Pick a free one.',
    agendaHint: 'Pick a service first.',
    mailFallback: 'The email did not open. Copy the address and the request.',
    requestNote: 'This is a request, not a confirmation yet.',
    mailSubject: 'Appointment BarberBjorn',
    servicesKicker: 'THE CHAIR',
    services: services.en,
    hoursTime: '09:00 — 18:00',
    days: [
      { key: 'mon', label: 'mon', closed: false },
      { key: 'tue', label: 'tue', closed: false },
      { key: 'wed', label: 'wed', closed: false },
      { key: 'thu', label: 'thu', closed: false },
      { key: 'fri', label: 'fri', closed: false },
      { key: 'sat', label: 'sat', closed: true },
      { key: 'sun', label: 'sun', closed: true },
    ],
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    weekPrev: 'Previous week',
    weekNext: 'Next week',
    closedLabel: 'closed',
    aboutKicker: 'ABOUT BJORN',
    portraitAlt: 'Bjorn, the barber at BarberBjorn in Axel',
    aboutTitle: 'Just him. All the time.',
    faqKicker: 'QUESTIONS',
    faqTitle: 'Before you sit.',
    aboutLines: [
      'He cuts here himself. No second chair.',
      "You pick the music. There's a drink, and a chat if you want one.",
      'No rush. You leave when it actually looks right.',
      "He'll say so when something else would suit you better.",
    ],
    faq: [
      { q: 'Do I need an appointment?', a: 'Yes. That way the chair is actually yours. Use the form, or call.' },
      { q: 'How long does it take?', a: "A cut takes about 45 minutes, a beard 20 minutes, both around an hour. He doesn't work to the clock." },
      { q: 'Can I choose the music?', a: "Yes. Name an artist or a mood. If you'd rather have quiet, it stays quiet." },
      { q: 'Does he give advice?', a: "Yes. He'll say so if a different length or line would suit you better." },
      { q: 'Where is BarberBjorn?', a: 'Ferdinandstraat 8 in Axel. The map at the top points to the door.' },
    ],
    mapLabel: 'Ferdinandstraat 8, Axel',
    directionsCta: 'Directions',
    creditLabel: 'Website by',
    notFoundTitle: 'That page is not here.',
    notFoundBody: 'The address is wrong, or the page is gone.',
    backHome: 'Back to the front page',
  },
}
