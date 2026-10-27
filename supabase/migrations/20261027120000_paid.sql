-- When the client paid for an appointment. Only paid appointments count as revenue.
alter table bookings add column if not exists paid_at timestamptz;

-- Until now every confirmed appointment that had happened counted as revenue.
-- Keep those numbers: mark them paid as of their own start.
update bookings set paid_at = start
where status = 'confirmed' and start < now() and paid_at is null;
