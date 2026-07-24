'use server';

import { createClient } from '@/lib/supabase/server';

// Espeja el CHECK constraint de `scores`: `score >= 0 AND score < 9999999`.
const MAX_SCORE = 9999999;

export async function saveScore(gameId: string, playerName: string, score: number) {
  // Guard clauses: `saveScore` es un endpoint HTTP público (Server Action) y los
  // tipos de TypeScript no validan en runtime. Cada chequeo espeja una restricción
  // real ya vigente en la tabla `scores`: `game_id` no nulo (+ FK a `games`),
  // `char_length(player_name) <= 10`, y `score >= 0 AND score < 9999999`.
  if (typeof gameId !== 'string') {
    throw new Error('gameId inválido.');
  }
  if (typeof playerName !== 'string' || playerName.length > 10) {
    throw new Error('playerName inválido.');
  }
  if (!Number.isInteger(score) || score < 0 || score >= MAX_SCORE) {
    throw new Error('score inválido.');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('scores')
    .insert({ game_id: gameId, player_name: playerName, score });

  if (error) throw new Error(error.message);
}
