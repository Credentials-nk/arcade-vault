import { useEffect, useState } from 'react';

/**
 * Detecta si el dispositivo es táctil vía `(pointer: coarse)`.
 * Inicializa en `false` y resuelve en cliente para evitar
 * mismatch de hidratación (el servidor no conoce el pointer).
 */
export function useTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    setIsTouch(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isTouch;
}
