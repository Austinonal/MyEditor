-- Local-first schema (SQLite). Same tables on Android (Room) and web (SQLite-WASM on OPFS).
-- Times in ms (integer) on the media timeline; created_at/updated_at are unix ms UTC.
-- No users/RLS: single-user on-device. Every query is scoped by project_id.
PRAGMA foreign_keys = ON;

create table media (
  id text primary key,                       -- uuid
  kind text not null check (kind in ('video','image','audio')),
  uri text not null,                         -- content:// (Android), OPFS path (web)
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  width integer, height integer,
  hash text,                                 -- dedupe, detect moved files
  created_at integer not null
);
create index media_hash on media (hash);

create table project (
  id text primary key,
  name text not null,
  kind text not null default 'video' check (kind in ('video','thumbnail')),  -- tool that made it; future thumbnail tool
  aspect text not null default '9:16' check (aspect in ('9:16','1:1','4:5','16:9')),
  fps integer not null default 30 check (fps in (24,25,30,60)),
  reference_id text references reference(id) on delete set null,
  created_at integer not null, updated_at integer not null
);
create index project_updated on project (updated_at desc);

create table reference (
  id text primary key,
  media_id text not null references media(id) on delete restrict,
  duration_ms integer not null,
  analysis_version integer not null,        -- bump to invalidate cached results
  status text not null default 'pending'
    check (status in ('pending','running','done','failed','cancelled')),
  stages_done text not null default '[]',   -- json: ["scenes","beats",...] allows resume
  created_at integer not null
);
create index reference_media on reference (media_id);

create table scene (
  id text primary key,
  reference_id text not null references reference(id) on delete cascade,
  idx integer not null,
  start_ms integer not null, end_ms integer not null,
  confidence real,
  check (end_ms > start_ms),
  unique (reference_id, idx)
);

create table beat (
  reference_id text not null references reference(id) on delete cascade,
  t_ms integer not null,
  strength real,
  primary key (reference_id, t_ms)
);

create table effect (                        -- detected, mapped to OUR fixed vocabulary
  id text primary key,
  reference_id text not null references reference(id) on delete cascade,
  scene_id text references scene(id) on delete cascade,
  at_ms integer not null, duration_ms integer not null default 0,
  kind text not null check (kind in
    ('cut','fade','dissolve','slide','zoom_in','zoom_out','shake','flash','speed_ramp','freeze','blur','bw')),
  params text not null default '{}',
  confidence real
);
create index effect_ref on effect (reference_id, at_ms);

create table text_event (
  id text primary key,
  reference_id text not null references reference(id) on delete cascade,
  start_ms integer not null, end_ms integer not null,
  text text not null,
  source text not null check (source in ('ocr','speech')),
  lang text check (lang in ('th','en','mixed')),
  bbox text,                                 -- json {x,y,w,h} normalised, OCR only
  check (end_ms > start_ms)
);
create index text_ref on text_event (reference_id, start_ms);

create table track (
  id text primary key,
  project_id text not null references project(id) on delete cascade,
  kind text not null check (kind in ('video','overlay','text','audio','effect')),
  idx integer not null,
  unique (project_id, idx)
);

create table slot (                          -- the skeleton block; never locked
  id text primary key,
  project_id text not null references project(id) on delete cascade,
  track_id text not null references track(id) on delete cascade,
  scene_id text references scene(id) on delete set null,
  start_ms integer not null,
  duration_ms integer not null check (duration_ms > 0),
  media_id text references media(id) on delete set null,   -- null = empty slot
  in_ms integer not null default 0,         -- trim into media
  effect_kind text, effect_params text,
  snap integer not null default 1,
  updated_at integer not null
);
create index slot_project on slot (project_id, start_ms);

create table clip (                          -- phase 2 manual editing
  id text primary key,
  project_id text not null references project(id) on delete cascade,
  track_id text not null references track(id) on delete cascade,
  kind text not null check (kind in ('media','text','sticker','audio')),
  media_id text references media(id) on delete set null,
  start_ms integer not null, duration_ms integer not null check (duration_ms > 0),
  in_ms integer not null default 0,
  speed real not null default 1 check (speed > 0),
  props text not null default '{}',          -- transform, filters, text style
  keyframes text not null default '[]'
);
create index clip_project on clip (project_id, start_ms);

create table export_job (
  id text primary key,
  project_id text not null references project(id) on delete cascade,
  width integer not null, height integer not null,
  fps integer not null, container text not null default 'mp4',
  status text not null default 'queued'
    check (status in ('queued','running','done','failed','cancelled')),
  output_uri text, error text,
  created_at integer not null
);
