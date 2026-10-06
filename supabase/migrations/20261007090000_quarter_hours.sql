-- Quarter-hour agenda, closed times with a reason and colour, public view without the reasons.

alter table schedule_blocks add column if not exists reason text not null default '';
alter table schedule_blocks add column if not exists color text not null default '';

-- Blocks were half-hours; each becomes two quarter-hours. Safe to run again.
insert into schedule_blocks (date, time, reason, color)
select b.date, to_char(b.time::time + interval '15 minutes', 'HH24:MI'), b.reason, b.color
from schedule_blocks b
where b.time is not null
  and substr(b.time, 4, 2) in ('00', '30')
  and not exists (
    select 1 from schedule_blocks o
    where o.date = b.date and o.time = to_char(b.time::time + interval '15 minutes', 'HH24:MI')
  );

-- Service lengths in quarter-hours.
update services set minutes = 45 where id = 'cut';
update services set minutes = 30 where id = 'beard';
update services set minutes = 75 where id = 'both';

-- Visitors only need to know when it is closed, never why.
create or replace view schedule_blocks_public as select date, time from schedule_blocks;
grant select on schedule_blocks_public to anon, authenticated;
drop policy if exists blocks_read on schedule_blocks;
