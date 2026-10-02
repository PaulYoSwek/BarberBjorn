# BarberBjorn — ontwerp

Eén landingspagina voor kapper Bjorn in Axel. Donker, scherp, met NAC-geel als enige accentkleur. Nederlands is de standaardtaal. Engels is overal beschikbaar via een vaste schakelaar. De pagina werkt op desktop en op een telefoon.

## Buiten scope

Geen boekingsbackend, geen accounts, geen betalingen, geen CMS. Het formulier verstuurt een mail. Een later boekingssysteem vervangt alleen die verstuuractie.

## Visueel systeem

- Zwart `#101010` voor splash, hero en footer. Achtergrond van de hero-video mag nog donkerder, `#070707`.
- Lichter zwart `#2a2a2a` voor over mij, zodat de foto erin oplost.
- Vaag wit `#efece4` voor diensten en FAQ.
- Iets warmer wit `#e4dfd4` voor openingstijden.
- Geel `#f5c400` alleen als accent: schakelaar-actief, knop, combinatieplaat, pin, één streep.
- Vormen zijn scherp afgesneden met rechte snedes. Geen ronde hoeken, geen pillen, geen kaarten met een zachte schaduw.
- Het woordmerk is het aangeleverde logo, wit gemaakt. Prijzen, nummers en tussenkoppen gebruiken Bricolage Grotesque. Lopende tekst gebruikt Outfit.
- Ritme van boven naar beneden: zwart (hero), donkere afspraakband, vaag wit, warmer wit, lichter zwart, vaag wit, zwart.

## Pagina

Vite + React, één pagina, geen router, geen backend. Blokken, in deze volgorde:

1. Splash
2. Hero
3. Afspraak
4. Diensten
5. Openingstijden
6. Over mij
7. FAQ
8. Footer

Alle zichtbare zinnen staan in één inhoudsbestand met een `nl` en een `en` blok. Componenten lezen alleen via de actieve taal.

## Taal

- Standaard is Nederlands.
- Een vaste schakelaar `NL | EN` staat rechtsboven, ook tijdens het scrollen, met een tikvlak van minstens 44 px. De actieve taal is geel.
- Tijdens de splash is de schakelaar verborgen. Hij verschijnt samen met de pagina.
- De keuze gaat naar `?lang=en` of `?lang=nl`, en wordt onthouden in `localStorage`. Volgorde bij het openen: query, dan opgeslagen keuze, dan Nederlands.
- `document.documentElement.lang` wordt `nl` of `en`.
- Het logo, inclusief de regel Fine Grooming, wordt niet vertaald.
- De Mapbox-labels volgen de actieve taal.
- De mail die het formulier opent, is in de actieve taal.

## Splash

Eén keer per paginalading, op een zwart vlak, in het tempo van de goedgekeurde splash.

1. Het BB-monogram komt van boven.
2. Het woordmerk (Barber Bjorn + Fine Grooming) komt van onderen.
3. Een korte gele streep verschijnt ertussen als ze samenkomen.
4. Het zwarte vlak schiet omhoog en de pagina ligt eronder.

De twee aangeleverde losse logo’s worden gebruikt, niet het samengevoegde bestand. Zwart in die bestanden wordt transparant, het grijze teken wordt wit.

Bij `prefers-reduced-motion: reduce` slaat de splash over en begint de pagina meteen.

## Hero

Desktop is de schuine snede. De zwart-wit video vult het vlak. Het witte woordmerk staat erop, met de zin eronder. Rechts is een volle kaartwand, afgesneden door een gele schuine lijn.

- Nederlands: “Een goede knip. Zonder haast.”
- Engels: “A proper cut. No rush.”
- Knop: “Afspraak maken” / “Book a visit”. Die scrolt naar het formulier.
- De video is een eigen loop van ongeveer acht seconden, zonder geluid, zwart-wit, rustig: stoel, tondeuse, een schaar die knipt. Een donkere waas houdt het woordmerk leesbaar. `muted`, `loop`, `playsInline`, `autoplay`.
- Lukt de video niet, dan blijft de hero zwart en blijven woordmerk, zin en knop staan.

