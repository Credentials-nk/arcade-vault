'use client';

import TouchControls, { type TouchControlsProps } from '@/components/games/TouchControls';
import SkinModeSelect from '@/components/games/SkinModeSelect';
import type { SkinName } from '@/lib/skins';

interface TouchPlayerShellProps {
  /** Texto del bisel inferior («ASTEROIDS», «CAÍDA», …). Solo texto: no mueve nada. */
  title: string;
  /**
   * Mapeo de la botonera — una de las DOS únicas variaciones permitidas por
   * juego (la otra es `children`): qué botones están activos o muted, y
   * gamepad vs. drag. Con `drag`, el shell monta el overlay de arrastre
   * DENTRO de la caja (sobre el canvas) y ancla la fila PAUSA/MODO/SALIR al
   * pie en lugar del gamepad. `hidden` lo gobierna el shell vía `gameOver`.
   */
  touch: Omit<TouchControlsProps, 'hidden'>;
  paused: boolean;
  gameOver: boolean;
  onPauseToggle: () => void;
  onExit: () => void;
  displayMode: SkinName;
  onDisplayModeChange: (mode: SkinName) => void;
  /** Contenido del display: lo ÚNICO (junto al mapeo de botones) que cambia por juego. */
  children: React.ReactNode;
}

/**
 * Shell táctil INAMOVIBLE compartido por los 4 juegos (regla del usuario:
 * "para todos tiene que ser igual, lo único que cambia es el contenido del
 * display"). Estructura fija, calcada de Asteroids —la referencia—:
 *
 *   caja del display (.crt crt-800 → .crt-screen, 340px de alto en touch)
 *   + gamepad (TouchControls) debajo, anclado al pie
 *   + fila PAUSA/MODO/SALIR al final
 *
 * CERO knobs de layout por juego: cada juego adapta su render ADENTRO de la
 * caja (children) y declara su mapeo de botonera (touch). Nada más puede
 * variar. Montarlo solo cuando useTouchDevice() es true; el desktop conserva
 * su markup propio en cada página. Ver references/mobile-porter-todo.md.
 */
export default function TouchPlayerShell({
  title,
  touch,
  paused,
  gameOver,
  onPauseToggle,
  onExit,
  displayMode,
  onDisplayModeChange,
  children,
}: TouchPlayerShellProps) {
  const isDrag = Boolean(touch.drag);

  return (
    <>
      {/* La caja del display: misma en los 4 juegos, no se mueve ni cambia de tamaño */}
      <div className="crt crt-800">
        <div className="crt-screen" style={{ borderRadius: 0 }}>
          {children}
          {isDrag && <TouchControls drag hidden={gameOver} />}
          {paused && !gameOver && <div className="pause-overlay">EN PAUSA</div>}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {/* Gamepad debajo de la caja (cruceta izquierda, acciones derecha),
          anclado al pie por .av-player-touch .touch-controls */}
      {!isDrag && <TouchControls {...touch} hidden={gameOver} />}

      {/* Fila inferior fija; con drag no hay gamepad en flujo y esta fila
          toma el ancla al pie (touch-hud-actions-footer) */}
      {!gameOver && (
        <div
          className={`hud-actions touch-hud-actions${isDrag ? ' touch-hud-actions-footer' : ''}`}
        >
          <button className="btn yellow" onClick={onPauseToggle}>
            {paused ? 'REANUDAR' : 'PAUSA'}
          </button>
          <SkinModeSelect value={displayMode} onChange={onDisplayModeChange} />
          <button className="btn ghost" onClick={onExit}>
            SALIR
          </button>
        </div>
      )}
    </>
  );
}
