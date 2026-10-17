-- Advent of Postgres, day 24: the launch readiness check
create schema if not exists day24;
set search_path to day24;

create or replace function day24.h(t text) returns bigint
  language sql immutable as $$ select ('x' || substr(md5(t), 1, 12))::bit(48)::bigint $$;

drop table if exists checks;
drop table if exists planned_maintenance;
create table checks (
  service    text not null,
  checked_at timestamptz not null,   -- one check per service per minute, 1-23 December
  ok         boolean not null,
  primary key (service, checked_at)
);
create table planned_maintenance (
  service text not null,
  window_ tstzrange not null          -- [start, end): failures inside do not count
);

with services(name, fail_rate) as (
  values ('sleigh-api', 1656), ('gift-router', 4140), ('list-checker', 6624),
         ('wrap-queue', 3312), ('chimney-dns', 2366), ('elf-auth', 1325)
)
insert into checks
select s.name,
       timestamptz '2026-12-01 00:00:00+00' + m * interval '1 minute',
       h(s.name || m || ':ok') % s.fail_rate <> 0
         -- planned work takes services down on purpose
         and not (s.name = 'gift-router' and m between 10 * 1440 + 120 and 10 * 1440 + 155)
         and not (s.name = 'wrap-queue' and m between 15 * 1440 + 60 and 15 * 1440 + 82)
         and not (s.name = 'elf-auth' and m between 6 * 1440 + 300 and 6 * 1440 + 309)
from services s
cross join generate_series(0, 23 * 1440 - 1) m;

insert into planned_maintenance values
  ('gift-router', tstzrange(timestamptz '2026-12-11 02:00:00+00', timestamptz '2026-12-11 02:36:00+00', '[)')),
  ('wrap-queue',  tstzrange(timestamptz '2026-12-16 01:00:00+00', timestamptz '2026-12-16 01:23:00+00', '[)')),
  ('elf-auth',    tstzrange(timestamptz '2026-12-07 05:00:00+00', timestamptz '2026-12-07 05:10:00+00', '[)'));
