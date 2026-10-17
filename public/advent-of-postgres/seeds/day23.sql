-- Advent of Postgres, day 23: the tracking sessions
create schema if not exists day23;
set search_path to day23;

create or replace function day23.h(t text) returns bigint
  language sql immutable as $$ select ('x' || substr(md5(t), 1, 12))::bit(48)::bigint $$;

drop table if exists page_views;
create table page_views (
  id        bigint primary key,
  child_id  int not null,
  viewed_at timestamptz not null
);

-- Children check the gift tracker in bursts. Some bursts run past midnight UTC.
with bursts as (
  select c as child_id, b,
         timestamptz '2026-12-23 00:00:00+00' + (h(c || ':' || b || ':start') % (24 * 60 - 20)) * interval '1 minute' as start_at,
         2 + (h(c || ':' || b || ':n') % 12)::int as views
  from generate_series(1, 300) c
  cross join generate_series(1, 4) b
  where h(c || ':' || b || ':on') % 3 <> 0
)
insert into page_views
select row_number() over (order by child_id, start_at, k),
       child_id,
       start_at + (k * (1 + h(child_id || ':' || b || ':' || k) % 9)) * interval '1 minute'
from bursts
cross join generate_series(0, views - 1) k;
