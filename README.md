# BarberBjorn

Landing page and booking system for BarberBjorn, kapper en barbier in Axel.
Built by [TurboTurtle](https://turboturtle.nl).

- `/` — the public site (NL/EN) with live booking.
- `/admin` — Bjorn's dashboard: agenda, inbox, mail, settings.
- Supabase (Postgres + edge functions) holds hours, bookings, prices and mail templates. Resend sends mail.

## Run locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env`. Leave `VITE_SUPABASE_*` empty to run the site without a backend
(the agenda then shows the default week and bookings fail with "offline"). Set `ADMIN_PASSWORD` to log in
to `/admin` on the dev server without Supabase.

```bash
npm test        # vitest
npm run build   # tsc + vite build (what Vercel runs)
npx oxlint src  # lint
```

## Deploy

The frontend deploys on Vercel from `master` (`vercel.json` holds the SPA rewrite and cache/security headers).
Vercel needs `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_MAPBOX_TOKEN`.

The backend lives in `supabase/` (project `qzpgrfshccokpuznhdxe`). After changing anything there:

```bash
npx supabase db push
```

```bash
npx supabase functions deploy --project-ref qzpgrfshccokpuznhdxe
```

Function secrets (Supabase dashboard, Edge Functions, Secrets; never in git):

| Secret | What it does |
| --- | --- |
| `ADMIN_PASSWORD` | Password for `/admin`. Without it nobody can log in. |
| `ADMIN_SESSION_SECRET` | Optional extra key for signing admin sessions. Changing it logs everyone out. |
| `RESEND_API_KEY` | Sends booking mails. Without it bookings still save, marked "Mail niet gegaan". |
| `RESEND_FROM` | Sender, e.g. `BarberBjorn <hallo@barberbjorn.nl>`. The domain must be verified in Resend. |
| `SITE_ORIGIN` | Comma-separated origins allowed to call the functions (CORS). |

Shared code in `src/` that the functions import must use explicit `.ts` import extensions, or the
Supabase bundler fails.

## SEO

Static tags live in `index.html` (title, description, Open Graph, Twitter, hreflang, JSON-LD for the
business, opening hours and prices). `src/seo.ts` keeps the title, description and canonical in step with the
active language and marks `/admin` and unknown routes `noindex`. `public/robots.txt` and `public/sitemap.xml`
point at the production domain in `SITE_URL` (`src/content.ts`). Change that constant, the sitemap and robots
if the site moves to another domain.
