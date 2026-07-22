import { useSyncExternalStore } from 'react';

const QUERY = '(pointer: coarse)';

function subscribe(callback: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false; // el servidor no conoce el pointer → sin mismatch de hidratación
}

/**
 * Detecta si el dispositivo es táctil vía `(pointer: coarse)`.
 * En servidor devuelve `false`; en cliente se suscribe al media
 * query y refleja cambios en vivo.
 */
export function useTouchDevice(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
