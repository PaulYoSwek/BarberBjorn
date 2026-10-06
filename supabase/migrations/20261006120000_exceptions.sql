-- One-off opening hours for a single date. Overrides schedule_week for that date only.
create table if not exists schedule_exceptions (
  date date primary key,
  closed boolean not null default false,
  open text,
  close text
);

alter table schedule_exceptions enable row level security;

create policy exceptions_read on schedule_exceptions for select to anon, authenticated using (true);
