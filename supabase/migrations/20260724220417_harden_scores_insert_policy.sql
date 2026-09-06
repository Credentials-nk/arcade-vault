drop policy if exists "public insert" on public.scores;
create policy "public insert" on public.scores
  for insert
  to anon, authenticated
  with check (
    game_id is not null
    and player_name is not null
    and char_length(player_name) <= 10
    and score >= 0
  );
