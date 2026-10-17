-- Advent of Postgres, day 14: the late-night deploys
create schema if not exists day14;
set search_path to day14;

create or replace function day14.h(t text) returns bigint
  language sql immutable as $$ select ('x' || substr(md5(t), 1, 12))::bit(48)::bigint $$;

drop table if exists deploys;
drop table if exists elves;
create table elves (
  name      text primary key,
  time_zone text not null      -- IANA name of the office the elf works from
);
create table deploys (
  id          int primary key,
  author      text not null references elves(name),
  deployed_at timestamptz not null
);

insert into elves values
  ('alabaster', 'Europe/Helsinki'), ('bushy', 'America/New_York'), ('pepper', 'Asia/Tokyo'),
  ('sugarplum', 'Europe/London'), ('wunorse', 'America/Los_Angeles'), ('shinny', 'Australia/Sydney');

insert into deploys
select g,
       (array['alabaster','bushy','pepper','sugarplum','wunorse','shinny'])[1 + h(g || ':who') % 6],
       timestamptz '2026-12-07 00:00:00+00' + (h(g || ':t') % (7 * 86400)) * interval '1 second'
from generate_series(1, 700) g;
