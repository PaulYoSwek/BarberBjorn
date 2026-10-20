-- A client who did not turn up: the appointment stays on record (and counts
-- against the client) but never counts as revenue.
alter table bookings drop constraint if exists bookings_status_check;
alter table bookings add constraint bookings_status_check check (status in ('confirmed','pending','declined','noshow'));
