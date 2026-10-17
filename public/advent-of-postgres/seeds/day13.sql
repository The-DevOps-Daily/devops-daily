-- Advent of Postgres, day 13: the missing hours
create schema if not exists day13;
set search_path to day13;

create or replace function day13.h(t text) returns bigint
  language sql immutable as $$ select ('x' || substr(md5(t), 1, 12))::bit(48)::bigint $$;

drop table if exists telemetry;
create table telemetry (
  service     text not null,
  reported_at timestamptz not null,
  heart_rate  int            -- null when the sensor sent an empty reading
);

-- Reindeer collars report every 5 minutes. Sometimes the uplink is down for hours (no rows),
-- and sometimes a sensor sends empty readings (rows with null).
insert into telemetry
select 'reindeer-telemetry',
       timestamptz '2026-12-13 00:00:00+00' + m * interval '5 minutes',
       case when h(m || ':null') % 9 = 0 or (m / 12) in (5, 14) then null else 60 + (h(m || ':hr') % 40)::int end
from generate_series(0, 287) m
where (m / 12) not in (2, 3, 9, 17, 18, 19, 22)     -- uplink outages, by hour
  and not ((m / 12) = 11 and m % 12 > 2);           -- one hour with only a few early rows
