create table games (
  id          text primary key,
  title       text not null,
  short       text not null,
  long        text not null,
  cat         text not null,
  cover       text not null,
  color       text not null check (color in ('cyan','magenta','yellow','green')),
  best        integer not null default 0,
  plays       text not null default '0',
  play_route  text,
  sort_order  integer not null,
  created_at  timestamptz not null default now()
);

alter table games enable row level security;
create policy "public select" on games for select using (true);

insert into games (id, title, short, long, cat, cover, color, best, plays, play_route, sort_order) values
  ('bloque-buster', 'BLOQUE BUSTER', 'Rebota la pelota y destruye muros de neón.', 'Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cada nivel reorganiza la grilla en patrones imposibles. ¿Hasta dónde llegará tu racha?', 'ARCADE', 'cover-bricks', 'cyan', 28450, '12.4K', '/games/bloque-buster', 0),
  ('caida', 'CAÍDA', 'Encaja las piezas antes de que el techo te aplaste.', 'Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.', 'PUZZLE', 'cover-tetro', 'magenta', 184220, '31.8K', '/games/caida', 1),
  ('serpentina', 'SERPENTINA', 'Crece sin morder tu propia cola.', 'Una serpiente de luz recorre la grilla buscando núcleos magenta. Cada bocado la alarga y la hace más veloz. Un movimiento en falso y se devora a sí misma.', 'ARCADE', 'cover-snake', 'green', 7820, '9.1K', null, 2),
  ('gloton', 'GLOTÓN', 'Devora puntos y escapa de los fantasmas.', 'Un círculo glotón patrulla un laberinto coleccionando puntos luminosos. Cuatro espectros lo persiguen, pero cada cierto tiempo aparece una píldora que invierte los papeles.', 'ARCADE', 'cover-glot', 'yellow', 96400, '27.2K', null, 3),
  ('invasores', 'INVASORES', 'Defiende el planeta de filas alienígenas.', 'Olas de pixeles hostiles descienden formación tras formación. Mueve tu cañón en horizontal y abre fuego con precisión, antes de que toquen la superficie.', 'SHOOTER', 'cover-invaders', 'green', 54190, '18.0K', null, 4),
  ('rocas', 'ROCAS', 'Pulveriza asteroides en gravedad cero.', 'Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Cuidado con los OVNIs en el horizonte.', 'SHOOTER', 'cover-rocas', 'yellow', 41200, '15.6K', null, 5),
  ('asteroids', 'ASTEROIDS', 'Destruye los asteroides antes de que te destruyan.', 'Destruye los asteroides antes de que te destruyan. Los grandes se parten en medianos, los medianos en pequeños.', 'SHOOTER', 'cover-asteroids', 'cyan', 0, '0', '/games/asteroids', 6);

alter table scores
  add constraint scores_game_id_fkey foreign key (game_id) references games(id);
