ALTER TABLE public.games DROP CONSTRAINT games_color_check;
ALTER TABLE public.games ADD CONSTRAINT games_color_check
  CHECK (color = ANY (ARRAY['cyan'::text, 'magenta'::text, 'yellow'::text, 'green'::text, 'lime'::text]));
