import type { User } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email: string | null;
  name: string;
}

export function resolveDisplayName(user: User): string {
  const metadata = user.user_metadata ?? {};
  const raw =
    (typeof metadata.username === 'string' && metadata.username) ||
    (typeof metadata.full_name === 'string' && metadata.full_name) ||
    (typeof metadata.name === 'string' && metadata.name) ||
    user.email?.split('@')[0] ||
    'INVITADO';
  return raw.toUpperCase().slice(0, 10);
}

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email ?? null,
    name: resolveDisplayName(user),
  };
}