Op een telefoon stapelt dit. Eerst woordmerk, zin en knop. Daarna de kaart over de volle breedte, met een gele bovenrand en een schuine onderkant. De video blijft de achtergrond van het bovenste blok.

## Kaart

Mapbox GL, stijl `mapbox://styles/mapbox/dark-v11`. Eén gele pin op Olivierstraat 20, 4571 AZ Axel. De pin wordt bij het bouwen op dat adres gezet. Als het huisnummer niet gevonden wordt, valt de pin terug op het midden van de Olivierstraat: 51.26381, 3.918996.

De publieke token staat in `VITE_MAPBOX_TOKEN`. Zonder token, of als de kaart niet laadt, blijft het adres in tekst staan op dezelfde plek.

Op een aanraakscherm vangt de kaart de paginascroll niet. `cooperativeGestures` staat aan.

## Afspraak

Direct onder de hero, als een scherpe donkere band die overloopt naar het vage wit.

Velden, allemaal verplicht:

- Dienst: Knippen / Baard / Allebei. Engels: Cut / Beard / Both. Geen voorselectie.
- Naam. Na trim minstens twee tekens.
- Telefoon. Minimaal acht cijfers, spaties mogen.
- Dag. Een datum, vandaag of later. Een datum in het verleden wordt geweigerd. Zaterdag en zondag weigert het formulier met de zin dat de stoel dan dicht is, en vraagt om een weekdag. Het formulier vraagt geen tijdstip.

Versturen opent het mailprogramma naar `hallo@barberbjorn.nl`. Onderwerp: “Afspraak BarberBjorn” / “Appointment BarberBjorn”. De body bevat dienst, naam, telefoon, dag, en de zin dat dit een aanvraag is en nog geen bevestiging. Er wordt niets opgeslagen.

Lege of ongeldige velden krijgen één korte melding bij het veld. Nederlands: “Vul dit nog even in.” Engels: “Add this first.” Bij een geblokkeerde mailclient blijft het adres zichtbaar om te kopiëren, plus de ingevulde aanvraag.

Op een telefoon staan de velden onder elkaar. De knop is volle breedte.

## Diensten

Drie scherpe platen, licht ten opzichte van elkaar gedraaid door hun snede, niet door afronding. De combinatie is de gele plaat en staat iets naar voren.

| Dienst | Engels | Prijs | Onderschrift NL | Onderschrift EN |
| --- | --- | --- | --- | --- |
| Knippen | Cut | €30 | Haar, op jouw tempo | Hair, at your pace |
| Baard | Beard | €15 | Lijn en vorm | Line and shape |
| Allebei | Both | €40 | Knippen + baard | Cut and beard |

Kicker boven de platen: “DE STOEL” / “THE CHAIR”.

Op een telefoon staan de platen onder elkaar, nog steeds schuin afgesneden, de gele als laatste.

## Openingstijden

Zeven scherpe snedes in één rij, op het warmere wit. Maandag tot en met vrijdag zijn dichte zwarte vlakken. Eén tijdlijn erboven: `09:00 — 18:00`, met het streepje in geel. Zaterdag en zondag zijn uitgeholde vlakken met “dicht” / “closed”.

Dagnamen: ma di wo do vr za zo / mon tue wed thu fri sat sun.

Op een telefoon blijft het één rij, met de tijd erboven. De letters blijven leesbaar zonder horizontaal scrollen.

## Over mij

Lichter zwart. De aangeleverde portretfoto heeft geen kader. De randen lopen met een masker over in `#2a2a2a`. Een vaag wit vlak snijdt schuin in de foto. De tekst staat op dat vlak.

Nederlands:

- Kicker: OVER BJORN
- Titel: Alleen hij. Alle tijd.
- Hij knipt hier zelf. Geen tweede stoel.
- Jij kiest de muziek. Er is een drankje, en een praatje als je wilt.
- Niet gehaast. Je gaat weg als het echt goed zit.
- Hij zegt het ook als iets je beter staat.

Engels:

