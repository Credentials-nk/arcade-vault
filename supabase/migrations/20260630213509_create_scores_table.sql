create table scores (
  id          uuid        primary key default gen_random_uuid(),
  game_id     text        not null,
  player_name text        not null check (char_length(player_name) <= 10),
  score       integer     not null check (score >= 0 and score < 9999999),
  created_at  timestamptz not null default now()
);

alter table scores enable row level security;
create policy "public insert" on scores for insert with check (true);
create policy "public select" on scores for select using (true);
