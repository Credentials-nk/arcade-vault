'use client';

import { usePathname } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import { useTouchDevice } from '@/hooks/useTouchDevice';
import Nav from './Nav';

export default function NavWrapper() {
  const { user, isLoading, signOut } = useUser();
  const pathname = usePathname();
  const isTouch = useTouchDevice();

  // En touch, la pantalla de juego (con el gamepad) oculta el nav
  // para ganar espacio vertical y evitar scroll.
  if (isTouch && pathname?.startsWith('/games/')) return null;

  return <Nav user={user} isLoading={isLoading} onSignOut={signOut} />;
}
