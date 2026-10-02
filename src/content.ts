export type Lang = 'nl' | 'en'
export type ServiceId = 'cut' | 'beard' | 'both'

export type Copy = {
  tagline: string
  bookCta: string
  bookKicker: string
  bookTitle: string
  bookIntro: string
  serviceLabel: string
  nameLabel: string
  phoneLabel: string
  dayLabel: string
  sendLabel: string
  fieldError: string
  weekendError: string
  pastError: string
  mailFallback: string
  requestNote: string
  mailSubject: string
  servicesKicker: string
  services: { id: ServiceId; name: string; price: string; detail: string }[]
  hoursTime: string
  days: { key: string; label: string; closed: boolean }[]
  closedLabel: string
  aboutKicker: string
  aboutTitle: string
  aboutLines: string[]
  faq: { q: string; a: string }[]
  mapLabel: string
}

export const CONTACT = {
  email: 'hallo@barberbjorn.nl',
  phone: '06 12 34 56 78',
  addressLine: 'Olivierstraat 20, Axel',
  addressFull: 'Olivierstraat 20, 4571 AZ Axel',
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
    tagline: 'Een goede knip. Zonder haast.',
    bookCta: 'Afspraak maken',
    bookKicker: 'DE STOEL',
    bookTitle: 'Afspraak maken',
    bookIntro: 'Kies een dienst en laat je nummer achter. Tot het systeem er is, gaat dit als mail weg.',
    serviceLabel: 'Dienst',
    nameLabel: 'Naam',
    phoneLabel: 'Telefoon',
    dayLabel: 'Dag',
    sendLabel: 'Verstuur',
    fieldError: 'Vul dit nog even in.',
    weekendError: 'Zaterdag en zondag is de stoel dicht. Kies een weekdag.',
    pastError: 'Die dag is al geweest. Kies vandaag of later.',
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
    closedLabel: 'dicht',
    aboutKicker: 'OVER BJORN',
    aboutTitle: 'Alleen hij. Alle tijd.',
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
      { q: 'Waar zit BarberBjorn?', a: 'Olivierstraat 20 in Axel. De kaart bovenaan wijst de deur.' },
    ],
    mapLabel: 'Olivierstraat 20, Axel',
  },
  en: {
    tagline: 'A proper cut. No rush.',
    bookCta: 'Book a visit',
    bookKicker: 'THE CHAIR',
    bookTitle: 'Book a visit',
    bookIntro: 'Pick a service and leave your number. Until the booking system is in place, this leaves as an email.',
    serviceLabel: 'Service',
    nameLabel: 'Name',
    phoneLabel: 'Phone',
    dayLabel: 'Day',
    sendLabel: 'Send',
    fieldError: 'Add this first.',
    weekendError: 'Saturday and Sunday the chair is closed. Pick a weekday.',
    pastError: 'That day has passed. Pick today or a later day.',
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
    closedLabel: 'closed',
    aboutKicker: 'ABOUT BJORN',
    aboutTitle: 'Just him. All the time.',
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
      { q: 'Where is BarberBjorn?', a: 'Olivierstraat 20 in Axel. The map at the top points to the door.' },
    ],
    mapLabel: 'Olivierstraat 20, Axel',
  },
}
