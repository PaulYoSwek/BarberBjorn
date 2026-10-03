# Planning and Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded agenda and mailto form with a live Supabase-backed schedule, public booking (instant confirm + custom requests), and a mobile `/admin` dashboard with inbox, mail, and settings.

**Architecture:** Domain logic stays in tested `src` modules. Vite adds a router (`/` and `/admin`). Supabase holds hours, blocks, services, bookings, and templates. Edge functions are the only writers; the anon key can read public schedule rows. Resend sends mail from those functions. The admin password is an edge secret and an httpOnly session cookie.

**Tech Stack:** Vite, React 19, TypeScript, Vitest, Testing Library, React Router 7, Supabase (Postgres + Edge Functions), Resend.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-03-planning-admin-design.md`
- Public site visual system unchanged (ropes, hero, map, black/paper/yellow).
- Admin is paper `#f4f1ea`, white cards, 1px `#2a2a2a`, yellow `#f5c400` only on the primary action.
- Bottom tabs: Agenda · Inbox · Mail · Settings. Inbox badge = pending count.
- Email required, phone optional. Slot bookings confirm immediately. Custom requests are pending, no hold.
- Apply to upcoming weeks writes the viewed week’s weekday hours into `schedule_week` only.
- 28-day public window, 30-minute starts, overlap `[start, end)`, slot must finish before close.
- Admin copy Dutch. Public site keeps NL/EN. Auto-mail uses `bookings.lang`.
- Password and Resend keys are host secrets. Do not commit `.env` or the Mapbox token.
- Work from `D:\Projects\BarberBjorn`. PowerShell: do not chain with `&&`. Use `npx vitest run <file>`.

---

## File structure

- `src/schedule.ts` — `Schedule` grows `blocks` and `minutes`; `agendaDays` uses them.
- `src/booking.ts` — `BookingInput` gains `email` and `kind`; phone optional; custom skips the published grid.
- `src/planning.ts` — `weekHoursFromDays`, `isFree`, `fillTemplate`, `confirmPayload`.
- `src/supabase.ts` — browser client from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
- `src/planning-api.ts` — public reads + `functions.invoke` wrappers.
- `src/content.ts` — email label, custom-time copy, confirm/request success strings; prices still overridable by live services.
- `src/App.tsx` — routes only.
- `src/pages/HomePage.tsx` — current landing sections.
- `src/pages/AdminPage.tsx` — gate + shell.
- `src/components/admin/AdminGate.tsx`
- `src/components/admin/AdminShell.tsx`
- `src/components/admin/AdminAgenda.tsx`
- `src/components/admin/AdminInbox.tsx`
- `src/components/admin/AdminMail.tsx`
- `src/components/admin/AdminSettings.tsx`
- `src/styles.css` — `.admin*` rules; do not restyle the public hero.
- `supabase/migrations/20261003190000_planning.sql`
- `supabase/functions/_shared/session.ts`
- `supabase/functions/_shared/resend.ts`
- `supabase/functions/admin-login/index.ts`
- `supabase/functions/book/index.ts`
- `supabase/functions/request-custom/index.ts`
- `supabase/functions/inbox-decide/index.ts`
- `supabase/functions/send-mail/index.ts`
- `supabase/functions/admin-write/index.ts`
- `.env.example` — add empty `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

---

### Task 1: Live-shaped schedule math

**Files:**
- Modify: `src/schedule.ts`
- Test: `src/schedule.test.ts`

**Interfaces:**
- Consumes: existing `agendaDays(service, now, extra?)`
- Produces: `ScheduleBlock = { date: string; time?: string }`; `Schedule.blocks`; `Schedule.minutes`; a whole-day block closes the date; a timed block is a 30-minute hold for overlap; `minutes` overrides `SERVICE_MINUTES` when present.

- [ ] **Step 1: Write the failing tests**

Add to `src/schedule.test.ts`:

```ts
test('a whole-day block closes that date only', () => {
  const days = agendaDays('cut', saturday, {
    blocks: [{ date: '2026-10-05' }],
  })
  expect(days[2].date).toBe('2026-10-05')
  expect(days[2].closed).toBe(true)
  expect(days[3].closed).toBe(false)
})

