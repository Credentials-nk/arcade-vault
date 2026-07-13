'use server';

import { createClient } from '@/lib/supabase/server';
import type { LeaderboardEntry } from '@/lib/data';

interface ScoreRecord {
  game_id: string;
  player_name: string;
  score: number;
  created_at: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${mon}/${d.getFullYear()}`;
}

function toEntries(rows: ScoreRecord[]): LeaderboardEntry[] {
  return rows.map((row, i) => ({
    rank: i + 1,
    playerName: row.player_name,
    score: row.score,
    date: formatDate(row.created_at),
    gameId: row.game_id,
  }));
}

const COLUMNS = 'game_id, player_name, score, created_at';

/** Top N de un juego concreto, ordenado por puntuación descendente. */
export async function getGameLeaderboard(gameId: string, limit = 10): Promise<LeaderboardEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('scores')
    .select(COLUMNS)
    .eq('game_id', gameId)
    .order('score', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return toEntries(data ?? []);
}

/** Top N global cruzando todos los juegos, ordenado por puntuación descendente. */
export async function getGlobalLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('scores')
    .select(COLUMNS)
    .order('score', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return toEntries(data ?? []);
}
