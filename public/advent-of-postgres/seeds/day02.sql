-- Advent of Postgres, day 2: the error budget
create schema if not exists day02;
set search_path to day02;

create or replace function day02.h(t text) returns bigint
  language sql immutable as $$ select ('x' || substr(md5(t), 1, 12))::bit(48)::bigint $$;

drop table if exists request_stats;
create table request_stats (
  service  text not null,
  minute   timestamptz not null,
  requests int not null,   -- requests served in that minute
  errors   int not null,   -- of which returned a 5xx
  primary key (service, minute)
);

with services(n, name, base, err_per_mille) as (
  values (0,'sleigh-api',      90, 9), (1,'gift-router',  140, 14), (2,'list-checker', 60, 6),
         (3,'wrap-queue',      45, 11), (4,'chimney-dns', 200, 3),  (5,'reindeer-telemetry', 75, 17),
         (6,'cocoa-billing',   20, 8), (7,'elf-auth',     110, 5),  (8,'naughty-export', 6, 150)
), minutes as (
  select timestamptz '2026-12-02 00:00:00+00' + m * interval '1 minute' as minute, m
  from generate_series(0, 24 * 60 - 1) m
)
insert into request_stats
select s.name, mi.minute, r.requests,
       -- errors per minute: a binomial-ish draw from the hash, never more than requests
       least(r.requests, (r.requests * s.err_per_mille + h(s.name || mi.m || ':e') % 1000) / 1000)
from services s
cross join minutes mi
cross join lateral (
  -- some minutes see no traffic at all (requests = 0)
  select case when h(s.name || mi.m || ':idle') % 9 = 0 then 0
              else s.base / 2 + (h(s.name || mi.m || ':r') % greatest(s.base, 1))::int end as requests
) r;
