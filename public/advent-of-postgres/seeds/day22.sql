-- Advent of Postgres, day 22: the fastest route
create schema if not exists day22;
set search_path to day22;

drop table if exists hops;
create table hops (
  from_stop text not null,
  to_stop   text not null,
  minutes   int not null,          -- flying time for this hop
  primary key (from_stop, to_stop)
);

-- One-way hops between relay stations. The route with the fewest hops is not the fastest.
insert into hops values
  ('north-pole', 'svalbard', 50), ('north-pole', 'greenland', 70), ('north-pole', 'nordkapp', 95),
  ('svalbard', 'tromso', 40), ('svalbard', 'nordkapp', 30), ('greenland', 'reykjavik', 45),
  ('nordkapp', 'tromso', 20), ('nordkapp', 'oslo', 140), ('tromso', 'bodo', 35),
  ('tromso', 'oslo', 115), ('bodo', 'trondheim', 40), ('trondheim', 'oslo', 45),
  ('reykjavik', 'bergen', 110), ('bergen', 'oslo', 35), ('greenland', 'bergen', 160),
  ('bodo', 'oslo', 95), ('trondheim', 'bergen', 50);
