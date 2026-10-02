# BarberBjorn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Dutch-and-English one-page site for BarberBjorn in Axel, with the approved splash, sharp layouts, Mapbox pin, and a mailto booking form.

**Architecture:** Vite + React renders one page of section components. All sentences live in `src/content.ts` under `nl` and `en`. `LanguageProvider` picks the language. Booking validation is a pure function so the later booking system can replace only the submit handler. Mapbox is used only when `VITE_MAPBOX_TOKEN` is set; otherwise the address stays as text.

**Tech Stack:** Vite, React 19, TypeScript, Vitest, Testing Library, Mapbox GL JS, no router, no backend.

## Global Constraints

- Colors: splash/hero/footer black `#101010` (video field `#070707`), about `#2a2a2a`, services and FAQ `#efece4`, hours `#e4dfd4`, accent `#f5c400` only.
- Shapes are straight cuts. No rounded corners, pills, or soft card shadows.
- Wordmark is the supplied logo, recolored white. Prices, numbers, and section titles use Bricolage Grotesque. Body text uses Outfit.
- Page order: Splash, Hero, Booking, Services, Hours, About, FAQ, Footer.
- Default language `nl`. Switch `NL | EN` is fixed top-right, at least 44px, hidden during the splash. Resolve order: `?lang=`, then `localStorage` key `barber-lang`, then `nl`. Set `document.documentElement.lang`.
- Logo text including Fine Grooming is not translated.
- Tagline NL: `Een goede knip. Zonder haast.` EN: `A proper cut. No rush.`
- Prices: Cut €30, Beard €15, Both €40.
- Hours: Mon–Fri 09:00–18:00, Sat–Sun closed.
- Address: Olivierstraat 20, 4571 AZ Axel. Fallback pin lng `3.918996`, lat `51.26381`.
- Contact placeholders: `hallo@barberbjorn.nl` and `06 12 34 56 78`.
- Map style `mapbox://styles/mapbox/dark-v11`, `cooperativeGestures: true`.
- Booking stores nothing. Submit opens a mailto. No time-of-day field.
- `prefers-reduced-motion: reduce` skips the splash.
- Mobile layout at `max-width: 800px` stacks side-by-side regions. Touch targets stay at least 44px.
- Work from `D:\Projects\BarberBjorn`. Commands are PowerShell.

## File structure

- `index.html` — fonts, title, `lang="nl"`
- `src/main.tsx` — mounts `App`
- `src/App.tsx` — splash gate and section order
- `src/styles.css` — all layout
- `src/content.ts` — `Lang`, `Copy`, `copy`, `CONTACT`
- `src/language.tsx` — `readInitialLang`, `LanguageProvider`, `useLang`
- `src/booking.ts` — `validateBooking`
- `src/pin.ts` — fallback pin and address
- `src/components/Splash.tsx`
- `src/components/LanguageSwitch.tsx`
- `src/components/Hero.tsx`
- `src/components/MapPanel.tsx`
- `src/components/BookingForm.tsx`
- `src/components/Services.tsx`
- `src/components/Hours.tsx`
- `src/components/About.tsx`
- `src/components/Faq.tsx`
- `src/components/Footer.tsx`
- `src/*.test.ts` / `src/*.test.tsx` — Vitest
- `public/logo-mark.png`, `public/logo-wordmark.png`, `public/portrait.png`, `public/hero.mp4`
- `scripts/make-logos.py`, `scripts/make-hero.py`
- `.env.example` — `VITE_MAPBOX_TOKEN=`

---

### Task 1: Scaffold Vite, Vitest, and gitignore

**Files:**
- Create: `package.json`, `vite.config.ts`, `src/smoke.test.ts`, `src/test-setup.ts`, `.gitignore`, `.env.example`
- Modify: `index.html`

**Interfaces:**
- Consumes: nothing
- Produces: `npm test` runs Vitest in jsdom. `.env.example` contains `VITE_MAPBOX_TOKEN=`.

- [ ] **Step 1: Create the Vite app in a temp folder and move it up**

The repo root already contains `docs/` and `.superpowers/`. Create the app beside those.

```powershell
npm create vite@latest barber-tmp -- --template react-ts
Get-ChildItem -Force barber-tmp | ForEach-Object { Move-Item -LiteralPath $_.FullName -Destination (Join-Path (Get-Location) $_.Name) }
Remove-Item barber-tmp
npm install
```

Expected: `package.json` exists and `node_modules` is installed.

- [ ] **Step 2: Write the failing smoke test**

Create `src/smoke.test.ts`:

```ts
import { expect, test } from 'vitest'

test('vitest runs', () => {
  expect(true).toBe(true)
})
```

- [ ] **Step 3: Run the test and confirm it fails**

Run: `npm test`

Expected: FAIL because `vitest` is not installed (`'vitest' is not recognized` or `missing script: test`).

- [ ] **Step 4: Install Vitest and point the app at it**

```powershell
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Replace `vite.config.ts` with:

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
})
```

Create `src/test-setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})
```

In `package.json`, set the scripts:

```json
"test": "vitest run",
"dev": "vite",
"build": "tsc -b && vite build",
"preview": "vite preview"
```

Set `index.html` `<html lang="nl">` and `<title>BarberBjorn</title>`. Inside `<head>`, before the module script, add:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,560;12..96,720&family=Outfit:wght@300;400;500&display=swap" rel="stylesheet" />
```

Write `.env.example`:

```
VITE_MAPBOX_TOKEN=
```

Replace `.gitignore` with:

```
node_modules
dist
dist-ssr
*.local
.env
.env.*
!.env.example
.superpowers
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `npm test`

Expected: PASS, `vitest runs`.

- [ ] **Step 6: Commit**

```powershell
if (-not (Test-Path .git)) { git init }
git add -A
git commit -m "chore: scaffold Vite app and Vitest"
```

---

### Task 2: Prepare white logos and the portrait

**Files:**
- Create: `scripts/make-logos.py`, `public/logo-mark.png`, `public/logo-wordmark.png`, `public/portrait.png`
- Test: `src/assets.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: those three public files. Mark and wordmark are white pixels on a transparent background. Portrait is the supplied photo, unchanged.

- [ ] **Step 1: Write the failing asset test**

Create `src/assets.test.ts`:

```ts
import { statSync } from 'node:fs'
import { expect, test } from 'vitest'