test('a half-hour block occupies that span for overlap', () => {
  const days = agendaDays('cut', saturday, {
    blocks: [{ date: '2026-10-05', time: '12:00' }],
  })
  const monday = days[2]
  expect(monday.slots.find((slot) => slot.time === '12:00')?.taken).toBe(true)
  expect(monday.slots.find((slot) => slot.time === '11:30')?.taken).toBe(true)
  expect(monday.slots.find((slot) => slot.time === '11:00')?.taken).toBe(false)
})

test('live minutes move the last bookable start', () => {
  const days = agendaDays('cut', saturday, { minutes: { cut: 60, beard: 20, both: 60 } })
  expect(days[2].slots.at(-1)?.time).toBe('17:00')
})

test('pending-only extra bookings are not used — only the bookings array occupies', () => {
  const days = agendaDays('cut', saturday, { bookings: [] })
  expect(days[2].slots.find((slot) => slot.time === '10:00')?.taken).toBe(false)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/schedule.test.ts`

Expected: new tests FAIL (`blocks` / `minutes` ignored).

- [ ] **Step 3: Minimal implementation**

In `src/schedule.ts` extend types and `agendaDays`:

```ts
export type ScheduleBlock = { date: string; time?: string }

export type Schedule = {
  week: Record<Weekday, DayHours>
  exceptions?: Record<string, DayHours>
  blocks?: ScheduleBlock[]
  bookings?: BookingHold[]
  minutes?: Record<ServiceId, number>
}
```

`hoursFor`: if any `blocks` entry has `date` and no `time`, return `{ closed: true }`.

`holdsOn`: include each timed block as `{ start: minutesOf(time), end: start + 30 }` plus confirmed `bookings`.

`agendaDays` minutes line:

```ts
const minutes = (schedule.minutes ?? SERVICE_MINUTES)[service || 'cut']
```

Keep `exceptions` working if present (unused by admin once blocks exist).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/schedule.test.ts`

Expected: all PASS.

- [ ] **Step 5: Commit**

```
git add src/schedule.ts src/schedule.test.ts
git commit -m "feat: schedule blocks and live service minutes"
```

---

### Task 2: Booking input — email required, phone optional, custom kind

**Files:**
- Modify: `src/booking.ts`
- Modify: `src/booking.test.ts`
- Modify: `src/content.ts` (add `emailLabel`, `phoneOptional`, `customTimeCta`, `customTimeTitle`, `bookSuccess`, `requestSuccess`)
- Modify: `src/content.test.ts` if it asserts exact key lists (keys stay in sync nl/en)

**Interfaces:**
- Consumes: `validateBooking`, `agendaDays`
- Produces:

```ts
export type BookingKind = 'slot' | 'custom'
export type BookingInput = {
  service: ServiceId | ''
  name: string
  email: string
  phone: string
  slot: string
  kind: BookingKind
}
export type Field = 'service' | 'name' | 'email' | 'phone' | 'slot'
```

Phone is never required. Slot kind must be on the published free grid. Custom kind must be a future `YYYY-MM-DDTHH:mm:ss` and does not consult the grid (no taken/weekend from the template).

- [ ] **Step 1: Write the failing tests**

Replace the empty-phone expectation in `src/booking.test.ts`. New cases:

```ts
const base = {
  service: 'cut' as const,
  name: 'Sam',
  email: 'sam@mail.nl',
  phone: '',
  slot: '2026-10-06T09:00:00',
  kind: 'slot' as const,
}

test('requires email and allows an empty phone on a free slot', () => {
  const missing = validateBooking({ ...base, email: '' }, copy.nl, today)
  expect(missing.ok).toBe(false)
  if (!missing.ok) expect(missing.errors.email).toBe('Vul dit nog even in.')

  const ok = validateBooking(base, copy.nl, today)
  expect(ok.ok).toBe(true)
})

test('a custom time need not sit on the published grid', () => {
  const result = validateBooking(
    { ...base, kind: 'custom', slot: '2026-10-10T19:30:00' },
    copy.nl,
    today,
  )
  expect(result.ok).toBe(true)
})
```

Email check: must contain `@` and a `.` after it, or reuse a simple `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.

Update every existing `validateBooking({...})` call to include `email` and `kind: 'slot'`. Remove assertions that empty phone is an error.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/booking.test.ts`

Expected: FAIL on missing `email` / `kind` or still requiring phone.

- [ ] **Step 3: Minimal implementation**

In `validateBooking`:

- `if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) errors.email = t.fieldError`
- Do not validate phone length.
- If `input.kind === 'custom'`: after date format + not past, skip `agendaDays` / weekend / taken. Still require a service and name.
- If `kind === 'slot'`: keep current grid checks.
- Body lines include email and phone only when phone is non-empty.

Add the new `Copy` keys in both `nl` and `en`:

- `emailLabel`: `E-mail` / `Email`
- `phoneOptional`: `Telefoon (niet verplicht)` / `Phone (optional)`
- `customTimeCta`: `Ander tijdstip vragen` / `Request another time`
- `customTimeTitle`: `Ander tijdstip` / `Another time`
- `bookSuccess`: `Je tijd is van jou. Er gaat een mail naartoe.` / `That time is yours. A mail is on its way.`
- `requestSuccess`: `Nog geen bevestiging. Je krijgt mail als Bjorn ja of nee zegt.` / `Not confirmed yet. You will get a mail when Bjorn says yes or no.`

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/booking.test.ts src/content.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```
git add src/booking.ts src/booking.test.ts src/content.ts src/content.test.ts
git commit -m "feat: require email and allow custom time requests"
```

---

### Task 3: Planning helpers (apply week, free check, templates)

**Files:**
- Create: `src/planning.ts`
- Test: `src/planning.test.ts`

**Interfaces:**
- Consumes: `DayHours`, `Weekday`, `Schedule` from `src/schedule.ts`
- Produces:

```ts
export function weekHoursFromDays(
  days: { weekday: Weekday; hours: DayHours }[],
): Record<Weekday, DayHours>

export function isFree(start: string, minutes: number, schedule: Schedule): boolean

export function fillTemplate(
  body: string,
  vars: { name: string; service: string; date: string; time: string },
): string
```

`weekHoursFromDays` last-write-wins per weekday (a 7-day view yields the new template). `isFree` is false if `agendaDays` would mark that start taken/past/missing or the day closed. `fillTemplate` replaces `{{name}}` `{{service}}` `{{date}}` `{{time}}`.

- [ ] **Step 1: Write the failing tests**

```ts
import { expect, test } from 'vitest'
import { defaultSchedule } from './schedule'
import { fillTemplate, isFree, weekHoursFromDays } from './planning'

test('apply week keeps Saturday closed from the viewed days', () => {
  const week = weekHoursFromDays([
    { weekday: 'mon', hours: { open: '10:00', close: '16:00' } },
    { weekday: 'tue', hours: { open: '09:00', close: '18:00' } },
    { weekday: 'wed', hours: { open: '09:00', close: '18:00' } },
    { weekday: 'thu', hours: { open: '09:00', close: '18:00' } },
    { weekday: 'fri', hours: { open: '09:00', close: '18:00' } },
    { weekday: 'sat', hours: { closed: true } },
    { weekday: 'sun', hours: { closed: true } },
  ])
  expect(week.mon).toEqual({ open: '10:00', close: '16:00' })
  expect(week.sat).toEqual({ closed: true })
})

test('isFree is false on a confirmed hold and true on a pending-only world', () => {
  const taken = { ...defaultSchedule, bookings: [{ start: '2026-10-05T10:00:00', minutes: 45 }] }
  expect(isFree('2026-10-05T10:00:00', 45, taken)).toBe(false)
  expect(isFree('2026-10-05T09:00:00', 45, taken)).toBe(true)
})

test('fillTemplate substitutes the four tokens', () => {
  expect(fillTemplate('Hoi {{name}}, {{service}} op {{date}} om {{time}}.', {
    name: 'Sam', service: 'Knippen', date: '6 okt', time: '09:00',
  })).toBe('Hoi Sam, Knippen op 6 okt om 09:00.')
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/planning.test.ts`

Expected: FAIL cannot find module.

- [ ] **Step 3: Implement `src/planning.ts`**

`isFree`: parse `start` date, call `agendaDays` with a dummy service whose minutes equal `minutes` by passing `schedule.minutes` mapped onto `cut`, or add an optional minutes argument — simplest: `agendaDays('cut', new Date(start.slice(0,10)+'T00:00:00'), { ...schedule, minutes: { cut: minutes, beard: minutes, both: minutes } })`, find the slot, return `!!found && !found.taken && !found.past`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/planning.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```
git add src/planning.ts src/planning.test.ts
git commit -m "feat: week apply, free check, and mail tokens"
```

---

### Task 4: Supabase schema

**Files:**
- Create: `supabase/migrations/20261003190000_planning.sql`
- Modify: `.env.example` (add `VITE_SUPABASE_URL=` and `VITE_SUPABASE_ANON_KEY=`)

**Interfaces:**
- Produces tables: `schedule_week`, `schedule_blocks`, `services`, `bookings`, `mail_templates`. RLS: anon SELECT on week, blocks, services, and `bookings` columns `start, minutes, status` only via a view `booking_occupancy` (`start`, `minutes` where `status = 'confirmed'`). No anon SELECT of names/emails. All writes denied to anon.

- [ ] **Step 1: Write the migration** (no unit test; verify with `npx supabase` if the CLI is installed, otherwise apply via the Supabase MCP `apply_migration`)

```sql
create table schedule_week (
  weekday text primary key check (weekday in ('sun','mon','tue','wed','thu','fri','sat')),
  closed boolean not null default false,
  open text,
  close text
);

insert into schedule_week (weekday, closed, open, close) values
  ('mon', false, '09:00', '18:00'),
  ('tue', false, '09:00', '18:00'),
  ('wed', false, '09:00', '18:00'),
  ('thu', false, '09:00', '18:00'),
  ('fri', false, '09:00', '18:00'),
  ('sat', true, null, null),
  ('sun', true, null, null);

create table schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  time text
);

create table services (
  id text primary key check (id in ('cut','beard','both')),
  price text not null,
  minutes int not null
);

insert into services (id, price, minutes) values
  ('cut', '€30', 45),
  ('beard', '€15', 20),
  ('both', '€40', 60);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  service text not null check (service in ('cut','beard','both')),
  name text not null,
  email text not null,
  phone text not null default '',
  start timestamptz not null,
  minutes int not null,
  kind text not null check (kind in ('slot','custom')),
  status text not null check (status in ('confirmed','pending','declined')),
  lang text not null check (lang in ('nl','en')),
  mail_sent boolean not null default false,
  created_at timestamptz not null default now()
);

create view booking_occupancy as
  select start, minutes from bookings where status = 'confirmed';

create table mail_templates (
  key text not null,
  lang text not null check (lang in ('nl','en')),
  subject text not null,
  body text not null,
  primary key (key, lang)
);

insert into mail_templates (key, lang, subject, body) values
  ('thanks','nl','Afspraak BarberBjorn','Hoi {{name}}, je {{service}} staat op {{date}} om {{time}}. Tot dan. Bjorn'),
  ('thanks','en','Appointment BarberBjorn','Hi {{name}}, your {{service}} is on {{date}} at {{time}}. See you then. Bjorn'),
  ('accepted','nl','Afspraak bevestigd','Hoi {{name}}, je {{service}} op {{date}} om {{time}} is bevestigd. Bjorn'),
  ('accepted','en','Appointment confirmed','Hi {{name}}, your {{service}} on {{date}} at {{time}} is confirmed. Bjorn'),
  ('declined','nl','Afspraak niet mogelijk','Hoi {{name}}, {{date}} om {{time}} lukt niet. Mail of bel voor een andere tijd. Bjorn'),
  ('declined','en','Could not book that time','Hi {{name}}, {{date}} at {{time}} is not possible. Mail or call for another time. Bjorn');

alter table schedule_week enable row level security;
alter table schedule_blocks enable row level security;
alter table services enable row level security;
alter table bookings enable row level security;
alter table mail_templates enable row level security;

create policy week_read on schedule_week for select to anon, authenticated using (true);
create policy blocks_read on schedule_blocks for select to anon, authenticated using (true);
create policy services_read on services for select to anon, authenticated using (true);
create policy occupancy_read on bookings for select to anon using (false);
grant select on booking_occupancy to anon, authenticated;
```

Do not put `ADMIN_PASSWORD` in SQL.

- [ ] **Step 2: Apply the migration** on the linked project (Supabase MCP `apply_migration` or `npx supabase db push`).

- [ ] **Step 3: Commit**

```
git add supabase/migrations/20261003190000_planning.sql .env.example
git commit -m "feat: planning tables and public occupancy view"
```

---

### Task 5: Browser client and public read

**Files:**
- Create: `src/supabase.ts`
- Create: `src/planning-api.ts`
- Test: `src/planning-api.test.ts`

**Interfaces:**
- Produces:

```ts
export function loadPublicSchedule(): Promise<Schedule>
export function loadServices(): Promise<{ id: ServiceId; price: string; minutes: number }[]>
```

`loadPublicSchedule` maps `schedule_week` + `schedule_blocks` + `booking_occupancy` into `Schedule`. When env vars are empty, return `defaultSchedule` so local tests and Mapbox-only dev still run.

- [ ] **Step 1: Failing test**

```ts
test('maps occupancy rows into booking holds', async () => {
  const schedule = await loadPublicSchedule()
  expect(schedule.week.sat).toEqual({ closed: true })
})
```

Without env this should still return `defaultSchedule` (pass after implement). Mock `@supabase/supabase-js` if you assert fetch shape.

- [ ] **Step 2: Implement**

`src/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && key ? createClient(url, key) : null
```

`planning-api.ts` reads the three sources, builds `week` from weekday rows (`closed` → `{ closed: true }`, else `{ open, close }`), `blocks` from date/time, `bookings` from occupancy (`start` ISO local `YYYY-MM-DDTHH:mm:ss`).

Install: `npm install @supabase/supabase-js`

- [ ] **Step 3: Run** `npx vitest run src/planning-api.test.ts` — PASS.

- [ ] **Step 4: Commit**

```
git add src/supabase.ts src/planning-api.ts src/planning-api.test.ts package.json package-lock.json
git commit -m "feat: public schedule loader"
```

---

### Task 6: Router and admin gate

**Files:**
- Modify: `src/main.tsx`, `src/App.tsx`
- Create: `src/pages/HomePage.tsx`, `src/pages/AdminPage.tsx`
- Create: `src/components/admin/AdminGate.tsx`
- Test: `src/pages/AdminPage.test.tsx`

**Interfaces:**
- `/` renders today’s landing (HomePage = current App body).
- `/admin` shows a password field until `sessionStorage` key `barber-admin` is `1` (set after a successful `admin-login` invoke). Tests can set that key.
- Install `react-router-dom`.

- [ ] **Step 1: Failing test**

```tsx
test('admin without a session shows the password gate', () => {
  window.history.replaceState(null, '', '/admin')
  sessionStorage.clear()
  render(<LanguageProvider><App /></LanguageProvider>)
  expect(screen.getByLabelText('Wachtwoord')).toBeInTheDocument()
  expect(screen.queryByText('Agenda')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Implement router**

`main.tsx` wrap `App` in `BrowserRouter`.

`App.tsx`:

```tsx
import { Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { AdminPage } from './pages/AdminPage'

export default function App() {
  return (
    <LanguageProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </LanguageProvider>
  )
}
```

Move the current splash + main into `HomePage`. `AdminPage` renders `AdminGate`; on success render a placeholder `<p>Agenda</p>` until Task 8.

Gate: form, POST `supabase.functions.invoke('admin-login', { body: { password } })`. On 200 set `sessionStorage.setItem('barber-admin','1')`. Wrong password stays on the gate with `Onjuist wachtwoord.`

- [ ] **Step 3: Run** `npx vitest run src/pages/AdminPage.test.tsx` — PASS.

- [ ] **Step 4: Commit**

```
git add src/main.tsx src/App.tsx src/pages src/components/admin/AdminGate.tsx
git commit -m "feat: /admin route and password gate"
```

---

### Task 7: Public form uses live data and edge book/request

**Files:**
- Modify: `src/components/BookingForm.tsx`, `src/components/BookingForm.test.tsx`
- Modify: `src/components/Services.tsx` to take prices from `loadServices` (fallback to `t.services`)
- Modify: `src/planning-api.ts` — add `submitBook`, `submitCustom`

**Interfaces:**

```ts
export function submitBook(input: BookingInput & { lang: Lang }): Promise<{ ok: true } | { ok: false; error: string }>
export function submitCustom(input: BookingInput & { lang: Lang }): Promise<{ ok: true } | { ok: false; error: string }>
```

They invoke `book` / `request-custom`. Tests mock those functions.

- [ ] **Step 1: Update BookingForm tests**

- Empty submit still shows field errors; phone empty is OK if email is filled… actually empty submit still fails name/email/service/slot.
- Free slot: mock `submitBook` instead of `window.location.assign` / mailto.
- New test: toggle `Ander tijdstip vragen`, fill date `2026-10-15` and time `19:30`, expect `submitCustom` called and `requestSuccess` text.
- Language switch tests still pass.

- [ ] **Step 2: Run to see FAIL** (mailto still used, no email field).

- [ ] **Step 3: Implement form**

- Load `loadPublicSchedule` + `loadServices` in `useEffect`; pass into `agendaDays`.
- Fields: service, agenda or custom date+time, name, email, optional phone.
- Link/button `t.customTimeCta` sets `kind` to `custom` and clears `slot`.
- Submit: `validateBooking` then `submitBook` or `submitCustom`. Show `bookSuccess` / `requestSuccess`. No `mailtoHref`, no `location.assign`.
- Duration label from live minutes.

- [ ] **Step 4: Run** `npx vitest run src/components/BookingForm.test.tsx src/components/Services.tsx` — if Services has tests, run those too.

- [ ] **Step 5: Commit**

```
git add src/components/BookingForm.tsx src/components/BookingForm.test.tsx src/components/Services.tsx src/planning-api.ts
git commit -m "feat: live public booking without mailto"
```

---

### Task 8: Admin shell and Agenda tab

**Files:**
- Create: `src/components/admin/AdminShell.tsx`, `AdminAgenda.tsx`
- Modify: `src/pages/AdminPage.tsx`
- Modify: `src/styles.css` (admin block at the end)
- Test: `src/components/admin/AdminAgenda.test.tsx`

**Interfaces:**
- Shell: four buttons, `aria-current` on the active tab, pending badge prop.
- Agenda: week pager (same 7-day slice as public), day chips, open/close editors, half-hour chips calling `admin-write` `{ type: 'blocks', date, time, on }`, and button **Toepassen op komende weken** calling `{ type: 'week', week: weekHoursFromDays(...) }`.

- [ ] **Step 1: Failing test** — with `sessionStorage` set, render shell+agenda, expect `Toepassen op komende weken`, tap a 12:00 chip, expect `adminWrite` mock with that time.

- [ ] **Step 2: Implement paper CSS**

```css
.admin { min-height: 100svh; background: #f4f1ea; color: #1a1916; }
.admin-card { background: #fff; border: 1px solid #2a2a2a; }
.admin-tabs { position: sticky; bottom: 0; display: flex; background: #efece4; border-top: 1px solid #d9d3c7; }
.admin-tabs button { flex: 1; min-height: 44px; border: 0; background: transparent; }
.admin-tabs button.is-on { font-weight: 700; }
.admin-primary { background: #f5c400; color: #101010; min-height: 44px; border: 0; width: 100%; }
```

No rounded corners.

- [ ] **Step 3: Run admin agenda tests — PASS.**

- [ ] **Step 4: Commit**

```
git add src/components/admin src/pages/AdminPage.tsx src/styles.css
git commit -m "feat: paper admin agenda tab"
```

---

### Task 9: Inbox, Mail, Settings tabs

**Files:**
- Create: `AdminInbox.tsx`, `AdminMail.tsx`, `AdminSettings.tsx` + tests
- Modify: `AdminShell.tsx` to render the active tab
- Modify: `planning-api.ts` — `loadInbox`, `decideInbox`, `sendClientMail`, `saveServices`, `saveTemplates`

**Interfaces:**

```ts
export type InboxRow = {
  id: string
  service: ServiceId
  name: string
  email: string
  phone: string
  start: string
  kind: BookingKind
  status: 'confirmed' | 'pending' | 'declined'
  mail_sent: boolean
}

export function loadInbox(): Promise<InboxRow[]>
export function decideInbox(id: string, action: 'accept' | 'decline'): Promise<{ ok: true } | { ok: false; error: string }>
export function sendClientMail(id: string, key: 'thanks' | 'accepted' | 'declined', draft?: { subject: string; body: string }): Promise<{ ok: true } | { ok: false; error: string }>
```

- [ ] **Step 1: Inbox test** — pending row shows Accepteer/Weiger; click Accepteer calls `decideInbox(id,'accept')`. Confirmed rows have no those buttons. Badge equals pending length.

- [ ] **Step 2: Mail test** — select a row and template, Verstuur calls `sendClientMail`.

- [ ] **Step 3: Settings test** — change cut minutes to 50, save calls `saveServices`.

- [ ] **Step 4: Implement the three tabs.** Inbox lists pending first. Unsent (`mail_sent === false`) shows `Mail niet gegaan` and a resend that opens Mail with that client.

- [ ] **Step 5: Run** `npx vitest run src/components/admin` — PASS.

- [ ] **Step 6: Commit**

```
git add src/components/admin src/planning-api.ts
git commit -m "feat: admin inbox, mail, and settings"
```

---

### Task 10: Edge functions

**Files:**
- Create the six functions under `supabase/functions/`
- Shared: `_shared/session.ts` (HMAC or signed cookie using `ADMIN_PASSWORD` + `ADMIN_SESSION_SECRET`; 7-day max-age; `Secure; HttpOnly; SameSite=Lax; Path=/`)
- Shared: `_shared/resend.ts` — POST `https://api.resend.com/emails` with `RESEND_API_KEY` and `RESEND_FROM`. On throw/non-2xx return `{ sent: false }` without throwing away the DB write.

**Interfaces:**
- `admin-login` body `{ password }` — compare to `Deno.env.get('ADMIN_PASSWORD')` with a constant-time check. Never echo the password.
- `book` body: `BookingInput & { lang }`. Re-load schedule, `validateBooking` + `isFree`. Insert `confirmed`, `kind=slot`. Send `thanks`. Set `mail_sent`. Unique race: if insert fails overlap, return takenError.
- `request-custom` body: same. Insert `pending`, `kind=custom`. No Resend yet.
- `inbox-decide` body `{ id, action }` + session cookie. Accept: `isFree` or reject. Update status. Send `accepted` / `declined`.
- `send-mail` body `{ id, key, subject?, body? }` + session.
- `admin-write` body discriminated union `{ type: 'week', week } | { type: 'blocks', date, time?, on: boolean } | { type: 'services', services } | { type: 'templates', templates }` + session. Use the service role inside the function only.

CORS: allow the Vite origin. Functions use the service role key from the Edge runtime, not the browser.

- [ ] **Step 1: Add `src/planning-edge.test.ts`** that tests the same accept/decline rules by calling `isFree` + status transitions in a small `applyDecision(row, action, schedule)` exported from `src/planning.ts`:

```ts
export function applyDecision(
  row: { start: string; minutes: number; status: string },
  action: 'accept' | 'decline',
  schedule: Schedule,
): { status: 'confirmed' | 'declined' } | { error: 'overlap' }
```

Accept + `!isFree` → `{ error: 'overlap' }`. Decline → `{ status: 'declined' }`. Accept + free → `{ status: 'confirmed' }`.

- [ ] **Step 2: Implement `applyDecision` and the Deno handlers** (handlers parse JSON, call service role, call Resend). Deploy with `npx supabase functions deploy` when secrets exist.

- [ ] **Step 3: Set secrets** (not in git): `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`. Use the password Bjorn chose only as that secret.

- [ ] **Step 4: Run** `npx vitest run src/planning.test.ts src/planning-edge.test.ts` — PASS.

- [ ] **Step 5: Commit functions and shared TS only** (no secrets).

```
git add supabase/functions src/planning.ts src/planning-edge.test.ts
git commit -m "feat: booking and admin edge functions"
```

---

### Task 11: Wire homepage Services prices and verify the loop

**Files:**
- Modify: `src/components/Services.tsx` if Task 7 left fallbacks only
- Modify: `src/components/Services.test.tsx` / Faq if they hardcode €30 — keep fallbacks equal to seed so offline tests pass
- Browser check on `/` and `/admin` at 390px

- [ ] **Step 1:** Services cards use live `price` when `loadServices` succeeds.
- [ ] **Step 2:** Run `npx vitest run` — entire suite green except the known MapPanel-vs-`.env` case.
- [ ] **Step 3:** Manual: login `/admin`, close Tuesday 12:00, confirm it is gone on `/` for a 45-minute cut that would overlap. Book a Monday slot, see it under Bevestigd, see thank-you in Resend logs. Submit Ander tijdstip, accept, confirm it occupies.
- [ ] **Step 4: Commit** leftover UI glue.

```
git add src/components/Services.tsx
git commit -m "feat: homepage prices follow admin settings"
```

---

## Self-review

| Spec item | Task |
| --- | --- |
| Instant confirm + thank-you | 2, 7, 10 `book` |
| Email required, phone optional | 2, 7 |
| Custom date+time, pending, no hold | 2, 7, 10 `request-custom` |
| Accept occupies + mail; decline mails, no hold | 3, 9, 10 |
| Repeating week + one-off blocks | 1, 8 |
| Apply week = template only | 3, 8, 10 `admin-write` |
| 28 days, 30-min, overlap | 1 (existing tests stay) |
| Editable minutes/prices → homepage | 1, 7, 9, 11 |
| `/admin` password secret, session | 6, 10 |
| Paper tabs Agenda/Inbox/Mail/Settings | 8, 9 |
| Inbox badge, unsent resend | 9 |
| Templates nl/en, `fillTemplate` | 3, 4, 10 |
| Occupancy view, no public PII | 4 |
| No mailto, no sample holds once live | 7 |
| Ropes/hero/map untouched | all tasks avoid those files except App split |

No TBD. Names used later (`loadPublicSchedule`, `submitBook`, `decideInbox`, `applyDecision`, `weekHoursFromDays`, `isFree`, `fillTemplate`) are defined in earlier tasks.
