'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useUser } from '@/hooks/useUser';
import { createClient } from '@/lib/supabase/client';
import { signInWithEmail, signUpWithEmail } from './actions';

export default function AuthPage() {
  const router = useRouter();
  const { signOut } = useUser();
  const [tab, setTab] = useState<'in' | 'up'>('in');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result =
        tab === 'in'
          ? await signInWithEmail(email.trim(), pass)
          : await signUpWithEmail(email.trim(), pass, user.trim() || 'PLAYER1');
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push('/');
      router.refresh();
    });
  };

  const asGuest = async () => {
    await signOut();
    router.push('/');
  };

  const withOAuth = (provider: 'google' | 'github') => {
    const supabase = createClient();
    supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--ink-faint)',
              letterSpacing: '0.16em',
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button className={tab === 'in' ? 'on' : ''} onClick={() => setTab('in')}>
            INICIAR SESIÓN
          </button>
          <button className={tab === 'up' ? 'on' : ''} onClick={() => setTab('up')}>
            CREAR CUENTA
          </button>
        </div>

        <form onSubmit={submit}>
          {tab === 'up' && (
            <div className="field slide-in">
              <label>Usuario</label>
              <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="px_kai" />
            </div>
          )}
          <div className="field">
            <label>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@vault.gg"
              required
            />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
            />
          </div>
          {error && (
            <div
              className="mono"
              style={{ fontSize: 11, color: 'var(--magenta, #f0f)', marginTop: 4 }}
            >
              {error}
            </div>
          )}
          <button
            className="btn lg"
            type="submit"
            disabled={isPending}
            style={{ width: '100%', marginTop: 8 }}
          >
            {isPending ? '...' : tab === 'in' ? 'ENTRAR AL VAULT' : 'CREAR Y JUGAR'}
          </button>
        </form>

        <button className="btn ghost" style={{ width: '100%', marginTop: 10 }} onClick={asGuest}>
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button className="btn ghost" type="button" onClick={() => withOAuth('google')}>
            ◆&nbsp; GOOGLE
          </button>
          <button className="btn ghost" type="button" onClick={() => withOAuth('github')}>
            ▣&nbsp; GITHUB
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: 'center',
            fontSize: 11,
            color: 'var(--ink-faint)',
            letterSpacing: '0.1em',
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
