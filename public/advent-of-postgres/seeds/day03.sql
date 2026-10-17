-- Advent of Postgres, day 3: who was on call?
create schema if not exists day03;
set search_path to day03;

create or replace function day03.h(t text) returns bigint
  language sql immutable as $$ select ('x' || substr(md5(t), 1, 12))::bit(48)::bigint $$;

drop table if exists incidents;
drop table if exists oncall;
create table oncall (
  elf   text not null,
  shift tstzrange not null   -- [start, end): the shift owns its start, not its end
);
create table incidents (
  id         int primary key,
  service    text not null,
  started_at timestamptz not null,
  severity   int not null
);

-- 8-hour shifts from 1 to 4 December, handed over at 00:00, 08:00 and 16:00 UTC
insert into oncall
select (array['alabaster','bushy','pepper','sugarplum','wunorse','shinny','tinsel'])[1 + (s % 7)],
       tstzrange(timestamptz '2026-12-01 00:00:00+00' + s * interval '8 hours',
                 timestamptz '2026-12-01 00:00:00+00' + (s + 1) * interval '8 hours', '[)')
from generate_series(0, 11) s;

insert into incidents
select g,
       (array['sleigh-api','gift-router','list-checker','wrap-queue','chimney-dns'])[1 + h(g || ':svc') % 5],
       case
         -- alerts fire on the hour more than you would think: a few land exactly on a handover
         -- (the nightly batch job alerts at the 16:00 handover on 2 December)
         when h(g || ':edge') % 8 = 0
           then timestamptz '2026-12-02 16:00:00+00'
         else timestamptz '2026-12-01 00:00:00+00' + (h(g || ':t') % (4 * 24 * 3600)) * interval '1 second'
       end,
       1 + h(g || ':sev') % 4
from generate_series(1, 160) g;