test('logo and portrait files exist', () => {
  for (const file of ['public/logo-mark.png', 'public/logo-wordmark.png', 'public/portrait.png']) {
    expect(statSync(file).size).toBeGreaterThan(1000)
  }
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/assets.test.ts`

Expected: FAIL with `ENOENT`.

- [ ] **Step 3: Convert the supplied files**

Create `scripts/make-logos.py`:

```python
from PIL import Image

MARK = r"C:\Users\Paulg\.cursor\projects\d-Projects-BarberBjorn\assets\c__Users_Paulg_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_BarberBjornLogoBBSolo-e8737224-a5a8-4538-acf0-8c9b5ddcf453.png"
WORD = r"C:\Users\Paulg\.cursor\projects\d-Projects-BarberBjorn\assets\c__Users_Paulg_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_BarberBjornLogoTextSolo-7be7ffb7-413d-4862-a924-af342af4c07c.png"
PORTRAIT = r"C:\Users\Paulg\.cursor\projects\d-Projects-BarberBjorn\assets\c__Users_Paulg_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-96ad88f1-cbf5-485c-9cfb-2c0051b7b7e5.png"

def to_white(src: str, dst: str) -> None:
    image = Image.open(src).convert("RGBA")
    pixels = image.load()
    width, height = image.size
    for y in range(height):
        for x in range(width):
            r, g, b, _a = pixels[x, y]
            lum = (r + g + b) / 3
            if lum < 8:
                pixels[x, y] = (255, 255, 255, 0)
            else:
                alpha = max(0, min(255, int((lum - 6) * (255 / 30))))
                pixels[x, y] = (255, 255, 255, alpha)
    image.save(dst)

to_white(MARK, "public/logo-mark.png")
to_white(WORD, "public/logo-wordmark.png")
Image.open(PORTRAIT).save("public/portrait.png")
```

Run: `python scripts/make-logos.py`

Expected: the three files exist. The mark and wordmark look white, not dark gray.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/assets.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/make-logos.py public/logo-mark.png public/logo-wordmark.png public/portrait.png src/assets.test.ts
git commit -m "feat: add white logos and portrait"
```

---

### Task 3: Make the black-and-white hero loop

**Files:**
- Create: `scripts/make-hero.py`, `public/frames/01.png` through `public/frames/04.png`, `public/hero.mp4`
- Modify: `src/assets.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `public/hero.mp4`, silent, about 8 seconds, grayscale, larger than 10 KB.

- [ ] **Step 1: Extend the asset test**

Add this test to `src/assets.test.ts`:

```ts
test('hero video exists', () => {
  expect(statSync('public/hero.mp4').size).toBeGreaterThan(10_000)
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/assets.test.ts`

Expected: FAIL with `ENOENT` for `public/hero.mp4`. The logo test still passes.

- [ ] **Step 3: Draw four frames and encode them**

Create `scripts/make-hero.py`:

```python
from PIL import Image, ImageDraw

W, H = 1280, 720

def frame() -> Image.Image:
    image = Image.new("RGB", (W, H), (12, 12, 12))
    return image

def save(image: Image.Image, name: str) -> None:
    image.save(f"public/frames/{name}")

def chair() -> None:
    image = frame()
    draw = ImageDraw.Draw(image)
    draw.rectangle((520, 180, 760, 430), outline=(210, 210, 210), width=8)
    draw.rectangle((575, 430, 705, 560), outline=(180, 180, 180), width=8)
    draw.line((500, 560, 780, 560), fill=(160, 160, 160), width=10)
    save(image, "01.png")

def clippers() -> None:
    image = frame()
    draw = ImageDraw.Draw(image)
    draw.polygon([(470, 520), (620, 180), (700, 210), (560, 560)], outline=(220, 220, 220))
    draw.line((620, 180, 700, 210), fill=(230, 230, 230), width=14)
    save(image, "02.png")

def scissors(open_gap: int, name: str) -> None:
    image = frame()
    draw = ImageDraw.Draw(image)
    draw.line((430, 560, 760, 180), fill=(225, 225, 225), width=10)
    draw.line((430, 560, 760, 180 + open_gap), fill=(190, 190, 190), width=10)
    draw.ellipse((400, 530, 460, 590), outline=(210, 210, 210), width=6)
    save(image, name)

chair()
clippers()
scissors(220, "03.png")
scissors(40, "04.png")
```

```powershell
New-Item -ItemType Directory -Force public/frames | Out-Null
python scripts/make-hero.py
ffmpeg -version
```

If `ffmpeg` is missing, install it with `winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements`, then open a new shell so `ffmpeg` is on `PATH`.

```powershell
ffmpeg -y -framerate 1/2 -i public/frames/%02d.png -vf "scale=1280:720,format=gray,eq=brightness=-0.12:contrast=1.05" -r 24 -pix_fmt yuv420p -an public/hero.mp4
```

Expected: `public/hero.mp4` is silent, grayscale, and about 8 seconds (four frames at half a frame per second).

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/assets.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add scripts/make-hero.py public/frames public/hero.mp4 src/assets.test.ts
git commit -m "feat: add silent black-and-white hero loop"
```

---

### Task 4: Add the bilingual copy

**Files:**
- Create: `src/content.ts`
- Test: `src/content.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `export type Lang = 'nl' | 'en'`
  - `export type ServiceId = 'cut' | 'beard' | 'both'`
  - `export type Copy` with the fields used in the object below
  - `export const copy: Record<Lang, Copy>`
  - `export const CONTACT = { email: 'hallo@barberbjorn.nl', phone: '06 12 34 56 78', addressLine: 'Olivierstraat 20, Axel', addressFull: 'Olivierstraat 20, 4571 AZ Axel' }`

- [ ] **Step 1: Write the failing copy test**

Create `src/content.test.ts`:

```ts
import { expect, test } from 'vitest'
import { CONTACT, copy } from './content'

test('dutch and english carry the same keys and the locked facts', () => {
  expect(Object.keys(copy.nl).sort()).toEqual(Object.keys(copy.en).sort())
  expect(copy.nl.tagline).toBe('Een goede knip. Zonder haast.')
  expect(copy.en.tagline).toBe('A proper cut. No rush.')
  expect(copy.nl.services.map((item) => item.price)).toEqual(['€30', '€15', '€40'])
  expect(copy.en.services.map((item) => item.id)).toEqual(['cut', 'beard', 'both'])
  expect(copy.nl.days.filter((day) => day.closed).map((day) => day.key)).toEqual(['sat', 'sun'])
  expect(copy.nl.faq).toHaveLength(5)
  expect(copy.en.faq).toHaveLength(5)
  expect(CONTACT.email).toBe('hallo@barberbjorn.nl')
  expect(CONTACT.phone).toBe('06 12 34 56 78')
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/content.test.ts`

Expected: FAIL with `Cannot find module './content'`.

- [ ] **Step 3: Write the dictionary**

Create `src/content.ts`:

```ts
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
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/content.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/content.ts src/content.test.ts
git commit -m "feat: add Dutch and English copy"
```

---

### Task 5: Select the language

**Files:**
- Create: `src/language.tsx`
- Test: `src/language.test.tsx`

**Interfaces:**
- Consumes: `Lang`, `Copy`, `copy` from `src/content.ts`
- Produces:
  - `readInitialLang(search: string, stored: string | null): Lang`
  - `LanguageProvider` reading that order, writing `localStorage` key `barber-lang`, `?lang=`, and `document.documentElement.lang`
  - `useLang(): { lang: Lang, setLang: (lang: Lang) => void, t: Copy }`

- [ ] **Step 1: Write the failing language test**

Create `src/language.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { LanguageProvider, readInitialLang, useLang } from './language'

test('query wins over storage, storage wins over Dutch', () => {
  expect(readInitialLang('?lang=en', 'nl')).toBe('en')
  expect(readInitialLang('', 'en')).toBe('en')
  expect(readInitialLang('?lang=nope', 'nope')).toBe('nl')
})

function Probe() {
  const { lang, setLang, t } = useLang()
  return (
    <div>
      <p>{t.tagline}</p>
      <p>{lang}</p>
      <button type="button" onClick={() => setLang('en')}>
        EN
      </button>
    </div>
  )
}

test('switching to English updates the sentence, the url, and the document', async () => {
  window.history.replaceState(null, '', '/')
  localStorage.clear()
  render(
    <LanguageProvider>
      <Probe />
    </LanguageProvider>,
  )
  expect(screen.getByText('Een goede knip. Zonder haast.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'EN' }))
  expect(screen.getByText('A proper cut. No rush.')).toBeInTheDocument()
  expect(document.documentElement.lang).toBe('en')
  expect(localStorage.getItem('barber-lang')).toBe('en')
  expect(window.location.search).toBe('?lang=en')
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/language.test.tsx`

Expected: FAIL with `Cannot find module './language'`.

- [ ] **Step 3: Implement the provider**

Create `src/language.tsx`:

```tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { copy, type Copy, type Lang } from './content'

const STORAGE_KEY = 'barber-lang'

export function readInitialLang(search: string, stored: string | null): Lang {
  const query = new URLSearchParams(search).get('lang')
  if (query === 'nl' || query === 'en') return query
  if (stored === 'nl' || stored === 'en') return stored
  return 'nl'
}

type LanguageValue = { lang: Lang; setLang: (lang: Lang) => void; t: Copy }

const LanguageContext = createContext<LanguageValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() =>
    readInitialLang(window.location.search, localStorage.getItem(STORAGE_KEY)),
  )

  const setLang = (next: Lang) => {
    setLangState(next)
    localStorage.setItem(STORAGE_KEY, next)
    const url = new URL(window.location.href)
    url.searchParams.set('lang', next)
    window.history.replaceState(null, '', url)
    document.documentElement.lang = next
  }

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo(() => ({ lang, setLang, t: copy[lang] }), [lang])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLang(): LanguageValue {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('useLang must be used inside LanguageProvider')
  return value
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/language.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/language.tsx src/language.test.tsx
git commit -m "feat: switch the page between Dutch and English"
```

---

### Task 6: Validate a booking request

**Files:**
- Create: `src/booking.ts`
- Test: `src/booking.test.ts`

**Interfaces:**
- Consumes: `Copy`, `ServiceId` from `src/content.ts`
- Produces:
  - `export type BookingInput = { service: ServiceId | ''; name: string; phone: string; day: string }`
  - `export type BookingResult = { ok: true; subject: string; body: string } | { ok: false; errors: Partial<Record<'service' | 'name' | 'phone' | 'day', string>> }`
  - `validateBooking(input: BookingInput, t: Copy, todayIso: string): BookingResult`
  - `mailtoHref(email: string, subject: string, body: string): string`

- [ ] **Step 1: Write the failing booking test**

Create `src/booking.test.ts`:

```ts
import { expect, test } from 'vitest'
import { mailtoHref, validateBooking } from './booking'
import { copy } from './content'

const today = '2026-10-05' // a Monday

test('rejects empty fields, past dates, and weekends', () => {
  const empty = validateBooking({ service: '', name: ' ', phone: '12', day: '' }, copy.nl, today)
  expect(empty.ok).toBe(false)
  if (!empty.ok) {
    expect(empty.errors.service).toBe('Vul dit nog even in.')
    expect(empty.errors.name).toBe('Vul dit nog even in.')
    expect(empty.errors.phone).toBe('Vul dit nog even in.')
    expect(empty.errors.day).toBe('Vul dit nog even in.')
  }

  const past = validateBooking({ service: 'cut', name: 'Bjorn', phone: '0612345678', day: '2026-10-04' }, copy.nl, today)
  expect(past.ok).toBe(false)
  if (!past.ok) expect(past.errors.day).toBe('Die dag is al geweest. Kies vandaag of later.')

  const saturday = validateBooking({ service: 'cut', name: 'Bjorn', phone: '0612345678', day: '2026-10-10' }, copy.en, today)
  expect(saturday.ok).toBe(false)
  if (!saturday.ok) expect(saturday.errors.day).toBe('Saturday and Sunday the chair is closed. Pick a weekday.')
})

test('builds a Dutch mailto body without storing anything', () => {
  const result = validateBooking(
    { service: 'both', name: '  Sam  ', phone: '06 12 34 56 78', day: '2026-10-06' },
    copy.nl,
    today,
  )
  expect(result.ok).toBe(true)
  if (result.ok) {
    expect(result.subject).toBe('Afspraak BarberBjorn')
    expect(result.body).toContain('Dienst: Allebei')
    expect(result.body).toContain('Naam: Sam')
    expect(result.body).toContain('Telefoon: 06 12 34 56 78')
    expect(result.body).toContain('Dag: 2026-10-06')
    expect(result.body).toContain('Dit is een aanvraag, nog geen bevestiging.')
    expect(mailtoHref('hallo@barberbjorn.nl', result.subject, result.body)).toContain('mailto:hallo@barberbjorn.nl')
  }
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/booking.test.ts`

Expected: FAIL with `Cannot find module './booking'`.

- [ ] **Step 3: Implement validation**

Create `src/booking.ts`:

```ts
import type { Copy, ServiceId } from './content'

export type BookingInput = {
  service: ServiceId | ''
  name: string
  phone: string
  day: string
}

type Field = 'service' | 'name' | 'phone' | 'day'

export type BookingResult =
  | { ok: true; subject: string; body: string }
  | { ok: false; errors: Partial<Record<Field, string>> }

function isService(value: string): value is ServiceId {
  return value === 'cut' || value === 'beard' || value === 'both'
}

export function validateBooking(input: BookingInput, t: Copy, todayIso: string): BookingResult {
  const errors: Partial<Record<Field, string>> = {}
  if (!isService(input.service)) errors.service = t.fieldError
  if (input.name.trim().length < 2) errors.name = t.fieldError
  if (input.phone.replace(/\D/g, '').length < 8) errors.phone = t.fieldError

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day)) {
    errors.day = t.fieldError
  } else if (input.day < todayIso) {
    errors.day = t.pastError
  } else {
    const weekday = new Date(`${input.day}T12:00:00`).getDay()
    if (weekday === 0 || weekday === 6) errors.day = t.weekendError
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  const serviceName = t.services.find((item) => item.id === input.service)?.name ?? ''
  const body = [
    `${t.serviceLabel}: ${serviceName}`,
    `${t.nameLabel}: ${input.name.trim()}`,
    `${t.phoneLabel}: ${input.phone.trim()}`,
    `${t.dayLabel}: ${input.day}`,
    '',
    t.requestNote,
  ].join('\n')
  return { ok: true, subject: t.mailSubject, body }
}

export function mailtoHref(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function todayIso(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/booking.test.ts`

Expected: PASS. `2026-10-10` is a Saturday. `2026-10-06` is a Tuesday.

- [ ] **Step 5: Commit**

```powershell
git add src/booking.ts src/booking.test.ts
git commit -m "feat: validate booking requests before mailto"
```

---

### Task 7: Add the visual shell

**Files:**
- Create: `src/styles.css`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: global CSS variables `--ink`, `--ink-deep`, `--about`, `--paper`, `--paper-warm`, `--yellow`, and a border-box reset. `main.tsx` imports `./styles.css`.

- [ ] **Step 1: Write the failing shell test**

Create `src/shell.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

test('the shell defines the locked colors and no radius tokens', () => {
  const css = readFileSync('src/styles.css', 'utf8')
  expect(css).toContain('--yellow: #f5c400')
  expect(css).toContain('--paper: #efece4')
  expect(css).toContain('--paper-warm: #e4dfd4')
  expect(css).toContain('--about: #2a2a2a')
  expect(css).toContain('--ink: #101010')
  expect(css).not.toMatch(/border-radius:\s*[1-9]/)
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/shell.test.ts`

Expected: FAIL with `ENOENT` for `src/styles.css`.

- [ ] **Step 3: Add the stylesheet and import it**

Create `src/styles.css`:

```css
:root {
  --ink: #101010;
  --ink-deep: #070707;
  --about: #2a2a2a;
  --paper: #efece4;
  --paper-warm: #e4dfd4;
  --yellow: #f5c400;
  --text: #161616;
  --text-on-dark: #f4f1ea;
  --font-display: "Bricolage Grotesque", sans-serif;
  --font-body: Outfit, sans-serif;
}

* { box-sizing: border-box; }
html, body, #root { margin: 0; min-height: 100%; }
body {
  background: var(--paper);
  color: var(--text);
  font-family: var(--font-body);
  font-weight: 300;
}
button, input, select { font: inherit; }
img, video { max-width: 100%; display: block; }
:focus-visible { outline: 2px solid var(--yellow); outline-offset: 3px; }
```

In `src/main.tsx`, add `import './styles.css'` next to the existing CSS import. Remove the Vite template `src/index.css` import and delete `src/index.css` and `src/App.css` if the template created them. `App.tsx` may still be the template; leave it until Task 18.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/shell.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/styles.css src/main.tsx src/shell.test.ts
git commit -m "feat: set the black, paper, and yellow shell"
```

---

### Task 8: Play the splash once

**Files:**
- Create: `src/components/Splash.tsx`
- Modify: `src/styles.css`
- Test: `src/components/Splash.test.tsx`

**Interfaces:**
- Consumes: public logo files
- Produces: `Splash({ onDone }: { onDone: () => void })`. Calls `onDone` immediately when `prefers-reduced-motion: reduce` matches. Otherwise calls `onDone` when the `splash-wipe` animation ends.

- [ ] **Step 1: Write the failing splash test**

Create `src/components/Splash.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { Splash } from './Splash'

function setMotion(reduce: boolean) {
  window.matchMedia = (query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

test('reduced motion skips the splash', () => {
  setMotion(true)
  const onDone = vi.fn()
  const { container } = render(<Splash onDone={onDone} />)
  expect(onDone).toHaveBeenCalledOnce()
  expect(container).toBeEmptyDOMElement()
})

test('the wipe ending reveals the page', () => {
  setMotion(false)
  const onDone = vi.fn()
  render(<Splash onDone={onDone} />)
  expect(screen.getByRole('img', { name: 'BarberBjorn' })).toBeInTheDocument()
  const curtain = document.querySelector('.splash-curtain') as HTMLElement
  const event = new Event('animationend', { bubbles: true })
  Object.defineProperty(event, 'animationName', { value: 'splash-wipe' })
  curtain.dispatchEvent(event)
  expect(onDone).toHaveBeenCalledOnce()
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/components/Splash.test.tsx`

Expected: FAIL with `Cannot find module './Splash'`.

- [ ] **Step 3: Implement the splash**

Create `src/components/Splash.tsx`:

```tsx
import { useEffect } from 'react'

type Props = { onDone: () => void }

export function Splash({ onDone }: Props) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (reduce) onDone()
  }, [reduce, onDone])

  if (reduce) return null

  return (
    <div className="splash">
      <div
        className="splash-curtain"
        onAnimationEnd={(event) => {
          if (event.animationName === 'splash-wipe') onDone()
        }}
      />
      <div className="splash-lockup">
        <img className="splash-mark" src="/logo-mark.png" alt="" />
        <div className="splash-meet" />
        <img className="splash-word" src="/logo-wordmark.png" alt="BarberBjorn" />
      </div>
    </div>
  )
}
```

Append to `src/styles.css`:

```css
.splash { position: fixed; inset: 0; z-index: 30; }
.splash-curtain {
  position: absolute; inset: 0; background: var(--ink-deep);
  animation: splash-wipe 4.2s cubic-bezier(.65, 0, .2, 1) forwards;
}
.splash-lockup {
  position: absolute; inset: 0; z-index: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  animation: splash-hide 4.2s linear forwards;
}
.splash-mark { width: min(340px, 70vw); animation: splash-mark 4.2s cubic-bezier(.16, .84, .24, 1) forwards; }
.splash-word { width: min(440px, 86vw); animation: splash-word 4.2s cubic-bezier(.16, .84, .24, 1) forwards; }
.splash-meet {
  width: 84px; height: 3px; margin: 10px 0 12px; background: var(--yellow);
  transform: scaleX(0); animation: splash-line 4.2s ease forwards;
}
@keyframes splash-mark {
  0%, 6% { opacity: 0; transform: translateY(-64px); }
  26%, 68% { opacity: 1; transform: translateY(0); }
  82%, 100% { opacity: 0; transform: translateY(-24px); }
}
@keyframes splash-word {
  0%, 16% { opacity: 0; transform: translateY(72px); }
  38%, 68% { opacity: 1; transform: translateY(0); }
  82%, 100% { opacity: 0; transform: translateY(28px); }
}
@keyframes splash-line {
  0%, 30% { transform: scaleX(0); opacity: 0; }
  46%, 68% { transform: scaleX(1); opacity: 1; }
  80%, 100% { transform: scaleX(0); opacity: 0; }
}
@keyframes splash-wipe {
  0%, 68% { transform: translateY(0); }
  100% { transform: translateY(-110%); }
}
@keyframes splash-hide {
  0%, 74% { opacity: 1; }
  86%, 100% { opacity: 0; }
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/components/Splash.test.tsx`

Expected: PASS. The test dispatches a plain `Event` with `animationName` set to `splash-wipe`. React's `onAnimationEnd` reads that property.

- [ ] **Step 5: Commit**

```powershell
git add src/components/Splash.tsx src/components/Splash.test.tsx src/styles.css
git commit -m "feat: open the site with the logo splash"
```

---

### Task 9: Add the fixed language switch

**Files:**
- Create: `src/components/LanguageSwitch.tsx`
- Modify: `src/styles.css`
- Test: `src/components/LanguageSwitch.test.tsx`

**Interfaces:**
- Consumes: `useLang()`
- Produces: `LanguageSwitch({ hidden }: { hidden?: boolean })`. Two buttons named `NL` and `EN`. The active one has `aria-pressed="true"`.

- [ ] **Step 1: Write the failing switch test**

Create `src/components/LanguageSwitch.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { LanguageProvider } from '../language'
import { LanguageSwitch } from './LanguageSwitch'

test('NL is pressed first and EN switches the language', async () => {
  window.history.replaceState(null, '', '/')
  localStorage.clear()
  render(
    <LanguageProvider>
      <LanguageSwitch />
    </LanguageProvider>,
  )
  expect(screen.getByRole('button', { name: 'NL' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(screen.getByRole('button', { name: 'EN' }))
  expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true')
})

test('a hidden switch is not shown', () => {
  render(
    <LanguageProvider>
      <LanguageSwitch hidden />
    </LanguageProvider>,
  )
  expect(screen.queryByRole('button', { name: 'NL' })).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/components/LanguageSwitch.test.tsx`

Expected: FAIL with `Cannot find module './LanguageSwitch'`.

- [ ] **Step 3: Implement the switch**

Create `src/components/LanguageSwitch.tsx`:

```tsx
import { useLang } from '../language'
import type { Lang } from '../content'

export function LanguageSwitch({ hidden = false }: { hidden?: boolean }) {
  const { lang, setLang } = useLang()
  if (hidden) return null
  const button = (code: Lang) => (
    <button
      type="button"
      className={lang === code ? 'is-on' : undefined}
      aria-pressed={lang === code}
      onClick={() => setLang(code)}
    >
      {code.toUpperCase()}
    </button>
  )
  return (
    <div className="lang-switch">
      {button('nl')}
      {button('en')}
    </div>
  )
}
```

Append to `src/styles.css`:

```css
.lang-switch {
  position: fixed; top: 16px; right: 16px; z-index: 20; display: flex;
}
.lang-switch button {
  min-width: 44px; min-height: 44px; cursor: pointer;
  color: var(--ink); border: 1px solid var(--ink); background: var(--paper);
}
.lang-switch button.is-on {
  background: var(--yellow); color: var(--ink); border-color: var(--yellow);
  clip-path: polygon(0 0, 100% 0, 86% 100%, 0 100%);
}
.lang-switch button:last-child {
  margin-left: -6px;
  clip-path: polygon(14% 0, 100% 0, 100% 100%, 0 100%);
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/components/LanguageSwitch.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/components/LanguageSwitch.tsx src/components/LanguageSwitch.test.tsx src/styles.css
git commit -m "feat: add the fixed Dutch and English switch"
```

---

### Task 10: Build the hero

**Files:**
- Create: `src/components/Hero.tsx`
- Modify: `src/styles.css`
- Test: `src/components/Hero.test.tsx`

**Interfaces:**
- Consumes: `useLang()`, `MapPanel` is not required yet. This task renders a `div` with `data-testid="map-slot"` where the map will go.
- Produces: `Hero()`. Wordmark image alt `BarberBjorn`, the active tagline, and a link named with `t.bookCta` pointing at `#afspraak`. A video error hides the video and leaves the copy.

- [ ] **Step 1: Write the failing hero test**

Create `src/components/Hero.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { LanguageProvider } from '../language'
import { Hero } from './Hero'

function renderHero(search = '') {
  window.history.replaceState(null, '', `/${search}`)
  localStorage.clear()
  return render(
    <LanguageProvider>
      <Hero />
    </LanguageProvider>,
  )
}

test('shows the Dutch line and a link to the form', () => {
  renderHero()
  expect(screen.getByRole('img', { name: 'BarberBjorn' })).toHaveAttribute('src', '/logo-wordmark.png')
  expect(screen.getByText('Een goede knip. Zonder haast.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Afspraak maken' })).toHaveAttribute('href', '#afspraak')
})

test('a video error keeps the copy', () => {
  renderHero()
  fireEvent.error(document.querySelector('video') as HTMLVideoElement)
  expect(document.querySelector('video')).toBeNull()
  expect(screen.getByText('Een goede knip. Zonder haast.')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/components/Hero.test.tsx`

Expected: FAIL with `Cannot find module './Hero'`.

- [ ] **Step 3: Implement the hero**

Create `src/components/Hero.tsx`:

```tsx
import { useState } from 'react'
import { useLang } from '../language'

export function Hero() {
  const { t } = useLang()
  const [videoOn, setVideoOn] = useState(true)

  return (
    <header className="hero">
      {videoOn && (
        <video
          className="hero-video"
          src="/hero.mp4"
          muted
          loop
          playsInline
          autoPlay
          onError={() => setVideoOn(false)}
        />
      )}
      <div className="hero-scrim" />
      <div className="hero-copy">
        <img src="/logo-wordmark.png" alt="BarberBjorn" />
        <p>{t.tagline}</p>
        <a className="book-link" href="#afspraak">{t.bookCta}</a>
      </div>
      <div className="hero-map" data-testid="map-slot" />
    </header>
  )
}
```

Append to `src/styles.css`:

```css
.hero {
  position: relative; min-height: 100vh; display: grid;
  grid-template-columns: 1.15fr 0.85fr; background: var(--ink-deep); color: var(--text-on-dark);
}
.hero-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: grayscale(1); }
.hero-scrim {
  position: absolute; inset: 0;
  background: linear-gradient(90deg, rgba(0,0,0,.72), rgba(0,0,0,.28) 55%, rgba(0,0,0,.45));
}
.hero-copy { position: relative; z-index: 1; align-self: center; padding: 12vh 8vw 8vh; }
.hero-copy img { width: min(520px, 100%); }
.hero-copy p { font-size: 1.2rem; margin: 16px 0 22px; }
.book-link {
  display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px;
  background: var(--yellow); color: var(--ink); text-decoration: none; font-weight: 500;
}
.hero-map {
  position: relative; z-index: 1; min-height: 100%;
  background: #141414;
  clip-path: polygon(16% 0, 100% 0, 100% 100%, 0 100%);
  border-left: 3px solid var(--yellow);
}
@media (max-width: 800px) {
  .hero { grid-template-columns: 1fr; min-height: auto; }
  .hero-copy { padding: 96px 20px 28px; }
  .hero-map {
    min-height: 240px;
    clip-path: polygon(0 0, 100% 0, 100% 100%, 12% 100%);
    border-left: 0; border-top: 3px solid var(--yellow);
  }
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/components/Hero.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/components/Hero.tsx src/components/Hero.test.tsx src/styles.css
git commit -m "feat: add the diagonal hero and booking link"
```

---

### Task 11: Add the Mapbox panel

**Files:**
- Create: `src/pin.ts`, `src/components/MapPanel.tsx`
- Modify: `src/components/Hero.tsx`, `src/main.tsx`
- Test: `src/components/MapPanel.test.tsx`

**Interfaces:**
- Consumes: `CONTACT.addressFull`, `useLang().lang`, `import.meta.env.VITE_MAPBOX_TOKEN`
- Produces:
  - `FALLBACK_PIN = { lng: 3.918996, lat: 51.26381 }`
  - `MapPanel()`. Without a token, renders the address text and no `.mapboxgl-map`. With a token, constructs a map with style `mapbox://styles/mapbox/dark-v11`, `cooperativeGestures: true`, a yellow marker, and `map.setLanguage(lang)`.

- [ ] **Step 1: Write the failing map test**

Create `src/components/MapPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { LanguageProvider } from '../language'
import { MapPanel } from './MapPanel'

test('without a token the address is text', () => {
  render(
    <LanguageProvider>
      <MapPanel />
    </LanguageProvider>,
  )
  expect(screen.getByText('Olivierstraat 20, 4571 AZ Axel')).toBeInTheDocument()
  expect(document.querySelector('.mapboxgl-map')).toBeNull()
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/components/MapPanel.test.tsx`

Expected: FAIL with `Cannot find module './MapPanel'`.

- [ ] **Step 3: Install Mapbox and render the fallback or the map**

```powershell
npm install mapbox-gl
```

Create `src/pin.ts`:

```ts
export const FALLBACK_PIN = { lng: 3.918996, lat: 51.26381 }
```

Create `scripts/geocode.mjs`:

```js
import { readFileSync, writeFileSync } from 'node:fs'

const token = process.env.VITE_MAPBOX_TOKEN
if (!token) {
  console.log('no token, keeping street-center pin')
  process.exit(0)
}

const address = 'Olivierstraat 20, 4571 AZ Axel'
const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}&limit=1`
const response = await fetch(url)
const data = await response.json()
const center = data.features?.[0]?.center
if (!center) {
  console.log('house not found, keeping street-center pin')
  process.exit(0)
}

const [lng, lat] = center
const file = 'src/pin.ts'
const source = readFileSync(file, 'utf8')
writeFileSync(file, source.replace(/lng: [^,]+, lat: [^ }]+/, `lng: ${lng}, lat: ${lat}`))
console.log(`pin set to ${lng}, ${lat}`)
```

Append to `src/test-setup.ts`:

```ts
import { vi } from 'vitest'

vi.mock('mapbox-gl', () => {
  class Map {
    on() {}
    remove() {}
    setLanguage() {}
  }
  class Marker {
    setLngLat() { return this }
    addTo() { return this }
  }
  return { default: { accessToken: '', Map, Marker } }
})
```

Run the geocoder. It keeps the street center when no token is set:

```powershell
node scripts/geocode.mjs
```

Expected output is `no token, keeping street-center pin`, or `pin set to <lng>, <lat>` when `VITE_MAPBOX_TOKEN` is present and the house is found.

Create `src/components/MapPanel.tsx`:

```tsx
import mapboxgl from 'mapbox-gl'
import { useEffect, useRef, useState } from 'react'
import { CONTACT } from '../content'
import { useLang } from '../language'
import { FALLBACK_PIN } from '../pin'

const token = import.meta.env.VITE_MAPBOX_TOKEN

export function MapPanel() {
  const { lang } = useLang()
  const node = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(!token)

  useEffect(() => {
    if (!token || !node.current) return
    mapboxgl.accessToken = token
    const map = new mapboxgl.Map({
      container: node.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [FALLBACK_PIN.lng, FALLBACK_PIN.lat],
      zoom: 15,
      cooperativeGestures: true,
    })
    const marker = document.createElement('div')
    marker.style.width = '14px'
    marker.style.height = '14px'
    marker.style.background = '#f5c400'
    marker.style.clipPath = 'polygon(50% 0, 100% 100%, 0 100%)'
    new mapboxgl.Marker({ element: marker }).setLngLat([FALLBACK_PIN.lng, FALLBACK_PIN.lat]).addTo(map)
    map.on('load', () => {
      map.setLanguage(lang)
    })
    map.on('error', () => setFailed(true))
    return () => map.remove()
  }, [lang])

  if (failed) return <p className="map-fallback">{CONTACT.addressFull}</p>
  return <div ref={node} className="map-canvas" />
}
```

In `src/main.tsx` add `import 'mapbox-gl/dist/mapbox-gl.css'`.

In `src/components/Hero.tsx`, replace `<div className="hero-map" data-testid="map-slot" />` with:

```tsx
<div className="hero-map">
  <MapPanel />
</div>
```

Import `MapPanel` from `./MapPanel`.

Append to `src/styles.css`:

```css
.map-canvas { position: absolute; inset: 0; }
.map-fallback { margin: 0; padding: 24px; color: var(--text-on-dark); }
```

`setLanguage` exists on Mapbox GL JS v3. If the installed types omit it, add this next to the import:

```ts
declare module 'mapbox-gl' {
  interface Map {
    setLanguage(language: string): void
  }
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/components/MapPanel.test.tsx src/components/Hero.test.tsx`

Expected: PASS. The hero test still finds the tagline. No token is set in Vitest, so the map stays text.

- [ ] **Step 5: Commit**

```powershell
git add package.json package-lock.json src/pin.ts src/components/MapPanel.tsx src/components/MapPanel.test.tsx src/components/Hero.tsx src/main.tsx src/styles.css
git commit -m "feat: show Axel on a dark Mapbox map"
```

---

### Task 12: Add the booking form

**Files:**
- Create: `src/components/BookingForm.tsx`
- Modify: `src/styles.css`
- Test: `src/components/BookingForm.test.tsx`

**Interfaces:**
- Consumes: `validateBooking`, `mailtoHref`, `todayIso`, `CONTACT.email`, `useLang()`
- Produces: `BookingForm()` with `id="afspraak"`. Fields: service select, name, phone, `input type="date"`. Submit calls `validateBooking`. On success, sets `window.location.href` to the mailto link. On failure, shows the error string for that field.

- [ ] **Step 1: Write the failing form test**

Create `src/components/BookingForm.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { LanguageProvider } from '../language'
import { BookingForm } from './BookingForm'

test('an empty submit shows the Dutch hint and does not navigate', async () => {
  const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {})
  render(
    <LanguageProvider>
      <BookingForm />
    </LanguageProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Verstuur' }))
  expect(screen.getAllByText('Vul dit nog even in.').length).toBeGreaterThan(0)
  expect(assign).not.toHaveBeenCalled()
})

test('a valid weekday opens a mailto', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T12:00:00'))
  const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {})
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(
    <LanguageProvider>
      <BookingForm />
    </LanguageProvider>,
  )
  await user.selectOptions(screen.getByLabelText('Dienst'), 'cut')
  await user.type(screen.getByLabelText('Naam'), 'Sam')
  await user.type(screen.getByLabelText('Telefoon'), '0612345678')
  fireEvent.change(screen.getByLabelText('Dag'), { target: { value: '2026-10-06' } })
  await user.click(screen.getByRole('button', { name: 'Verstuur' }))
  expect(assign).toHaveBeenCalled()
  expect(String(assign.mock.calls[0][0])).toContain('mailto:hallo@barberbjorn.nl')
  vi.useRealTimers()
})
```

Add `fireEvent` to the import from `@testing-library/react`.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/components/BookingForm.test.tsx`

Expected: FAIL with `Cannot find module './BookingForm'`.

- [ ] **Step 3: Implement the form**

Create `src/components/BookingForm.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import { mailtoHref, todayIso, validateBooking, type BookingInput } from '../booking'
import { CONTACT } from '../content'
import { useLang } from '../language'

const empty: BookingInput = { service: '', name: '', phone: '', day: '' }

export function BookingForm() {
  const { t } = useLang()
  const [input, setInput] = useState<BookingInput>(empty)
  const [errors, setErrors] = useState<Partial<Record<keyof BookingInput, string>>>({})
  const [fallback, setFallback] = useState('')

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const result = validateBooking(input, t, todayIso())
    if (!result.ok) {
      setErrors(result.errors)
      setFallback('')
      return
    }
    setErrors({})
    const href = mailtoHref(CONTACT.email, result.subject, result.body)
    try {
      window.location.assign(href)
    } catch {
      setFallback(`${t.mailFallback}\n${CONTACT.email}\n${result.body}`)
    }
  }

  return (
    <section id="afspraak" className="booking">
      <div>
        <p className="kicker">{t.bookKicker}</p>
        <h2>{t.bookTitle}</h2>
        <p>{t.bookIntro}</p>
      </div>
      <form onSubmit={onSubmit}>
        <label>
          {t.serviceLabel}
          <select
            value={input.service}
            onChange={(event) => setInput({ ...input, service: event.target.value as BookingInput['service'] })}
          >
            <option value="">{t.serviceLabel}</option>
            {t.services.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          {errors.service && <span role="alert">{errors.service}</span>}
        </label>
        <label>
          {t.nameLabel}
          <input value={input.name} onChange={(event) => setInput({ ...input, name: event.target.value })} />
          {errors.name && <span role="alert">{errors.name}</span>}
        </label>
        <label>
          {t.phoneLabel}
          <input value={input.phone} inputMode="tel" onChange={(event) => setInput({ ...input, phone: event.target.value })} />
          {errors.phone && <span role="alert">{errors.phone}</span>}
        </label>
        <label>
          {t.dayLabel}
          <input type="date" value={input.day} onChange={(event) => setInput({ ...input, day: event.target.value })} />
          {errors.day && <span role="alert">{errors.day}</span>}
        </label>
        <button type="submit">{t.sendLabel}</button>
        {fallback && <p role="alert">{fallback}</p>}
      </form>
    </section>
  )
}
```

Append to `src/styles.css`:

```css
.booking {
  background: var(--ink); color: var(--text-on-dark);
  display: grid; grid-template-columns: 0.8fr 1.2fr; gap: 24px;
  padding: 48px 8vw 64px;
  clip-path: polygon(0 0, 100% 0, 100% 88%, 0 100%);
  scroll-margin-top: 72px;
}
.kicker { letter-spacing: 0.18em; font-size: 0.72rem; margin: 0 0 8px; }
.booking h2 { font-family: var(--font-display); font-weight: 720; letter-spacing: -0.04em; margin: 0 0 8px; }
.booking form { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; }
.booking label { display: flex; flex-direction: column; gap: 4px; min-width: 140px; }
.booking input, .booking select, .booking button {
  min-height: 44px; background: transparent; color: var(--text-on-dark);
  border: 1px solid rgba(255,255,255,.35); padding: 0 10px;
  clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
}
.booking button { background: var(--yellow); color: var(--ink); border: 0; cursor: pointer; font-weight: 500; }
.booking [role="alert"] { color: var(--yellow); }
@media (max-width: 800px) {
  .booking { grid-template-columns: 1fr; padding: 32px 20px 48px; }
  .booking form { flex-direction: column; align-items: stretch; }
  .booking button { width: 100%; }
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/components/BookingForm.test.tsx`

Expected: PASS. The date field is set with `fireEvent.change` because jsdom does not type into `input[type=date]`.

- [ ] **Step 5: Commit**

```powershell
git add src/components/BookingForm.tsx src/components/BookingForm.test.tsx src/styles.css
git commit -m "feat: open a mailto from the booking form"
```

---

### Task 13: Add the three service plates

**Files:**
- Create: `src/components/Services.tsx`
- Modify: `src/styles.css`
- Test: `src/components/Services.test.tsx`

**Interfaces:**
- Consumes: `useLang()`
- Produces: `Services()` rendering three articles. The `both` article has class `is-both`.

- [ ] **Step 1: Write the failing services test**

Create `src/components/Services.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { LanguageProvider } from '../language'
import { Services } from './Services'

test('lists the three prices with the combo marked', () => {
  render(<LanguageProvider><Services /></LanguageProvider>)
  expect(screen.getByText('€30')).toBeInTheDocument()
  expect(screen.getByText('€15')).toBeInTheDocument()
  expect(screen.getByText('€40')).toBeInTheDocument()
  expect(document.querySelector('.is-both')).toHaveTextContent('Allebei')
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/components/Services.test.tsx`

Expected: FAIL with `Cannot find module './Services'`.

- [ ] **Step 3: Implement the plates**

Create `src/components/Services.tsx`:

```tsx
import { useLang } from '../language'

export function Services() {
  const { t } = useLang()
  return (
    <section className="services">
      <p className="kicker">{t.servicesKicker}</p>
      <div className="plates">
        {t.services.map((item) => (
          <article key={item.id} className={item.id === 'both' ? 'is-both' : undefined}>
            <strong>{item.price}</strong>
            <h3>{item.name}</h3>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
```

Append to `src/styles.css`:

```css
.services { background: var(--paper); padding: 72px 8vw; }
.services .kicker { color: var(--text); }
.plates { display: flex; align-items: stretch; gap: 14px; }
.plates article {
  flex: 1; min-height: 280px; background: var(--ink); color: var(--text-on-dark);
  padding: 22px 18px; display: flex; flex-direction: column; justify-content: space-between;
  clip-path: polygon(0 0, 100% 0, 88% 100%, 0 100%);
}
.plates article:nth-child(2) { clip-path: polygon(10% 0, 100% 0, 100% 100%, 0 100%); }
.plates strong { font-family: var(--font-display); font-size: 4rem; letter-spacing: -0.06em; line-height: 0.8; }
.plates h3 { margin: 0; font-weight: 500; }
.plates p { margin: 6px 0 0; }
.plates .is-both { background: var(--yellow); color: var(--ink); clip-path: polygon(12% 0, 100% 0, 100% 100%, 0 100%); }
@media (max-width: 800px) {
  .plates { flex-direction: column; }
  .plates article, .plates .is-both { min-height: 0; }
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/components/Services.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/components/Services.tsx src/components/Services.test.tsx src/styles.css
git commit -m "feat: show the three cut prices"
```

---

### Task 14: Add opening hours

**Files:**
- Create: `src/components/Hours.tsx`
- Modify: `src/styles.css`
- Test: `src/components/Hours.test.tsx`

**Interfaces:**
- Consumes: `useLang()`
- Produces: `Hours()` with seven elements. Closed days include `t.closedLabel`. The time string is visible, and the dash sits in an element with class `hours-dash`.

- [ ] **Step 1: Write the failing hours test**

Create `src/components/Hours.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { LanguageProvider } from '../language'
import { Hours } from './Hours'

test('weekdays share one time and the weekend is closed', () => {
  render(<LanguageProvider><Hours /></LanguageProvider>)
  expect(screen.getByText(/09:00/)).toBeInTheDocument()
  expect(screen.getByText(/18:00/)).toBeInTheDocument()
  expect(screen.getAllByText('dicht')).toHaveLength(2)
  expect(document.querySelectorAll('.hours-day')).toHaveLength(7)
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/components/Hours.test.tsx`

Expected: FAIL with `Cannot find module './Hours'`.

- [ ] **Step 3: Implement the seven cuts**

Create `src/components/Hours.tsx`:

```tsx
import { useLang } from '../language'

export function Hours() {
  const { t } = useLang()
  const [start, end] = t.hoursTime.split(' — ')
  return (
    <section className="hours">
      <p className="hours-time">
        {start} <span className="hours-dash">—</span> {end}
      </p>
      <div className="hours-row">
        {t.days.map((day) => (
          <div key={day.key} className={day.closed ? 'hours-day is-closed' : 'hours-day'}>
            <span>{day.label}</span>
            {day.closed && <span>{t.closedLabel}</span>}
          </div>
        ))}
      </div>
    </section>
  )
}
```

Append to `src/styles.css`:

```css
.hours { background: var(--paper-warm); padding: 28px 8vw 72px; }
.hours-time { font-family: var(--font-display); font-size: 2rem; letter-spacing: -0.04em; margin: 0 0 12px; }
.hours-dash { color: var(--yellow); }
.hours-row { display: flex; }
.hours-day {
  flex: 1; min-height: 120px; margin-right: -8px;
  background: var(--ink); color: var(--paper);
  display: flex; flex-direction: column; justify-content: flex-end; align-items: center;
  padding-bottom: 12px; text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.78rem;
  clip-path: polygon(14% 0, 100% 0, 86% 100%, 0 100%);
}
.hours-day.is-closed { background: transparent; color: #6d685f; box-shadow: inset 0 1.5px 0 var(--ink), inset 0 -1.5px 0 var(--ink); }
@media (max-width: 800px) {
  .hours { padding: 12px 16px 48px; }
  .hours-day { min-height: 88px; font-size: 0.62rem; letter-spacing: 0.04em; }
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/components/Hours.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/components/Hours.tsx src/components/Hours.test.tsx src/styles.css
git commit -m "feat: show weekday hours as seven cuts"
```

---

### Task 15: Add the about section

**Files:**
- Create: `src/components/About.tsx`
- Modify: `src/styles.css`
- Test: `src/components/About.test.tsx`

**Interfaces:**
- Consumes: `useLang()`
- Produces: `About()` with the portrait at `/portrait.png` and the four about lines.

- [ ] **Step 1: Write the failing about test**

Create `src/components/About.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { LanguageProvider } from '../language'
import { About } from './About'

test('shows Bjorn and the four lines', () => {
  render(<LanguageProvider><About /></LanguageProvider>)
  expect(screen.getByRole('img', { name: 'Bjorn' })).toHaveAttribute('src', '/portrait.png')
  expect(screen.getByText('Alleen hij. Alle tijd.')).toBeInTheDocument()
  expect(screen.getByText('Hij knipt hier zelf. Geen tweede stoel.')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/components/About.test.tsx`

Expected: FAIL with `Cannot find module './About'`.

- [ ] **Step 3: Implement the photo and the white shard**

Create `src/components/About.tsx`:

```tsx
import { useLang } from '../language'

export function About() {
  const { t } = useLang()
  return (
    <section className="about">
      <img src="/portrait.png" alt="Bjorn" />
      <div className="about-shard">
        <p className="kicker">{t.aboutKicker}</p>
        <h2>{t.aboutTitle}</h2>
        {t.aboutLines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </section>
  )
}
```

Append to `src/styles.css`:

```css
.about {
  background: var(--about); color: var(--text-on-dark);
  display: grid; grid-template-columns: 1.05fr 0.95fr; min-height: 640px;
}
.about img {
  width: 100%; height: 100%; object-fit: cover; object-position: 62% 18%;
  -webkit-mask-image: linear-gradient(90deg, #000 40%, transparent 96%);
  mask-image: linear-gradient(90deg, #000 40%, transparent 96%);
}
.about-shard {
  background: var(--paper); color: var(--text);
  margin: 64px 8vw 64px -40px; padding: 32px 28px 28px 36px;
  clip-path: polygon(7% 0, 100% 0, 100% 100%, 0 100%);
  align-self: center;
}
.about-shard h2 { font-family: var(--font-display); font-size: 2.4rem; letter-spacing: -0.045em; line-height: 0.95; margin: 0 0 16px; }
.about-shard p { margin: 0 0 12px; border-left: 2px solid var(--ink); padding-left: 12px; }
.about-shard .kicker { border: 0; padding: 0; color: #9a7b00; }
@media (max-width: 800px) {
  .about { grid-template-columns: 1fr; }
  .about img { height: 420px; -webkit-mask-image: linear-gradient(#000 70%, transparent); mask-image: linear-gradient(#000 70%, transparent); }
  .about-shard { margin: -48px 16px 32px; }
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/components/About.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/components/About.tsx src/components/About.test.tsx src/styles.css
git commit -m "feat: place the portrait in the about section"
```

---

### Task 16: Add the FAQ

**Files:**
- Create: `src/components/Faq.tsx`
- Modify: `src/styles.css`
- Test: `src/components/Faq.test.tsx`

**Interfaces:**
- Consumes: `useLang()`
- Produces: `Faq()` with five questions. Each answer is in the document, not behind a disclosure. Numbers are `01` through `05`.

- [ ] **Step 1: Write the failing FAQ test**

Create `src/components/Faq.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { LanguageProvider } from '../language'
import { Faq } from './Faq'

test('all five answers are visible', () => {
  render(<LanguageProvider><Faq /></LanguageProvider>)
  expect(screen.getByText('Moet ik een afspraak maken?')).toBeInTheDocument()
  expect(screen.getByText('Olivierstraat 20 in Axel. De kaart bovenaan wijst de deur.')).toBeInTheDocument()
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(5)
  expect(screen.getByText('01')).toBeInTheDocument()
  expect(screen.getByText('05')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/components/Faq.test.tsx`

Expected: FAIL with `Cannot find module './Faq'`.

- [ ] **Step 3: Implement the strips**

Create `src/components/Faq.tsx`:

```tsx
import { useLang } from '../language'

export function Faq() {
  const { t } = useLang()
  return (
    <section className="faq">
      {t.faq.map((item, index) => (
        <article key={item.q}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <div>
            <h3>{item.q}</h3>
            <p>{item.a}</p>
          </div>
        </article>
      ))}
    </section>
  )
}
```

Append to `src/styles.css`:

```css
.faq { background: var(--paper); padding: 48px 8vw 72px; display: flex; flex-direction: column; gap: 8px; }
.faq article {
  display: grid; grid-template-columns: 52px 1fr; gap: 12px;
  background: var(--ink); color: var(--text-on-dark); padding: 14px 16px;
  clip-path: polygon(0 0, 100% 0, 98.5% 100%, 0 100%);
}
.faq span { font-family: var(--font-display); color: var(--yellow); }
.faq h3 { margin: 0 0 4px; font-size: 1rem; font-weight: 500; }
.faq p { margin: 0; }
@media (max-width: 800px) {
  .faq { padding: 32px 16px 48px; }
  .faq article { grid-template-columns: 1fr; }
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/components/Faq.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/components/Faq.tsx src/components/Faq.test.tsx src/styles.css
git commit -m "feat: show five open FAQ strips"
```

---

### Task 17: Add the footer

**Files:**
- Create: `src/components/Footer.tsx`
- Modify: `src/styles.css`
- Test: `src/components/Footer.test.tsx`

**Interfaces:**
- Consumes: `CONTACT`
- Produces: `Footer()` with a mail link to `mailto:hallo@barberbjorn.nl`, a tel link to `tel:+31612345678`, and the address line.

- [ ] **Step 1: Write the failing footer test**

Create `src/components/Footer.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Footer } from './Footer'

test('shows the placeholder contact', () => {
  render(<Footer />)
  expect(screen.getByRole('link', { name: 'hallo@barberbjorn.nl' })).toHaveAttribute('href', 'mailto:hallo@barberbjorn.nl')
  expect(screen.getByRole('link', { name: '06 12 34 56 78' })).toHaveAttribute('href', 'tel:+31612345678')
  expect(screen.getByText('Olivierstraat 20, Axel')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/components/Footer.test.tsx`

Expected: FAIL with `Cannot find module './Footer'`.

- [ ] **Step 3: Implement the footer**

Create `src/components/Footer.tsx`:

```tsx
import { CONTACT } from '../content'

export function Footer() {
  return (
    <footer className="footer">
      <img src="/logo-wordmark.png" alt="BarberBjorn" />
      <p>{CONTACT.addressLine}</p>
      <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
      <a href="tel:+31612345678">{CONTACT.phone}</a>
    </footer>
  )
}
```

Append to `src/styles.css`:

```css
.footer {
  background: var(--ink); color: var(--text-on-dark);
  display: flex; justify-content: space-between; gap: 16px; align-items: end;
  padding: 36px 8vw 28px;
  clip-path: polygon(0 18%, 100% 0, 100% 100%, 0 100%);
}
.footer img { width: min(220px, 46vw); }
.footer a { color: inherit; display: block; min-height: 44px; line-height: 44px; }
@media (max-width: 800px) {
  .footer { flex-direction: column; align-items: flex-start; padding: 48px 20px 28px; }
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/components/Footer.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/components/Footer.tsx src/components/Footer.test.tsx src/styles.css
git commit -m "feat: add the footer contact"
```

---

### Task 18: Assemble the page and check both widths

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: `Splash`, `LanguageSwitch`, `LanguageProvider`, `Hero`, `BookingForm`, `Services`, `Hours`, `About`, `Faq`, `Footer`
- Produces: the page in that order. `LanguageSwitch` gets `hidden` until `Splash` calls `onDone`.

- [ ] **Step 1: Write the failing page test**

Create `src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import App from './App'

test('the page speaks Dutch and then English', async () => {
  window.history.replaceState(null, '', '/')
  localStorage.clear()
  window.matchMedia = () => ({
    matches: true,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
  render(<App />)
  expect(screen.getByText('Een goede knip. Zonder haast.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'NL' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'EN' }))
  expect(screen.getByText('A proper cut. No rush.')).toBeInTheDocument()
  expect(screen.getByText('Just him. All the time.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Book a visit' })).toHaveAttribute('href', '#afspraak')
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/App.test.tsx`

Expected: FAIL because the template `App` does not render the tagline.

- [ ] **Step 3: Compose the page**

Replace `src/App.tsx` with:

```tsx
import { useState } from 'react'
import { About } from './components/About'
import { BookingForm } from './components/BookingForm'
import { Faq } from './components/Faq'
import { Footer } from './components/Footer'
import { Hero } from './components/Hero'
import { Hours } from './components/Hours'
import { LanguageSwitch } from './components/LanguageSwitch'
import { Services } from './components/Services'
import { Splash } from './components/Splash'
import { LanguageProvider } from './language'

export default function App() {
  const [ready, setReady] = useState(false)
  return (
    <LanguageProvider>
      {!ready && <Splash onDone={() => setReady(true)} />}
      <LanguageSwitch hidden={!ready} />
      <main>
        <Hero />
        <BookingForm />
        <Services />
        <Hours />
        <About />
        <Faq />
        <Footer />
      </main>
    </LanguageProvider>
  )
}
```

Delete unused template files `src/App.css` and `src/index.css` if they are still imported. `npm test` must not fail on a missing import.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`

Expected: PASS, including `src/App.test.tsx`.

- [ ] **Step 5: Check the page in the browser**

Run: `npm run dev`

Open the printed local URL. Confirm, on a wide window and again at about 390px wide:

- The splash plays once: mark from above, wordmark from below, yellow line, then the black sheet leaves. Reload with reduced motion and the splash is absent.
- NL | EN is top-right after the splash. English changes the tagline, form, services, hours, about, and FAQ. `?lang=en` survives a reload.
- The hero video loops, muted, in black and white. The map is the right-hand cut on desktop and sits under the text on a phone. Without `VITE_MAPBOX_TOKEN`, the address `Olivierstraat 20, 4571 AZ Axel` is visible. With a token in `.env`, the dark map shows a yellow pin and the page still scrolls on a phone.
- Empty submit shows `Vul dit nog even in.` A Saturday is rejected. A weekday opens a mail draft to `hallo@barberbjorn.nl`.
- Services are three sharp plates, €40 on yellow. Hours are seven cuts, weekend hollow. About is the photo with the white shard. FAQ answers are visible. Footer shows the placeholder mail and phone.
- Nothing uses rounded corners.

- [ ] **Step 6: Commit**

```powershell
git add src/App.tsx src/App.test.tsx
git commit -m "feat: assemble the BarberBjorn landing page"
```