- Kicker: ABOUT BJORN
- Titel: Just him. All the time.
- He cuts here himself. No second chair.
- You pick the music. There's a drink, and a chat if you want one.
- No rush. You leave when it actually looks right.
- He'll say so when something else would suit you better.

Op een telefoon staat de foto boven, en het witte vlak overlapt de onderkant van de foto.

## FAQ

Vijf scherpe stroken op vaag wit. Het nummer is geel. Vraag en antwoord staan meteen open. Geen uitklap.

1. Moet ik een afspraak maken? / Do I need an appointment?
   Ja. Zo blijft de stoel echt van jou. Gebruik het formulier, of bel. / Yes. That way the chair is actually yours. Use the form, or call.
2. Hoe lang duurt het? / How long does it take?
   Knippen zo’n 45 minuten, een baard 20 minuten, allebei rond een uur. Hij werkt niet op de klok. / A cut takes about 45 minutes, a beard 20 minutes, both around an hour. He doesn't work to the clock.
3. Mag ik de muziek kiezen? / Can I choose the music?
   Ja. Zeg een artiest of een sfeer. Liever stil, dan blijft het stil. / Yes. Name an artist or a mood. If you'd rather have quiet, it stays quiet.
4. Geeft hij advies? / Does he give advice?
   Ja. Hij zegt het als een andere lengte of een andere lijn je beter staat. / Yes. He'll say so if a different length or line would suit you better.
5. Waar zit BarberBjorn? / Where is BarberBjorn?
   Olivierstraat 20 in Axel. De kaart bovenaan wijst de deur. / Olivierstraat 20 in Axel. The map at the top points to the door.

Op een telefoon blijven de stroken volle breedte. Nummer en tekst mogen onder elkaar als de regel te krap wordt.

## Footer

Zwarte band met een schuine bovenrand.

- Woordmerk, klein en wit
- Olivierstraat 20, Axel
- `hallo@barberbjorn.nl`
- `06 12 34 56 78`

Mail en nummer zijn tijdelijke placeholders. Op een telefoon stapelen de twee kolommen.

## Componenten

Elk blok is één component. Ze krijgen hun zinnen van de taalcontext en kennen elkaars markup niet.

| Component | Doet | Hangt af van |
| --- | --- | --- |
| `LanguageProvider` | Kiest `nl` of `en`, zet de URL, `localStorage` en `lang` | query + localStorage |
| `Splash` | Speelt de logo-animatie één keer, of slaat hem over | logo-bestanden, reduced motion |
| `LanguageSwitch` | Toont NL \| EN | taalcontext |
| `Hero` | Video, woordmerk, zin, knop, kaart | taal, Mapbox-token, video |
| `Booking` | Valideert en opent de mail | taal, mailadres |
| `Services` | Drie platen | taal |
| `Hours` | Zeven snedes | taal |
| `About` | Foto plus wit vlak | taal, portret |
| `Faq` | Vijf stroken | taal |
| `Footer` | Adres, mail, telefoon | taal, contactgegevens |

## Fouten

- Geen Mapbox-token of een kaartfout: het adres blijft leesbaar, de pagina scrollt door.
- Video fout: hero blijft zwart, tekst en knop blijven.
- Formulierveld ongeldig: melding bij dat veld, geen mail.
- Weekenddatum: melding dat die dagen dicht zijn.
- Mailclient opent niet: adres en aanvraag blijven op de pagina staan om te kopiëren.

## Testen

Handmatig in de browser, op een breed scherm en op 390 px breed.

- Splash speelt één keer en eindigt op de hero. Met reduced motion is er geen splash.
- NL | EN wisselt hero, formulier, diensten, tijden, over mij, FAQ en de kaartlabels. `?lang=en` opent Engels. Verversen onthoudt de keuze.
- De kaart toont Axel. Zonder token blijft het adres staan. Op een telefoon scrollt de pagina langs de kaart.
- Leeg formulier verstuurt niets en toont de melding. Een zaterdag wordt geweigerd. Een geldige aanvraag opent een mail met de vier velden.
- Diensten, tijden en over mij stapelen op 390 px. De schakelaar dekt het woordmerk niet. Knoppen zijn met een duim te raken.
