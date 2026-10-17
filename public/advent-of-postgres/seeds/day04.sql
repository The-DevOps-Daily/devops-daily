-- Advent of Postgres, day 4: the longest outage
create schema if not exists day04;
set search_path to day04;

create or replace function day04.h(t text) returns bigint
  language sql immutable as $$ select ('x' || substr(md5(t), 1, 12))::bit(48)::bigint $$;

drop table if exists health_checks;
create table health_checks (
  service    text not null,
  checked_at timestamptz not null,   -- one check per service per minute
  ok         boolean not null,
  primary key (service, checked_at)
);

-- Each service fails in bursts: a burst starts with a small chance and lasts a while.
with services(name, burst_rate, max_len) as (
  values ('sleigh-api', 60, 9), ('gift-router', 45, 6), ('list-checker', 150, 40),
         ('wrap-queue', 30, 4), ('chimney-dns', 400, 31), ('elf-auth', 80, 12)
), bursts as (
  -- burst start minutes and lengths per service
  select s.name, m as start_min, 1 + (h(s.name || m || ':len') % s.max_len)::int as len
  from services s
  cross join generate_series(0, 24 * 60 - 1) m
  where h(s.name || m || ':burst') % s.burst_rate = 0
), failed as (
  select distinct b.name, b.start_min + k as m
  from bursts b
  cross join lateral generate_series(0, b.len - 1) k
)
insert into health_checks
select s.name,
       timestamptz '2026-12-04 00:00:00+00' + g.m * interval '1 minute',
       f.m is null
from services s
cross join generate_series(0, 24 * 60 - 1) g(m)
left join failed f on f.name = s.name and f.m = g.m;
