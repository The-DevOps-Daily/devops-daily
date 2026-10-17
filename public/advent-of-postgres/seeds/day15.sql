-- Advent of Postgres, day 15: the postmortem archive
create schema if not exists day15;
set search_path to day15;

create or replace function day15.h(t text) returns bigint
  language sql immutable as $$ select ('x' || substr(md5(t), 1, 12))::bit(48)::bigint $$;

drop table if exists postmortems;
create table postmortems (
  id           int primary key,
  title        text not null,
  body         text not null,
  published_on date not null
);

-- Postmortems are written from a stock of sentences, so the same words come back in
-- different forms: renewal, renewed, renewing; certificate, certificates, certified.
with sentences(n, s) as (
  values
    (0, 'The TLS certificate for the sleigh API expired at midnight.'),
    (1, 'Automatic renewal was disabled after the last migration.'),
    (2, 'Nobody renewed the certificates for the internal gift router.'),
    (3, 'The job that was renewing tokens crashed on a full disk.'),
    (4, 'We certified the new load balancer before the freeze.'),
    (5, 'A config change sent all traffic to one region.'),
    (6, 'The queue filled up and wrapping slowed to a crawl.'),
    (7, 'DNS answers were cached for longer than expected.'),
    (8, 'Rollback took twelve minutes because the old image was gone.'),
    (9, 'The on-call elf was paged forty times in one hour.'),
    (10, 'Certificate monitoring did not alert on the staging domain.'),
    (11, 'The renewal window for the chimney DNS zone was missed.')
)
insert into postmortems
select p,
       'Incident ' || p || ': ' || (array['sleigh-api','gift-router','chimney-dns','wrap-queue','elf-auth'])[1 + h(p || ':svc') % 5],
       (select string_agg(s.s, ' ' order by k)
          from generate_series(1, 4) k
          join sentences s on s.n = h(p || ':' || k) % 12),
       date '2026-01-05' + (h(p || ':d') % 340)::int
from generate_series(1, 400) p;
