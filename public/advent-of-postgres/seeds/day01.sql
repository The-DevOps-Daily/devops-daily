-- Advent of Postgres, day 1: the deploy log
-- The data is generated from md5 hashes, so it is the same on every Postgres version.
create schema if not exists day01;
set search_path to day01;

create or replace function day01.h(t text) returns bigint
  language sql immutable as $$ select ('x' || substr(md5(t), 1, 12))::bit(48)::bigint $$;

drop table if exists deploys;
create table deploys (
  id          int primary key,
  service     text not null,
  deployed_at timestamptz not null,
  status      text not null,
  author      text not null
);

with services(n, name) as (
  values (0,'sleigh-api'),(1,'gift-router'),(2,'list-checker'),(3,'wrap-queue'),
         (4,'chimney-dns'),(5,'reindeer-telemetry'),(6,'cocoa-billing'),(7,'elf-auth')
), elves(n, name) as (
  values (0,'alabaster'),(1,'bushy'),(2,'pepper'),(3,'sugarplum'),(4,'wunorse'),(5,'shinny')
), raw as (
  select g as id,
         h(g || ':svc') % 8 as svc,
         timestamptz '2026-11-24 00:00:00+00' + (h(g || ':t') % (14 * 24 * 60)) * interval '1 minute' as at,
         h(g || ':st') % 100 as roll,
         h(g || ':spell') % 4 as spelling,
         h(g || ':who') % 6 as who
  from generate_series(1, 2400) g
)
insert into deploys
select r.id, s.name, r.at,
       -- chimney-dns fails more often, and its old deploy tool writes the status its own way
       case when r.roll < (case when s.name = 'chimney-dns' then 70 else 80 end) then 'succeeded'
            when r.roll < 93 then
              case when s.name in ('chimney-dns', 'wrap-queue') then (array['FAILED', ' failed'])[1 + r.spelling % 2]
                   when r.spelling = 3 then 'Failed'
                   else 'failed' end
            else 'rolled_back' end,
       e.name
from raw r
join services s on s.n = r.svc
join elves e on e.n = r.who;
