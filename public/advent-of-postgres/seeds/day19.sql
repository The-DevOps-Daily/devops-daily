-- Advent of Postgres, day 19: the disk that fills up
create schema if not exists day19;
set search_path to day19;

create or replace function day19.h(t text) returns bigint
  language sql immutable as $$ select ('x' || substr(md5(t), 1, 12))::bit(48)::bigint $$;

drop table if exists disk_usage;
create table disk_usage (
  host        text not null,
  measured_at timestamptz not null,   -- every 6 hours for two weeks
  used_gb     numeric(8,2) not null,
  size_gb     int not null,
  primary key (host, measured_at)
);

-- Each host grows at its own rate with some noise. The fullest disk today grows slowly;
-- a half-empty one grows fast.
insert into disk_usage
select hs.host,
       timestamptz '2026-12-05 00:00:00+00' + n * interval '6 hours',
       round(hs.start_gb + hs.gb_per_day * n / 4.0 + ((h(hs.host || n || ':noise') % 200) - 100) / 100.0, 2),
       hs.size_gb
from (values
  ('db-1',      500, 410.0, 1.2),
  ('db-2',      500, 220.0, 9.5),
  ('logs-1',   1000, 610.0, 12.0),
  ('cache-1',   200, 150.0, 0.8),
  ('builds-1',  250,  90.0, 4.4)
) hs(host, size_gb, start_gb, gb_per_day)
cross join generate_series(0, 55) n;
