'use client';

import { useEffect, useRef } from 'react';

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface SyntheticKey {
  code: string; // ej. 'Space' — leído por asteroids/caida (e.code)
  key: string; // ej. ' '   — leído por serpentina/bloque-buster (e.key)
}

export interface TouchAction {
  label: string; // ej. 'FUEGO', 'ROTAR'
  synthKey: SyntheticKey;
  repeat?: boolean; // re-despacha keydown en press-and-hold
}

export interface TouchControlsProps {
  dpad?: Dir[]; // direcciones visibles; omitido = sin cruceta
  dpadRepeat?: boolean; // caida: true
  actions?: TouchAction[];
  drag?: boolean; // bloque-buster: overlay de arrastre
  hidden?: boolean; // true cuando el modal de game over está abierto
}

const REPEAT_DELAY_MS = 200;
const REPEAT_INTERVAL_MS = 120;

const DIR_KEYS: Record<Dir, SyntheticKey> = {
  up: { code: 'ArrowUp', key: 'ArrowUp' },
  down: { code: 'ArrowDown', key: 'ArrowDown' },
  left: { code: 'ArrowLeft', key: 'ArrowLeft' },
  right: { code: 'ArrowRight', key: 'ArrowRight' },
};

const DIR_GLYPHS: Record<Dir, string> = {
  up: '▲',
  down: '▼',
  left: '◀',
  right: '▶',
};

function dispatchKey(type: 'keydown' | 'keyup', k: SyntheticKey) {
  window.dispatchEvent(new KeyboardEvent(type, { code: k.code, key: k.key, bubbles: true }));
}

/**
 * Botón táctil que despacha KeyboardEvent sintéticos en window:
 * keydown al presionar, keyup al soltar. Con `repeat`, re-despacha
 * keydown cada REPEAT_INTERVAL_MS tras REPEAT_DELAY_MS de demora.
 * Cada botón captura su propio pointer (multi-touch: cruceta y
 * acción funcionan en simultáneo).
 */
function TouchButton({
  label,
  synthKey,
  repeat,
  className,
}: {
  label: string;
  synthKey: SyntheticKey;
  repeat?: boolean;
  className: string;
}) {
  const pressedRef = useRef(false);
  const delayRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const clearTimers = () => {
    if (delayRef.current !== null) {
      window.clearTimeout(delayRef.current);
      delayRef.current = null;
    }
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const release = () => {
    if (!pressedRef.current) return;
    pressedRef.current = false;
    clearTimers();
    dispatchKey('keyup', synthKey);
  };

  const press = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    if (pressedRef.current) return;
    pressedRef.current = true;
    dispatchKey('keydown', synthKey);
    if (repeat) {
      delayRef.current = window.setTimeout(() => {
        intervalRef.current = window.setInterval(() => {
          dispatchKey('keydown', synthKey);
        }, REPEAT_INTERVAL_MS);
      }, REPEAT_DELAY_MS);
    }
  };

  // Al desmontar (salir / remontar por restart): soltar tecla pegada.
  useEffect(() => {
    return () => {
      if (pressedRef.current) {
        pressedRef.current = false;
        clearTimers();
        dispatchKey('keyup', synthKey);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button
      type="button"
      className={className}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

/**
 * Overlay transparente sobre el canvas (bloque-buster): traduce el
 * arrastre del dedo a MouseEvent('mousemove') sintético sobre el
 * canvas hermano, reutilizando el listener onMouseMove del engine.
 */
function DragLayer() {
  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const canvas = e.currentTarget.parentElement?.querySelector('canvas');
    if (!canvas) return;
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: e.clientX, clientY: e.clientY }));
  };

  return (
    <div
      className="touch-drag-layer"
      onPointerDown={handleMove}
      onPointerMove={handleMove}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}

/**
 * Gamepad virtual táctil (spec 11). Renderizarlo solo cuando
 * useTouchDevice() es true; `hidden` lo oculta durante el modal
 * de game over. No toca los engines: solo despacha eventos
 * sintéticos que los listeners existentes ya entienden.
 */
export default function TouchControls({
  dpad,
  dpadRepeat,
  actions,
  drag,
  hidden,
}: TouchControlsProps) {
  if (hidden) return null;

  if (drag) return <DragLayer />;

  return (
    <div className="touch-controls">
      {dpad && dpad.length > 0 && (
        <div className="touch-dpad">
          {dpad.map((dir) => (
            <TouchButton
              key={dir}
              label={DIR_GLYPHS[dir]}
              synthKey={DIR_KEYS[dir]}
              repeat={dpadRepeat}
              className={`touch-btn touch-dpad-btn touch-dpad-${dir}`}
            />
          ))}
        </div>
      )}
      {actions && actions.length > 0 && (
        <div className="touch-actions">
          {actions.map((a) => (
            <TouchButton
              key={a.label}
              label={a.label}
              synthKey={a.synthKey}
              repeat={a.repeat}
              className="touch-btn touch-action-btn"
            />
          ))}
        </div>
      )}
    </div>
  );
}
