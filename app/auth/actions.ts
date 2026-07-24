'use server';

import { createClient } from '@/lib/supabase/server';

type AuthResult = { ok: true } | { ok: false; error: string };

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signUpWithEmail(
  email: string,
  password: string,
  username: string
): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
