'use client';

import { useEffect, useRef, useState } from 'react';
import type { SkinName } from '@/lib/skins';

const MODE_LABELS: Record<SkinName, string> = { neon: 'NEON', clasico: 'CLASSIC', retro: 'RETRO' };
const MODE_ORDER: SkinName[] = ['neon', 'clasico', 'retro'];

interface SkinModeSelectProps {
  value: SkinName;
  onChange: (mode: SkinName) => void;
}

/**
 * Selector de skin (neon/clasico/retro) que reemplaza al botón ATRÁS en el
 * HUD de cada juego (desktop y táctil). Dropdown propio, no <select> nativo:
 * un <select> nativo siempre abre hacia abajo, y en la fila táctil (pegada
 * al footer) el navegador termina scrolleando la página para mostrar las
 * opciones. Este componente elige el lado con más espacio libre al abrirse
 * — arriba en la fila táctil (pegada al footer), abajo en el HUD de desktop
 * (pegado al header).
 */
export default function SkinModeSelect({ value, onChange }: SkinModeSelectProps) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onClickOutside);
    return () => document.removeEventListener('pointerdown', onClickOutside);
  }, [open]);

  return (
    <div className="mode-dropdown" ref={ref}>
      <button
        type="button"
        className="mode-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Modo visual"
        onClick={() => {
          setOpen((prev) => {
            const next = !prev;
            if (next) {
              const rect = ref.current?.getBoundingClientRect();
              const spaceAbove = rect?.top ?? 0;
              const spaceBelow = rect ? window.innerHeight - rect.bottom : 0;
              setOpenUpward(spaceAbove > spaceBelow);
            }
            return next;
          });
        }}
      >
        {MODE_LABELS[value]} {openUpward ? '▲' : '▼'}
      </button>
      {open && (
        <ul
          className={`mode-dropdown-list${openUpward ? '' : ' mode-dropdown-list-down'}`}
          role="listbox"
        >
          {MODE_ORDER.map((mode) => (
            <li key={mode}>
              <button
                type="button"
                role="option"
                aria-selected={value === mode}
                onClick={() => {
                  onChange(mode);
                  setOpen(false);
                }}
              >
                {MODE_LABELS[mode]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
