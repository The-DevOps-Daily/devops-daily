-- Advent of Postgres, day 9: the blast radius
create schema if not exists day09;
set search_path to day09;

drop table if exists dependencies;
create table dependencies (
  service    text not null,   -- this service
  depends_on text not null,   -- calls this one
  primary key (service, depends_on)
);

insert into dependencies values
  ('sleigh-api', 'gift-router'), ('sleigh-api', 'elf-auth'), ('sleigh-api', 'route-planner'),
  ('gift-router', 'wrap-queue'), ('gift-router', 'list-checker'), ('gift-router', 'inventory'),
  ('list-checker', 'elf-auth'), ('list-checker', 'naughty-db'),
  ('wrap-queue', 'inventory'), ('wrap-queue', 'ribbon-cache'),
  ('route-planner', 'chimney-dns'), ('route-planner', 'weather-feed'),
  ('inventory', 'chimney-dns'), ('inventory', 'warehouse-db'),
  ('elf-auth', 'chimney-dns'), ('elf-auth', 'token-store'),
  ('cocoa-billing', 'elf-auth'), ('cocoa-billing', 'ledger-db'),
  ('reindeer-telemetry', 'weather-feed'), ('reindeer-telemetry', 'metrics-store'),
  ('status-page', 'metrics-store'), ('status-page', 'sleigh-api'),
  ('ribbon-cache', 'warehouse-db'),
  -- an old loop nobody cleaned up: the token store calls elf-auth back
  ('token-store', 'elf-auth');
