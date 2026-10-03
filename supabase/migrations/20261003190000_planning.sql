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
