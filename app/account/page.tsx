'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';

export default function AccountPage() {
  const router = useRouter();
  const { user, isLoading, signOut } = useUser();

  useEffect(() => {
    if (!isLoading && !user) router.replace('/auth');
  }, [isLoading, user, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (isLoading || !user) return null;

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">MI CUENTA</h2>
        </div>

        <div className="account-page-profile">
          {user.avatarUrl ? (
            <img
              className="account-avatar"
              src={user.avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="account-avatar account-avatar-fallback">{user.name.charAt(0)}</span>
          )}
          <div>
            <div className="account-dropdown-name">{user.name}</div>
            {user.email && <div className="account-dropdown-email">{user.email}</div>}
          </div>
        </div>

        <button
          className="btn magenta lg"
          style={{ width: '100%', marginTop: 20 }}
          onClick={handleSignOut}
        >
          CERRAR SESIÓN
        </button>
      </div>
    </div>
  );
}
