import { CONTACT, type Lang } from './content'

/** `paragraphs` come before the list, `after` below it. */
export type PrivacySection = { id: string; heading: string; paragraphs?: string[]; list?: string[]; after?: string[] }
export type PrivacyText = { title: string; updated: string; intro: string; sections: PrivacySection[] }

/** Date the statement last changed. Update it with every change. */
export const PRIVACY_UPDATED = '2026-10-06'

const PHONE = CONTACT.phone
const MAIL = CONTACT.email
const ADDRESS = CONTACT.addressFull

export const PRIVACY: Record<Lang, PrivacyText> = {
  nl: {
    title: 'Privacy- en cookieverklaring',
    updated: 'Laatst bijgewerkt op 6 oktober 2026',
    intro:
      'Als je bij Bjorn’s Barber een afspraak maakt, bewaren we een paar gegevens van je. Hier lees je welke, waarom, hoe lang, en wat je ermee mag doen. We houden het kort en eerlijk.',
    sections: [
      {
        id: 'wie',
        heading: 'Wie zijn wij',
        paragraphs: [
          `Bjorn’s Barber, ${ADDRESS}, is verantwoordelijk voor jouw gegevens. Vragen of verzoeken stuur je naar ${MAIL} of bel ${PHONE}.`,
        ],
      },
      {
        id: 'gegevens',
        heading: 'Welke gegevens we bewaren',
        list: [
          'Als je boekt of een ander tijdstip vraagt: je naam, e-mailadres, telefoonnummer, de dienst, de dag en tijd, de prijs en de taal waarin je de site gebruikte.',
          'Wat Bjorn zelf over je afspraken bijhoudt: hoe vaak je bent geweest, wat je hebt betaald en eventueel een korte notitie, bijvoorbeeld hoe je je haar graag hebt.',
          'Technische gegevens die nodig zijn om de site te laten werken, zoals je IP-adres en browsertype. Die komen in de logbestanden van onze hostingpartijen.',
        ],
        after: ['We vragen niet om gevoelige gegevens. Zet die dus ook niet in een bericht.'],
      },
      {
        id: 'waarom',
        heading: 'Waarom we ze gebruiken',
        list: [
          'Om je afspraak in te plannen, te bevestigen en je te mailen of te bellen als er iets verandert. Dat is nodig om de afspraak uit te voeren.',
          'Om je bij een volgend bezoek beter te helpen, met het klantoverzicht en notities. Dit doen we op basis van ons gerechtvaardigd belang. Je mag daar altijd bezwaar tegen maken.',
          'Voor onze administratie, omdat de wet dat vraagt.',
          'Om de site veilig en werkend te houden.',
        ],
        after: [
          'We sturen geen nieuwsbrieven of reclame, we verkopen niets door en er worden geen automatische besluiten over je genomen.',
        ],
      },
      {
        id: 'wie-ontvangt',
        heading: 'Wie je gegevens nog meer ziet',
        paragraphs: [
          'Alleen Bjorn kan je gegevens inzien, met een eigen wachtwoord. Voor de techniek gebruiken we een paar diensten die je gegevens alleen in onze opdracht verwerken:',
        ],
        list: [
          'Supabase: de database met afspraken en klanten. De servers staan in Londen (Verenigd Koninkrijk).',
          'Vercel: hosting van de website.',
          'Resend: het versturen van de bevestigingsmails.',
          'Mapbox: de kaart bovenaan de pagina. Mapbox ontvangt je IP-adres om de kaart te kunnen tonen. Het meesturen van gebruiksstatistiek naar Mapbox hebben we uitgezet.',
        ],
      },
      {
        id: 'buiten-eu',
        heading: 'Gegevens buiten de Europese Unie',
        paragraphs: [
          'Een deel van deze diensten verwerkt gegevens buiten de EU. Voor het Verenigd Koninkrijk heeft de Europese Commissie bepaald dat de bescherming daar voldoende is. Voor de Verenigde Staten gebeurt het op basis van het EU-VS Data Privacy Framework of de standaardcontractbepalingen van de Europese Commissie.',
        ],
      },
      {
        id: 'bewaren',
        heading: 'Hoe lang we ze bewaren',
        list: [
          'Afspraken en klantgegevens: tot uiterlijk 2 jaar na je laatste afspraak. Daarna verwijderen we ze.',
          'Gegevens die we voor de administratie moeten bewaren, zoals betalingen: 7 jaar, omdat de wet dat voorschrijft.',
          'Logbestanden van de hostingpartijen: kort, meestal enkele dagen tot een paar weken.',
        ],
      },
      {
        id: 'beveiliging',
        heading: 'Beveiliging',
        paragraphs: [
          'Alle verbindingen met de site zijn versleuteld (https). De database is niet openbaar te lezen: alleen het dashboard, achter een wachtwoord, kan je gegevens opvragen.',
        ],
      },
      {
        id: 'rechten',
        heading: 'Jouw rechten',
        paragraphs: [
          `Je mag je gegevens inzien, laten verbeteren of laten verwijderen. Je mag ook vragen om het gebruik te beperken, bezwaar maken, of je gegevens meekrijgen in een gangbaar formaat. Mail daarvoor naar ${MAIL}. We reageren binnen een maand. Soms vragen we je eerst te laten zien dat het om jouw gegevens gaat.`,
          'Ben je niet tevreden over hoe we met je gegevens omgaan? Dan kun je een klacht indienen bij de Autoriteit Persoonsgegevens (autoriteitpersoonsgegevens.nl).',
        ],
      },
      {
        id: 'cookies',
        heading: 'Cookies en lokale opslag',
        paragraphs: [
          'We gebruiken geen tracking-, analyse- of advertentiecookies. Daarom zie je ook geen cookiemelding. Wat de site wel in je browser bewaart, is nodig om hem te laten werken:',
        ],
        list: [
          'Je taalkeuze (Nederlands of Engels), in de lokale opslag van je browser, zodat de site die onthoudt. Dit blijft staan tot je het zelf wist.',
          'Voor het dashboard, alleen voor Bjorn: een inlogcookie en een sessiecode in de lokale opslag, maximaal 7 dagen geldig.',
          'De kaart van Mapbox kan kaartbeelden tijdelijk in de browsercache zetten, zodat de kaart sneller laadt.',
          'De lettertypen staan op onze eigen server, dus daarvoor maak je geen verbinding met Google.',
        ],
      },
      {
        id: 'links',
        heading: 'Links naar andere sites',
        paragraphs: [
          'De knop Route opent Google Maps, en de link onderaan gaat naar de maker van de site. Daar geldt de privacyverklaring van die partijen.',
        ],
      },
      {
        id: 'wijzigingen',
        heading: 'Wijzigingen',
        paragraphs: [
          'Als we deze verklaring aanpassen, zie je dat aan de datum bovenaan. Bij grote wijzigingen laten we het je weten als je een afspraak hebt staan.',
        ],
      },
    ],
  },
  en: {
    title: 'Privacy and cookie statement',
    updated: 'Last updated on 6 October 2026',
    intro:
      'When you book at Bjorn’s Barber we keep a few details about you. This page explains which ones, why, for how long, and what you can do about it. Short and honest.',
    sections: [
      {
        id: 'wie',
        heading: 'Who we are',
        paragraphs: [
          `Bjorn’s Barber, ${ADDRESS}, the Netherlands, is responsible for your data. Send questions or requests to ${MAIL} or call ${PHONE}.`,
        ],
      },
      {
        id: 'gegevens',
        heading: 'What we keep',
        list: [
          'When you book or ask for another time: your name, email address, phone number, the service, the day and time, the price and the language you used on the site.',
          'What Bjorn keeps about your visits: how often you came, what you paid and possibly a short note, for example how you like your hair.',
          'Technical data needed to run the site, such as your IP address and browser type. These end up in the log files of our hosting providers.',
        ],
        after: ['We never ask for sensitive data, so please do not put any in a message.'],
      },
      {
        id: 'waarom',
        heading: 'Why we use it',
        list: [
          'To plan and confirm your appointment and to mail or call you if something changes. This is needed to carry out the appointment.',
          'To serve you better next time, with the client overview and notes. We do this based on our legitimate interest, and you may always object.',
          'For our administration, because the law requires it.',
          'To keep the site safe and working.',
        ],
        after: [
          'We send no newsletters or ads, we sell nothing on, and no automated decisions are made about you.',
        ],
      },
      {
        id: 'wie-ontvangt',
        heading: 'Who else sees your data',
        paragraphs: [
          'Only Bjorn can see your data, behind his own password. For the technology we use a few services that only process data on our behalf:',
        ],
        list: [
          'Supabase: the database with appointments and clients. Its servers are in London (United Kingdom).',
          'Vercel: hosting of the website.',
          'Resend: sending the confirmation mails.',
          'Mapbox: the map at the top of the page. Mapbox receives your IP address to show the map. Sending usage statistics to Mapbox is switched off.',
        ],
      },
      {
        id: 'buiten-eu',
        heading: 'Data outside the European Union',
        paragraphs: [
          'Some of these services process data outside the EU. For the United Kingdom the European Commission decided protection there is adequate. For the United States it happens under the EU-US Data Privacy Framework or the European Commission’s standard contractual clauses.',
        ],
      },
      {
        id: 'bewaren',
        heading: 'How long we keep it',
        list: [
          'Appointments and client data: until at most 2 years after your last appointment. Then we delete them.',
          'Data we must keep for our administration, such as payments: 7 years, as Dutch law requires.',
          'Log files of the hosting providers: briefly, usually a few days to a few weeks.',
        ],
      },
      {
        id: 'beveiliging',
        heading: 'Security',
        paragraphs: [
          'All connections to the site are encrypted (https). The database cannot be read publicly: only the dashboard, behind a password, can request your data.',
        ],
      },
      {
        id: 'rechten',
        heading: 'Your rights',
        paragraphs: [
          `You may see, correct or delete your data. You may also ask us to limit its use, object to it, or receive it in a common format. Mail ${MAIL} for any of this. We reply within one month. We may first ask you to show that the data is yours.`,
          'Not happy with how we handle your data? You can complain to the Dutch Data Protection Authority (autoriteitpersoonsgegevens.nl).',
        ],
      },
      {
        id: 'cookies',
        heading: 'Cookies and local storage',
        paragraphs: [
          'We use no tracking, analytics or advertising cookies, which is why you see no cookie banner. What the site does keep in your browser is needed for it to work:',
        ],
        list: [
          'Your language choice (Dutch or English), in your browser’s local storage, so the site remembers it. It stays until you clear it.',
          'For the dashboard, only for Bjorn: a login cookie and a session code in local storage, valid for at most 7 days.',
          'The Mapbox map may keep map images in the browser cache for a while so it loads faster.',
          'The fonts are served from our own server, so they do not connect you to Google.',
        ],
      },
      {
        id: 'links',
        heading: 'Links to other sites',
        paragraphs: [
          'The Directions button opens Google Maps, and the link at the bottom goes to the maker of the site. Their own privacy statements apply there.',
        ],
      },
      {
        id: 'wijzigingen',
        heading: 'Changes',
        paragraphs: [
          'When we change this statement, the date at the top changes. For big changes we let you know if you have an appointment coming up.',
        ],
      },
    ],
  },
}
