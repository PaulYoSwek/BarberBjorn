export type Lang = 'nl' | 'en'
/** cut, beard and both are built in; Bjorn can add his own from the dashboard. */
export type ServiceId = string

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
  phoneError: string
  privacyNote: string
  privacyLink: string
  footerPrivacy: string
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
  noFitHint: string
  noFitError: string
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
  monthPrev: string
  monthNext: string
  pickDayHint: string
  dayFull: string
  freeLegend: string
  closedLabel: string
  aboutKicker: string
  portraitAlt: string
  aboutTitle: string
  aboutLines: string[]
  aboutClosing: string
  faqKicker: string
  faqTitle: string
  faq: { q: string; a: string }[]
  mapLabel: string
  directionsCta: string
  mapOpen: string
  creditLabel: string
  notFoundTitle: string
  notFoundBody: string
  backHome: string
  nav: { home: string; services: string; about: string; faq: string; contact: string; book: string; menu: string; close: string }
  pages: Record<'book' | 'services' | 'about' | 'faq' | 'contact', { title: string; description: string }>
  contact: { kicker: string; title: string; addressLabel: string; phoneLabel: string; mailLabel: string; note: string }
}

/** Public origin of the site, used for canonical and social tags. */
export const SITE_URL = 'https://www.bjornsbarber.nl'

/** The studio that built the site. Linked from the footer. */
export const CREDIT = {
  name: 'TurboTurtle',
  url: 'https://turboturtle.nl',
}

export const CONTACT = {
  email: 'bjorn899@hotmail.com',
  phone: '+31 6 48163783',
  phoneHref: 'tel:+31648163783',
  addressLine: 'Ferdinandstraat 21, Axel',
  addressFull: 'Ferdinandstraat 21, 4571 AN Axel',
  instagram: 'https://www.instagram.com/bjornrijckaert',
  instagramHandle: '@bjornrijckaert',
}

const services = {
  nl: [
    { id: 'cut' as const, name: 'Knippen', price: '€30', detail: 'Haar, op jouw tempo' },
    { id: 'beard' as const, name: 'Baard', price: '€15', detail: 'Lijn en vorm' },
    { id: 'both' as const, name: 'Knippen + baard', price: '€40', detail: 'Haar en baard' },
  ],
  en: [
    { id: 'cut' as const, name: 'Cut', price: '€30', detail: 'Hair, at your pace' },
    { id: 'beard' as const, name: 'Beard', price: '€15', detail: 'Line and shape' },
    { id: 'both' as const, name: 'Cut + beard', price: '€40', detail: 'Hair and beard' },
  ],
}

