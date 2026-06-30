'use server';

import { createClient } from '@/lib/supabase/server';

export async function saveScore(gameId: string, playerName: string, score: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('scores')
    .insert({ game_id: gameId, player_name: playerName, score });

  if (error) throw new Error(error.message);
}
