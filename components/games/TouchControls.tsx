'use client';

import { useEffect, useRef } from 'react';

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface SyntheticKey {
  code: string; // ej. 'Space' — leído por asteroids/caida (e.code)
  key: string; // ej. ' '   — leído por serpentina/bloque-buster (e.key)
}

export type ActionColor = 'red' | 'yellow' | 'blue';

export interface TouchAction {
  label: string; // letra grande del botón, estilo MK-II (ej. 'A', 'B')
  caption?: string; // acción real como texto chico bajo la letra (ej. 'ROTAR') — no altera tamaño ni posición del botón
  synthKey?: SyntheticKey; // omitido si muted
  repeat?: boolean; // re-despacha keydown en press-and-hold
  muted?: boolean; // decorativo, sin dispatch — paridad visual con un gamepad de 2 botones
  color?: ActionColor; // default 'red'
}

export interface TouchControlsProps {
  dpad?: Dir[]; // direcciones visibles; omitido = sin cruceta
  dpadMuted?: Dir[]; // direcciones presentes pero decorativas (atenuadas, sin dispatch)
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

/* Flechas del D-pad MK-II (triángulos SVG, ver references/gamepad-assets/gamepad.html) */
const DIR_ARROWS: Record<Dir, string> = {
  up: 'M12 4 L20 16 L4 16 Z',
  right: 'M8 4 L20 12 L8 20 Z',
  down: 'M4 8 L20 8 L12 20 Z',
  left: 'M16 4 L16 20 L4 12 Z',
};

function DirArrow({ dir }: { dir: Dir }) {
  return (
    <svg className="touch-dpad-arrow" viewBox="0 0 24 24" aria-hidden="true">
      <path d={DIR_ARROWS[dir]} fill="currentColor" />
    </svg>
  );
}

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
  children,
  synthKey,
  repeat,
  className,
  ariaLabel,
}: {
  children: React.ReactNode;
  synthKey: SyntheticKey;
  repeat?: boolean;
  className: string;
  ariaLabel?: string;
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
      aria-label={ariaLabel}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
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

/* Contenido interno de un botón de acción MK-II: anillo punteado (visible al
   presionar), letra pixel grande y caption opcional con la acción real. */
function ActionContent({ action }: { action: TouchAction }) {
  return (
    <>
      <span className="touch-action-ring" aria-hidden="true" />
      <span className="touch-action-letter">{action.label}</span>
      {action.caption && <span className="touch-action-caption">{action.caption}</span>}
    </>
  );
}

/**
 * Cuerpo del gamepad virtual táctil (spec 11), estilo MK-II (corrida 3 de
 * @mobile-porter — CSS portado de references/gamepad-assets/gamepad.html):
 * cruceta posicionada con hub central y gema LED a la izquierda, botones
 * A/B circulares a la derecha. Solo cambió la presentación: el dispatch de
 * eventos sintéticos, el pointer capture y el auto-repeat son los mismos
 * del spec 11 y no tocan los engines. Vive dentro del panel .touch-gamepad
 * que arma TouchPlayerShell.
 */
export default function TouchControls({
  dpad,
  dpadMuted,
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
              synthKey={DIR_KEYS[dir]}
              repeat={dpadRepeat}
              ariaLabel={dir}
              className={`touch-btn touch-dpad-btn touch-dpad-${dir}${dpadMuted?.includes(dir) ? ' touch-dpad-muted' : ''}`}
            >
              <DirArrow dir={dir} />
            </TouchButton>
          ))}
          <div className="touch-dpad-hub" aria-hidden="true">
            <span className="touch-dpad-gem" />
          </div>
        </div>
      )}
      {actions && actions.length > 0 && (
        <div className="touch-actions">
          {actions.map((a) =>
            a.muted || !a.synthKey ? (
              <div
                key={a.label}
                className={`touch-btn touch-action-btn touch-action-${a.color ?? 'red'} touch-action-muted`}
                aria-hidden="true"
              >
                <ActionContent action={a} />
              </div>
            ) : (
              <TouchButton
                key={a.label}
                synthKey={a.synthKey}
                repeat={a.repeat}
                ariaLabel={a.caption ?? a.label}
                className={`touch-btn touch-action-btn touch-action-${a.color ?? 'red'}`}
              >
                <ActionContent action={a} />
              </TouchButton>
            )
          )}
        </div>
      )}
    </div>
  );
}
