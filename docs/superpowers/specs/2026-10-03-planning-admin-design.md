# BarberBjorn — planning and admin

A live planning system for the existing Vite landing page. Bjorn manages hours, prices, durations, bookings, and mail from `/admin` on his phone. The public agenda and the dashboard read the same Supabase data. Mail goes through Resend.

This replaces the current hardcoded schedule, hardcoded prices/durations, and mailto booking.

## Locked product rules

- A published, still-free slot books **immediately as confirmed**. That time disappears from the public agenda. Resend sends the thank-you template.
- **Email is required. Phone is optional.**
- **Ander tijdstip / Another time** is a date + clock time plus a service. It is **pending**: no hold. Inbox accept blocks the time and emails the client. Decline emails the client and never held the slot.
- Hours are a **repeating weekday template** plus **one-off** closed dates or half-hour slots. **Toepassen op komende weken** saves the week you are viewing as the new repeating Mon–Sun default. Existing one-off closes stay on those dates only.
- Public bookable window stays **28 days**, week pager as now. Slot starts stay every **30 minutes**. A slot must finish before that day’s close. Overlap is `[start, end)`.
- Service length (knippen / baard / allebei) is editable in Settings. The public slot grid uses those minutes.
- Prices are editable in Settings and update on the homepage immediately.
- Admin password is a **server secret** (Supabase / edge), never in the git repo and never in the frontend bundle. `/admin` asks for it, then keeps a session on that device.

## Out of scope

Payments, client accounts, SMS, Apple/Google calendar sync, multi-barber, a public “my booking” portal, and changing the landing-page visual system (ropes, hero, map). The dashboard is a separate professional tool, not a restyle of the black homepage.

## Architecture

Keep Vite + React. Add a router so `/` is the landing page and `/admin` is the dashboard.

**Supabase Postgres** is the store. **Edge functions** are the only writers for bookings, accept/decline, mail, and admin login. The browser never holds the service role key or the admin password.

| Function | Job |
| --- | --- |
| `admin-login` | Check the password secret. Issue an httpOnly session cookie. |
| `book` | Validate service, email, optional phone, and a still-free published slot. Insert `confirmed`. Send thank-you mail. |
| `request-custom` | Validate service, email, date, time. Insert `pending`. No hold. |
| `inbox-decide` | Admin session required. Accept: if the time is still free, set `confirmed` and send the accepted template. Decline: set `declined` and send the declined template. |
| `send-mail` | Admin session required. Send a template (or an edited draft) to a client who already has a booking. |
| `admin-write` | Admin session required. Update weekday hours, one-off closes, services (price + minutes), and templates. |

Public visitors may **read** repeating hours, one-off closes, service price/minutes, and occupied times (start + minutes only). They must not read other people’s names, emails, or phones.

If two clients submit the same free slot, the first confirmed write wins. The second gets the existing “die tijd is al weg” error. Accepting a custom time that overlaps a confirmed booking is rejected until Bjorn picks another time.

If Resend fails, the booking or decision still saves. The inbox marks that mail as unsent so he can resend from Mail.

Wrong password stays on the gate. An expired session returns to the password screen.

## Data

- `schedule_week` — one row per weekday: closed, or open + close.
- `schedule_blocks` — one-off closed date, or a closed half-hour on a date.
- `services` — `cut` / `beard` / `both`, price, minutes. Seeded €30 / 45, €15 / 20, €40 / 60.
- `bookings` — service, name, email, phone (optional), start, minutes, kind (`slot` \| `custom`), status (`confirmed` \| `pending` \| `declined`), `lang` (`nl` \| `en`), mail_sent flag.
- `mail_templates` — keys: `thanks`, `accepted`, `declined`, each with `nl` and `en` subject + body, editable in Settings. Placeholders for name, service, date, time. Auto-mail uses the language the client had on the site.
- Occupied times for the public agenda = `confirmed` bookings only. Pending customs do not occupy a slot.

The shared `agendaDays` module stays the source of slot math. It reads week + blocks + confirmed bookings + current service minutes instead of the hardcoded `defaultSchedule` and `SERVICE_MINUTES`.

## Admin dashboard

Mobile-first. Route `/admin`. Paper tool, not the black site:

- Background `#f4f1ea`, white cards, 1px `#2a2a2a` edges, yellow `#f5c400` only on the primary action.
- Bottom tabs: **Agenda · Inbox · Mail · Settings**.
- Inbox tab shows a badge when a `pending` custom request exists.

**Agenda.** Week pager. Seven day chips with hours or “dicht”. Tap a day: edit open/close (or closed), then tap half-hour chips off/on as one-off blocks. Confirmed bookings show on their slot and are not toggled away. **Toepassen op komende weken** writes that week’s weekday hours into `schedule_week`.

**Inbox.** Pending customs first, with Weiger / Accepteer. Confirmed slot bookings (and accepted customs) listed below as a log, with email and phone if present.

**Mail.** Pick anyone who already submitted a booking (any status) and left an email. Pick a template, edit if needed, send via Resend.

**Settings.** Three services: price + minutes. Three starter templates: thank-you, custom accepted, custom declined.

Admin copy can stay Dutch (the user of the dashboard is Bjorn). The public site keeps NL / EN.

## Public booking

The existing booking block stays on the homepage. It loads week, blocks, services, and confirmed occupancy from Supabase.

- Service select still drives duration and therefore which starts fit before close.
- Taken / past / closed behave as now, but data is live.
- Name + email required. Phone optional.
- **Bevestig afspraak** on a yellow slot calls `book`. Success copy: the time is theirs; a mail is on the way.
- **Ander tijdstip vragen** switches the slot grid for a date field and a time field, then calls `request-custom`. Success copy: not confirmed yet; they get mail when Bjorn says yes or no.

No mailto. The sample holds in `defaultSchedule` go away once real bookings exist.

## Testing

- Schedule: 28-day window, weekend closed from the week template, one-off blocks, duration changes the last bookable start, confirmed overlap, pending does not block.
- `book`: first writer wins; missing email fails; phone may be empty.
- `request-custom`: creates pending; does not hide a published slot.
- `inbox-decide`: accept occupies; decline does not; overlap reject; both send (or flag unsent).
- Admin gate: no dashboard without a valid session.
- Homepage still renders NL/EN prices from `services`.

## Launch notes

Set `ADMIN_PASSWORD` and Resend keys as host secrets. Hash or compare the password only on the server. Do not commit `.env` or the Mapbox token. The public Mapbox pin and ropes stay as they are.
