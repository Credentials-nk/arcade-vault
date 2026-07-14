'use server';

import { createClient } from '@/lib/supabase/server';
import type { Game } from '@/lib/data';

interface GameRecord {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: string;
  cover: string;
  color: 'cyan' | 'magenta' | 'yellow' | 'green';
  best: number;
  plays: string;
  play_route: string | null;
}

const COLUMNS = 'id, title, short, long, cat, cover, color, best, plays, play_route';

function toGame(row: GameRecord): Game {
  return {
    id: row.id,
    title: row.title,
    short: row.short,
    long: row.long,
    cat: row.cat,
    cover: row.cover,
    color: row.color,
    best: row.best,
    plays: row.plays,
    playRoute: row.play_route ?? undefined,
  };
}

/** Catálogo completo, en el orden visual definido por sort_order. */
export async function getGames(): Promise<Game[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('games')
    .select(COLUMNS)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(toGame);
}

/** Una entrada del catálogo por id, o null si no existe. */
export async function getGame(id: string): Promise<Game | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('games').select(COLUMNS).eq('id', id).maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toGame(data) : null;
}
