-- Clients Bjorn knows. Filled from bookings automatically and by hand from the dashboard.
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null default '',
  phone text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

-- One client per mail address; addresses are stored lower case.
create unique index if not exists clients_email_key on clients (email) where email <> '';

-- Only the edge functions (service role) read or write clients. No public policies.
alter table clients enable row level security;

-- The price at the moment of booking, so later price changes keep old totals right.
alter table bookings add column if not exists price text;

-- Everyone who booked before this table existed.
insert into clients (name, email, phone, created_at)
select distinct on (lower(trim(email))) trim(name), lower(trim(email)), trim(phone), created_at
from bookings
where trim(email) <> ''
order by lower(trim(email)), created_at
on conflict do nothing;
