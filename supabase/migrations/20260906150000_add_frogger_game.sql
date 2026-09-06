-- Frogger se insertó a mano contra el proyecto de desarrollo y nunca quedó en una
-- migración, así que el catálogo derivó del repo. Esta migración cierra esa deriva.
-- Idempotente: es un no-op donde la fila ya existe (dev) e inserta donde no (prod).

insert into public.games (id, title, short, long, cat, cover, color, best, plays, play_route, sort_order) values
  ('frogger', 'FROGGER', 'Cruza la carretera y el río sin convertirte en papilla.', 'Guía a tu rana a través de una carretera repleta de coches y un río de troncos y tortugas flotantes. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.', 'ARCADE', 'cover-frogger', 'lime', 0, '0', '/games/frogger', 7)
on conflict (id) do nothing;
