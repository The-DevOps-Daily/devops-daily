-- Advent of Postgres, day 6: the quick rollbacks
create schema if not exists day06;
set search_path to day06;

create or replace function day06.h(t text) returns bigint
  language sql immutable as $$ select ('x' || substr(md5(t), 1, 12))::bit(48)::bigint $$;

drop table if exists releases;
create table releases (
  id          int primary key,
  service     text not null,
  version     text not null,
  released_at timestamptz not null
);

-- Each service ships versions in order. Sometimes the next release goes back to the
-- version before (a rollback), usually within minutes, sometimes hours later.
with steps as (
  select s.name as service, s.major, n,
         h(s.name || n || ':rb') % 7 = 0 as rollback,
         (case when h(s.name || n || ':slow') % 3 = 0 then 70 + h(s.name || n || ':gap2') % 300
               else 5 + h(s.name || n || ':gap') % 50 end)::int as gap_min
  from (values ('sleigh-api', 4), ('gift-router', 2), ('list-checker', 7), ('wrap-queue', 1), ('elf-auth', 3)) s(name, major)
  cross join generate_series(1, 60) n
), timed as (
  select *, sum(gap_min) over (partition by service order by n) as at_min,
         sum(case when rollback then 0 else 1 end) over (partition by service order by n) as forward
  from steps
)
insert into releases
select row_number() over (order by at_min, service),
       service,
       -- a rollback re-releases the previous version; otherwise the version counter moves on
       major || '.' || (case when rollback then forward - 1 else forward end),
       timestamptz '2026-12-01 06:00:00+00' + at_min * interval '1 minute'
from timed;