export const copy: Record<Lang, Copy> = {
  nl: {
    seoTitle: 'Bjorn’s Barber · Kapper en barbier in Axel',
    seoDescription:
      'Bjorn’s Barber is de kapper en barbier aan de Ferdinandstraat 21 in Axel. Knippen, baard of allebei. Eén stoel, geen haast. Plan je afspraak online.',
    heroHidden: 'Bjorn’s Barber, kapper en barbier in Axel',
    tagline: 'Een goede knip. Zonder haast.',
    bookCta: 'Afspraak maken',
    bookKicker: 'DE STOEL',
    bookTitle: 'Afspraak maken',
    bookIntro: 'Kies wat je wilt en een vrije tijd. Je krijgt meteen een bevestiging per mail.',
    serviceLabel: 'Dienst',
    nameLabel: 'Naam',
    phoneLabel: 'Telefoon',
    emailLabel: 'E-mail',
    phoneError: 'Dit nummer klopt niet. Gebruik minstens 8 cijfers.',
    privacyNote: 'We gebruiken je gegevens alleen voor je afspraak.',
    privacyLink: 'Privacyverklaring',
    footerPrivacy: 'Privacy en cookies',
    customTimeCta: 'Ander tijdstip vragen',
    customTimeTitle: 'Ander tijdstip',
    backToAgenda: 'Terug naar het overzicht',
    noTimeYet: 'Nog geen tijd gekozen',
    bookSuccess: 'Je afspraak staat vast. Je krijgt een bevestiging per mail.',
    requestSuccess: 'Nog geen bevestiging. Je krijgt mail als Bjorn ja of nee zegt.',
    dayLabel: 'Dag',
    slotLabel: 'Tijd',
    sendLabel: 'Boeken',
    sendingLabel: 'Even geduld…',
    fieldError: 'Vul dit nog even in.',
    weekendError: 'Zaterdag en zondag is de stoel dicht. Kies een weekdag.',
    pastError: 'Die dag is al geweest. Kies vandaag of later.',
    takenError: 'Die tijd is al weg. Kies een vrije.',
    noFitHint: 'Deze dienst past hier niet voor de volgende dichte tijd.',
    noFitError: 'Deze dienst past hier niet meer voor sluitingstijd. Kies een eerdere tijd.',
    agendaHint: 'Kies eerst een dienst.',
    mailFallback: 'De mail opent niet. Kopieer het adres en de aanvraag.',
    requestNote: 'Dit is een aanvraag, nog geen bevestiging.',
    mailSubject: 'Afspraak Bjorn’s Barber',
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
    monthPrev: 'Vorige maand',
    monthNext: 'Volgende maand',
    pickDayHint: 'Kies een dag met een stip, dan zie je de vrije tijden.',
    dayFull: 'Geen vrije tijd meer op deze dag.',
    freeLegend: 'vrije tijd',
    closedLabel: 'dicht',
    aboutKicker: 'DE BARBER',
    portraitAlt: 'Bjorn, kapper en barbier bij Bjorn’s Barber in Axel',
    aboutTitle: 'Over Bjorn’s Barber',
    faqKicker: 'VRAGEN',
    faqTitle: 'Voordat je langskomt.',
    aboutLines: [
      'Mijn naam is Bjorn en ik ben de eigenaar van Bjorn’s Barber. Inmiddels heb ik 8 jaar ervaring als barber en met veel plezier werk ik iedere dag aan het vak waar ik mijn passie in heb gevonden.',
      'Ik ben begonnen als barber omdat ik het mooi vind dat je echt één-op-één met een klant werkt. Je neemt de tijd voor iemand, luistert naar wat hij wil en zorgt ervoor dat hij uiteindelijk met een tevreden gevoel de deur uitgaat. Dat persoonlijke contact is voor mij minstens zo belangrijk als het eindresultaat.',
      'Bij Bjorn’s Barber draait het daarom niet om zoveel mogelijk klanten op een dag. Ik doe geen lopendebandwerk. Iedere klant krijgt mijn volledige aandacht en ik neem de tijd om te zorgen dat het kapsel past bij de persoon.',
      'Na 8 jaar ervaring blijf ik mezelf ontwikkelen en streven naar de beste kwaliteit. Mijn doel is simpel: zorgen dat je tevreden de stoel uitkomt én graag weer terugkomt.',
    ],
    aboutClosing: 'Persoonlijke aandacht. Kwaliteit. En een kapsel waar je met vertrouwen mee naar buiten loopt.',
    faq: [
      { q: 'Moet ik een afspraak maken?', a: 'Ja, elke klant boekt zijn eigen afspraak, zodat je niet uren hoeft te wachten.' },
      { q: 'Hoe lang duurt het?', a: 'Knippen 45 minuten, een baard 30 minuten, knippen + baard 75 minuten. Hij werkt niet op de klok.' },
      { q: 'Geeft hij advies?', a: 'Ja, iedere klant zal persoonlijk advies krijgen over zijn kapsel of baard.' },
      { q: 'Waar zit Bjorn’s Barber?', a: 'Ferdinandstraat 21 in Axel. De kaart bovenaan wijst de deur.' },
    ],
    mapLabel: 'Ferdinandstraat 21, Axel',
    directionsCta: 'Route',
    mapOpen: 'Kaart openen',
    creditLabel: 'Website door',
    notFoundTitle: 'Die pagina is er niet.',
    notFoundBody: 'Het adres klopt niet, of de pagina is weg.',
    backHome: 'Naar de voorpagina',
    nav: {
      home: 'Naar de voorpagina',
      services: 'Diensten',
      about: 'Over Bjorn',
      faq: 'Vragen',
      contact: 'Contact',
      book: 'Afspraak maken',
      menu: 'Menu',
      close: 'Menu sluiten',
    },
    pages: {
      book: { title: 'Afspraak maken', description: 'Kies een dienst en een vrije tijd. Je krijgt meteen een bevestiging per mail.' },
      services: { title: 'Diensten en prijzen', description: 'Knippen, baard of allebei, in alle rust. Prijzen zijn inclusief btw.' },
      about: { title: 'Over Bjorn', description: 'Acht jaar barber, één stoel en alle aandacht voor wie erin zit.' },
      faq: { title: 'Veelgestelde vragen', description: 'Wat je wilt weten voordat je langskomt bij Bjorn’s Barber in Axel.' },
      contact: { title: 'Contact', description: 'Ferdinandstraat 21 in Axel. Bel, mail of kom langs.' },
    },
    contact: {
      kicker: 'HIER ZIT HIJ',
      title: 'Kom langs in Axel',
      addressLabel: 'Adres',
      phoneLabel: 'Telefoon',
      mailLabel: 'E-mail',
      note: 'Een afspraak maak je online in een minuut. Voor een vraag kun je altijd bellen of mailen.',
    },
  },
  en: {
    seoTitle: 'Bjorn’s Barber · Barber in Axel',
    seoDescription:
      'Bjorn’s Barber is the barber at Ferdinandstraat 21 in Axel, the Netherlands. Cut, beard or both. One chair, no rush. Book your visit online.',
    heroHidden: 'Bjorn’s Barber, barber in Axel',
    tagline: 'A proper cut. No rush.',
    bookCta: 'Book a visit',
    bookKicker: 'THE CHAIR',
    bookTitle: 'Book a visit',
    bookIntro: 'Pick what you want and a free time. You get a confirmation by mail right away.',
    serviceLabel: 'Service',
    nameLabel: 'Name',
    phoneLabel: 'Phone',
    emailLabel: 'Email',
    phoneError: 'That number looks wrong. Use at least 8 digits.',
    privacyNote: 'We only use your details for your appointment.',
    privacyLink: 'Privacy statement',
    footerPrivacy: 'Privacy and cookies',
    customTimeCta: 'Request another time',
    customTimeTitle: 'Another time',
    backToAgenda: 'Back to the overview',
    noTimeYet: 'No time chosen yet',
    bookSuccess: 'Your appointment is booked. A confirmation is on its way by mail.',
    requestSuccess: 'Not confirmed yet. You will get a mail when Bjorn says yes or no.',
    dayLabel: 'Day',
    slotLabel: 'Time',
    sendLabel: 'Book',
    sendingLabel: 'One moment…',
    fieldError: 'Add this first.',
    weekendError: 'Saturday and Sunday the chair is closed. Pick a weekday.',
    pastError: 'That day has passed. Pick today or a later day.',
    takenError: 'That time is taken. Pick a free one.',
    noFitHint: 'This service does not fit before the next closed time.',
    noFitError: 'This service does not fit before closing time. Pick an earlier start.',
    agendaHint: 'Pick a service first.',
    mailFallback: 'The email did not open. Copy the address and the request.',
    requestNote: 'This is a request, not a confirmation yet.',
    mailSubject: 'Appointment Bjorn’s Barber',
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
    monthPrev: 'Previous month',
    monthNext: 'Next month',
    pickDayHint: 'Pick a day with a dot to see its free times.',
    dayFull: 'No free time left on this day.',
    freeLegend: 'free time',
    closedLabel: 'closed',
    aboutKicker: 'THE BARBER',
    portraitAlt: 'Bjorn, the barber at Bjorn’s Barber in Axel',
    aboutTitle: 'About Bjorn’s Barber',
    faqKicker: 'QUESTIONS',
    faqTitle: 'Before you sit.',
    aboutLines: [
      'My name is Bjorn and I own Bjorn’s Barber. I have 8 years of experience as a barber now, and every day I enjoy working at the craft I found my passion in.',
      'I became a barber because I love working truly one-on-one with a client. You take your time for someone, listen to what he wants and make sure he walks out the door feeling satisfied. That personal contact matters at least as much to me as the end result.',
      'That is why Bjorn’s Barber is not about seeing as many clients as possible in a day. I don’t do assembly-line work. Every client gets my full attention, and I take the time to make sure the haircut suits the person.',
      'After 8 years I keep developing and aiming for the best quality. My goal is simple: you leave the chair satisfied and you are happy to come back.',
    ],
    aboutClosing: 'Personal attention. Quality. And a haircut you walk out with confidently.',
    faq: [
      { q: 'Do I need an appointment?', a: 'Yes, every client books their own appointment, so you never have to wait for hours.' },
      { q: 'How long does it take?', a: "A cut takes 45 minutes, a beard 30 minutes, cut + beard 75 minutes. He doesn't work to the clock." },
      { q: 'Does he give advice?', a: 'Yes, every client gets personal advice on their haircut or beard.' },
      { q: 'Where is Bjorn’s Barber?', a: 'Ferdinandstraat 21 in Axel. The map at the top points to the door.' },
    ],
    mapLabel: 'Ferdinandstraat 21, Axel',
    directionsCta: 'Directions',
    mapOpen: 'Open the map',
    creditLabel: 'Website by',
    notFoundTitle: 'That page is not here.',
    notFoundBody: 'The address is wrong, or the page is gone.',
    backHome: 'Back to the front page',
    nav: {
      home: 'Back to the front page',
      services: 'Services',
      about: 'About Bjorn',
      faq: 'Questions',
      contact: 'Contact',
      book: 'Book a visit',
      menu: 'Menu',
      close: 'Close menu',
    },
    pages: {
      book: { title: 'Book a visit', description: 'Pick a service and a free time. You get a confirmation by mail right away.' },
      services: { title: 'Services and prices', description: 'Cut, beard or both, at your pace. Prices include VAT.' },
      about: { title: 'About Bjorn', description: 'Eight years a barber, one chair and full attention for whoever sits in it.' },
      faq: { title: 'Frequently asked questions', description: 'What you want to know before you come to Bjorn’s Barber in Axel.' },
      contact: { title: 'Contact', description: 'Ferdinandstraat 21 in Axel. Call, mail or drop by.' },
    },
    contact: {
      kicker: 'WHERE HE IS',
      title: 'Come by in Axel',
      addressLabel: 'Address',
      phoneLabel: 'Phone',
      mailLabel: 'E-mail',
      note: 'Booking takes a minute online. For a question you can always call or mail.',
    },
  },
}
