import type { User } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
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

export function resolveAvatarUrl(user: User): string | null {
  const metadata = user.user_metadata ?? {};
  return (
    (typeof metadata.avatar_url === 'string' && metadata.avatar_url) ||
    (typeof metadata.picture === 'string' && metadata.picture) ||
    null
  );
}

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email ?? null,
    name: resolveDisplayName(user),
    avatarUrl: resolveAvatarUrl(user),
  };
}
