-- Scores de demo arrastrados desde el proyecto de desarrollo para que el leaderboard
-- de producción no arranque vacío. Van con UUID fijo para que la migración sea
-- idempotente. Depende de 20260906150000_add_frogger_game.sql por la FK a games.
--
-- Son datos de prueba, no de negocio: cuando haya scores reales, borrarlos con una
-- migración de limpieza que apunte a estos mismos UUID.

insert into public.scores (id, game_id, player_name, score, created_at) values
  ('590b723b-a3cf-4168-a3b8-e103704bb7d5', 'bloque-buster', 'NIK', 70, '2026-07-14 22:46:14.466635+00'),
  ('d8049c1f-0bf6-4993-a605-1bcb8ce31528', 'bloque-buster', 'FK9', 70, '2026-07-14 23:45:25.997563+00'),
  ('2628c2f5-d0e4-48c4-8f67-6073a55061b3', 'serpentina',    'SNK', 10, '2026-07-15 00:10:34.634354+00'),
  ('1511846c-7640-4139-b78b-296c0efe2552', 'frogger',       'NIK',  0, '2026-07-23 21:08:03.151925+00')
on conflict (id) do nothing;
