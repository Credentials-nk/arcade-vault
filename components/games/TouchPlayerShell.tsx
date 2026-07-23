'use client';

import TouchControls, { type TouchControlsProps } from '@/components/games/TouchControls';
import SkinModeSelect from '@/components/games/SkinModeSelect';
import type { SkinName } from '@/lib/skins';

/* Con mapeo drag (bloque-buster) el juego no consume el gamepad, pero el
   panel MK-II se muestra completo igual — decisión del usuario, textual:
   "poner ese gamepad en los 4" — con cruceta y A/B muted (decorativos,
   cero dispatch). El control real es el overlay de arrastre dentro de la
   caja, montado por separado vía la prop `dragOverlay` del shell. */
export const DRAG_DECORATIVE_PAD: Omit<TouchControlsProps, 'hidden' | 'drag'> = {
  dpad: ['up', 'left', 'right', 'down'],
  dpadMuted: ['up', 'left', 'right', 'down'],
  actions: [
    { label: 'B', muted: true, color: 'blue' },
    { label: 'A', muted: true, color: 'red' },
  ],
};

interface TouchPlayerShellProps {
  /** Texto del bisel inferior («ASTEROIDS», «CAÍDA», …). Solo texto: no mueve nada. */
  title: string;
  /**
   * Mapeo de la botonera del panel — una de las DOS únicas variaciones
   * permitidas por juego (la otra es `children`): qué botones están activos
   * o muted. Nunca incluye `drag` (ver `dragOverlay`). `hidden` lo gobierna
   * el shell vía `gameOver`.
   */
  touch: Omit<TouchControlsProps, 'hidden' | 'drag'>;
  /**
   * true = el juego se controla arrastrando sobre el canvas (bloque-buster):
   * el shell monta ADEMÁS el overlay de arrastre real DENTRO de la caja del
   * display. El panel de gamepad se muestra igual (decorativo vía `touch`).
   */
  dragOverlay?: boolean;
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
 * display"). Estructura fija:
 *
 *   caja del display (.crt crt-800 → .crt-screen, 340px de alto en touch)
 *   + panel Gamepad MK-II (.touch-gamepad, UNA sola pieza) debajo, anclado
 *     al pie: cruceta + A/B arriba, y la fila PAUSA/MODO/SALIR integrada
 *     como sección inferior DEL MISMO panel (ver
 *     references/gamepad-assets/mobile-layout-target.png — la verdad visual)
 *
 * CERO knobs de layout por juego: cada juego adapta su render ADENTRO de la
 * caja (children) y declara su mapeo de botonera (touch/dragOverlay). Nada
 * más puede variar — el panel se monta en los 4 juegos por igual, incluido
 * bloque-buster (panel decorativo + overlay de arrastre real en la caja).
 * Montarlo solo cuando useTouchDevice() es true; el desktop conserva su
 * markup propio en cada página. Ver references/mobile-porter-todo.md.
 */
export default function TouchPlayerShell({
  title,
  touch,
  dragOverlay,
  paused,
  gameOver,
  onPauseToggle,
  onExit,
  displayMode,
  onDisplayModeChange,
  children,
}: TouchPlayerShellProps) {
  return (
    <>
      {/* La caja del display: misma en los 4 juegos, no se mueve ni cambia de tamaño */}
      <div className="crt crt-800">
        <div className="crt-screen" style={{ borderRadius: 0 }}>
          {children}
          {dragOverlay && <TouchControls drag hidden={gameOver} />}
          {paused && !gameOver && <div className="pause-overlay">EN PAUSA</div>}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {/* Panel Gamepad MK-II: UNA sola pieza (cruceta+A/B arriba, fila
          PAUSA/MODO/SALIR integrada abajo), anclada al pie por
          .av-player-touch .touch-gamepad. Se oculta completa con el modal
          de game over, igual que antes. */}
      {!gameOver && (
        <div className="touch-gamepad">
          <TouchControls {...touch} />
          <div className="hud-actions touch-gamepad-footer">
            <button className="btn yellow" onClick={onPauseToggle}>
              {paused ? 'REANUDAR' : 'PAUSA'}
            </button>
            <SkinModeSelect value={displayMode} onChange={onDisplayModeChange} />
            <button className="btn ghost" onClick={onExit}>
              SALIR
            </button>
          </div>
        </div>
      )}
    </>
  );
}
