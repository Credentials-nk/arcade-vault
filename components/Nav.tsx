'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { AuthUser } from '@/lib/auth';

interface NavProps {
  user: AuthUser | null;
  isLoading: boolean;
  onSignOut: () => Promise<void> | void;
}

function Avatar({ user }: { user: AuthUser }) {
  if (user.avatarUrl) {
    return (
      <img className="account-avatar" src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
    );
  }
  return <span className="account-avatar account-avatar-fallback">{user.name.charAt(0)}</span>;
}

export default function Nav({ user, isLoading, onSignOut }: NavProps) {
  const [open, setOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/library') return pathname === '/library' || pathname.startsWith('/game');
    return pathname.startsWith(href);
  };

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const [menuClosedForPathname, setMenuClosedForPathname] = useState(pathname);
  if (pathname !== menuClosedForPathname) {
    setMenuClosedForPathname(pathname);
    if (accountMenuOpen) setAccountMenuOpen(false);
  }

  useEffect(() => {
    if (!accountMenuOpen) return;
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (!accountMenuRef.current?.contains(e.target as Node)) setAccountMenuOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [accountMenuOpen]);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setIsSigningOut(false);
      setAccountMenuOpen(false);
    }
  };

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo">
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>

        <div className="links">
          <Link href="/" className={isActive('/') ? 'active' : ''}>
            Inicio
          </Link>
          <Link href="/library" className={isActive('/library') ? 'active' : ''}>
            Biblioteca
          </Link>
          <Link href="/hall" className={isActive('/hall') ? 'active' : ''}>
            Salón de la Fama
          </Link>
          <Link href="/about" className={isActive('/about') ? 'active' : ''}>
            Acerca de
          </Link>
        </div>

        <div className="spacer"></div>

        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>

        {!isLoading &&
          (user ? (
            <div className="account-menu" ref={accountMenuRef}>
              <button
                className="btn ghost auth-btn account-trigger"
                onClick={() => setAccountMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
              >
                <Avatar user={user} />
                {user.name}
                <span className={'chevron' + (accountMenuOpen ? ' up' : '')} />
              </button>

              <div className={'account-dropdown' + (accountMenuOpen ? ' open' : '')} role="menu">
                <div className="account-dropdown-header">
                  <Avatar user={user} />
                  <div className="account-dropdown-id">
                    <div className="account-dropdown-name">{user.name}</div>
                    {user.email && <div className="account-dropdown-email">{user.email}</div>}
                  </div>
                </div>
                <button
                  className="account-dropdown-signout"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  role="menuitem"
                >
                  {isSigningOut ? 'CERRANDO…' : 'CERRAR SESIÓN'}
                </button>
              </div>
            </div>
          ) : (
            <Link href="/auth" className="btn auth-btn">
              Iniciar Sesión
            </Link>
          ))}

        <button className="btn ghost hamburger" onClick={() => setOpen(true)} aria-label="Menú">
          ≡
        </button>
      </nav>

      <div
        className={'av-mobile-backdrop' + (open ? ' open' : '')}
        onClick={() => setOpen(false)}
      />

      <aside className={'av-mobile-panel' + (open ? ' open' : '')}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>
          MENÚ
        </div>
        <a
          className={isActive('/') ? 'active' : ''}
          onClick={() => go('/')}
          style={{ cursor: 'pointer' }}
        >
          Inicio
        </a>
        <a
          className={isActive('/library') ? 'active' : ''}
          onClick={() => go('/library')}
          style={{ cursor: 'pointer' }}
        >
          Biblioteca
        </a>
        <a
          className={isActive('/hall') ? 'active' : ''}
          onClick={() => go('/hall')}
          style={{ cursor: 'pointer' }}
        >
          Salón de la Fama
        </a>
        <a
          className={isActive('/about') ? 'active' : ''}
          onClick={() => go('/about')}
          style={{ cursor: 'pointer' }}
        >
          Acerca de
        </a>
        {user ? (
          <a
            onClick={() => {
              setOpen(false);
              handleSignOut();
            }}
            style={{ cursor: 'pointer' }}
          >
            {isSigningOut ? 'CERRANDO…' : `CERRAR SESIÓN (${user.name})`}
          </a>
        ) : (
          <a
            className={isActive('/auth') ? 'active' : ''}
            onClick={() => go('/auth')}
            style={{ cursor: 'pointer' }}
          >
            Iniciar Sesión
          </a>
        )}
        <div style={{ flex: 1 }} />
        <div
          className="pixel"
          style={{
            fontSize: 9,
            color: 'var(--ink-faint)',
            letterSpacing: '0.16em',
          }}
        >
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
