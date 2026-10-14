-- Bjorn can add his own services from the dashboard: a service is no longer one
-- of three fixed ids but a row with its own names, description, order and visibility.

alter table services drop constraint if exists services_id_check;
alter table bookings drop constraint if exists bookings_service_check;

alter table services add column if not exists name_nl text not null default '';
alter table services add column if not exists name_en text not null default '';
alter table services add column if not exists detail_nl text not null default '';
alter table services add column if not exists detail_en text not null default '';
alter table services add column if not exists sort int not null default 0;
alter table services add column if not exists active boolean not null default true;

alter table services drop constraint if exists services_id_format;
alter table services add constraint services_id_format check (id ~ '^[a-z0-9-]{1,40}$');
alter table bookings drop constraint if exists bookings_service_format;
alter table bookings add constraint bookings_service_format check (service ~ '^[a-z0-9-]{1,40}$');

update services set name_nl = 'Knippen', name_en = 'Cut', detail_nl = 'Haar, op jouw tempo',
  detail_en = 'Hair, at your pace', sort = 1
  where id = 'cut' and name_nl = '';
update services set name_nl = 'Baard', name_en = 'Beard', detail_nl = 'Lijn en vorm',
  detail_en = 'Line and shape', sort = 2
  where id = 'beard' and name_nl = '';
update services set name_nl = 'Knippen + baard', name_en = 'Cut + beard', detail_nl = 'Haar en baard',
  detail_en = 'Hair and beard', sort = 3
  where id = 'both' and name_nl = '';
