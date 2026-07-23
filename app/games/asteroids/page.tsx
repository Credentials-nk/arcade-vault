'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import AsteroidsGame from '@/components/games/asteroids/AsteroidsGame';
import TouchControls from '@/components/games/TouchControls';
import { useTouchDevice } from '@/hooks/useTouchDevice';
import { AsteroidsEngine, AsteroidsCallbacks } from '@/lib/games/asteroids/game';
import { saveScore } from '@/app/actions/saveScore';
import { GAME_SKINS, NEON, CLASICO, RETRO, type Skin, type SkinName } from '@/lib/skins';

const TOUCH_SKINS: Record<SkinName, Skin> = { neon: NEON, clasico: CLASICO, retro: RETRO };
const MODE_LABELS: Record<SkinName, string> = { neon: 'NEON', clasico: 'CLASSIC', retro: 'RETRO' };
const MODE_ORDER: SkinName[] = ['neon', 'clasico', 'retro'];

export default function AsteroidsPage() {
  const router = useRouter();
  const engineRef = useRef<AsteroidsEngine | null>(null);
  const isTouch = useTouchDevice();

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [playerName, setPlayerName] = useState('');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [gameKey, setGameKey] = useState(0);
  const [displayMode, setDisplayMode] = useState<SkinName>(GAME_SKINS['asteroids']);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [modeMenuUpward, setModeMenuUpward] = useState(true);
  const modeDropdownRef = useRef<HTMLDivElement>(null);

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!modeMenuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (!modeDropdownRef.current?.contains(e.target as Node)) {
        setModeMenuOpen(false);
      }
    }
    document.addEventListener('pointerdown', onClickOutside);
    return () => document.removeEventListener('pointerdown', onClickOutside);
  }, [modeMenuOpen]);

  // El selector de modo reemplaza a GAME_SKINS['asteroids'] como fuente de
  // verdad de la skin activa (arranca en la canónica) y la aplica en caliente
  // tanto al canvas (engine.setSkin) como al chrome (data-skin más abajo).
  useEffect(() => {
    engineRef.current?.setSkin(TOUCH_SKINS[displayMode]);
  }, [displayMode, gameKey]);

  const callbacks: AsteroidsCallbacks = {
    onScore: setScore,
    onLives: setLives,
    onLevel: setLevel,
    onGameOver: (s) => {
      setFinalScore(s);
      setGameOver(true);
    },
  };

  function handlePause() {
    const next = !paused;
    setPaused(next);
    engineRef.current?.setPaused(next);
  }

  function handleExit() {
    router.push('/library');
  }

  function handleRestart() {
    setGameOver(false);
    setSaved(false);
    setSaveError('');
    setScore(0);
    setLives(3);
    setLevel(1);
    setPaused(false);
    setGameKey((k) => k + 1);
  }

  function handleSave() {
    setSaveError('');
    startTransition(async () => {
      try {
        await saveScore('asteroids', playerName || 'INVITADO', finalScore);
        setSaved(true);
      } catch {
        setSaveError('Error al guardar. Intenta de nuevo.');
      }
    });
  }

  const modeDropdown = (
    <div className="mode-dropdown" ref={modeDropdownRef}>
      <button
        type="button"
        className="mode-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={modeMenuOpen}
        aria-label="Modo visual"
        onClick={() => {
          setModeMenuOpen((open) => {
            const next = !open;
            if (next) {
              // Elige el lado con más espacio libre: en touch el botón vive
              // pegado al footer (abre arriba); en desktop vive pegado al
              // header (abre abajo).
              const rect = modeDropdownRef.current?.getBoundingClientRect();
              const spaceAbove = rect?.top ?? 0;
              const spaceBelow = rect ? window.innerHeight - rect.bottom : 0;
              setModeMenuUpward(spaceAbove > spaceBelow);
            }
            return next;
          });
        }}
      >
        {MODE_LABELS[displayMode]} {modeMenuUpward ? '▲' : '▼'}
      </button>
      {modeMenuOpen && (
        <ul
          className={`mode-dropdown-list${modeMenuUpward ? '' : ' mode-dropdown-list-down'}`}
          role="listbox"
        >
          {MODE_ORDER.map((mode) => (
            <li key={mode}>
              <button
                type="button"
                role="option"
                aria-selected={displayMode === mode}
                onClick={() => {
                  setDisplayMode(mode);
                  setModeMenuOpen(false);
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

  return (
    <div
      className={`av-player fade-in${isTouch ? ' av-player-touch' : ''}`}
      data-skin={displayMode}
    >
      {/* HUD exterior — oculto en touch: el canvas de Asteroids ya dibuja SCORE/NIVEL/vidas */}
      {!isTouch && (
        <div className="player-hud">
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div className="hud-stat">
              <div className="l">Jugador</div>
              <div className="v" style={{ color: 'var(--ink)' }}>
                INVITADO
              </div>
            </div>
            <div className="hud-stat">
              <div className="l">Puntuación</div>
              <div className="v">{score.toLocaleString('es-ES')}</div>
            </div>
            <div className="hud-stat lives">
              <div className="l">Vidas</div>
              <div className="v">{'♥ '.repeat(Math.max(0, lives)).trim() || '—'}</div>
            </div>
            <div className="hud-stat level">
              <div className="l">Nivel</div>
              <div className="v">{String(level).padStart(2, '0')}</div>
            </div>
          </div>
          <div className="hud-actions">
            <button className="btn yellow" onClick={handlePause} disabled={gameOver}>
              {paused ? 'REANUDAR' : 'PAUSA'}
            </button>
            {modeDropdown}
            <button className="btn ghost" onClick={handleExit}>
              SALIR
            </button>
          </div>
        </div>
      )}

      {/* Canvas dentro del marco CRT */}
      <div className="crt crt-800">
        <div className="crt-screen" style={{ borderRadius: 0 }}>
          <AsteroidsGame
            key={gameKey}
            callbacks={callbacks}
            engineRef={engineRef}
            heightPx={isTouch ? 340 : undefined}
          />
          {paused && !gameOver && <div className="pause-overlay">EN PAUSA</div>}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>ASTEROIDS · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {isTouch && (
        <>
          <TouchControls
            dpad={['up', 'left', 'right', 'down']}
            dpadMuted={['down']}
            actions={[
              { label: 'B', muted: true, color: 'blue' },
              { label: 'A', synthKey: { code: 'Space', key: ' ' }, color: 'red' },
            ]}
            hidden={gameOver}
          />
          {!gameOver && (
            <div className="hud-actions touch-hud-actions">
              <button className="btn yellow" onClick={handlePause}>
                {paused ? 'REANUDAR' : 'PAUSA'}
              </button>
              {modeDropdown}
              <button className="btn ghost" onClick={handleExit}>
                SALIR
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal Game Over */}
      {gameOver && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{finalScore.toLocaleString('es-ES')}</div>

            {!saved ? (
              <>
                <div className="input-row">
                  <input
                    type="text"
                    placeholder="TUS INICIALES"
                    value={playerName}
                    maxLength={10}
                    onChange={(e) => setPlayerName(e.target.value.toUpperCase().slice(0, 10))}
                  />
                  <button className="btn yellow" onClick={handleSave} disabled={isPending}>
                    {isPending ? '...' : 'GUARDAR PUNTUACIÓN'}
                  </button>
                </div>
                {saveError && (
                  <p style={{ color: 'var(--magenta)', fontSize: 11, marginTop: 8 }}>{saveError}</p>
                )}
              </>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}

            <div className="actions">
              <button className="btn" onClick={handleRestart}>
                JUGAR DE NUEVO
              </button>
              <button className="btn magenta" onClick={() => router.push('/library')}>
                VOLVER AL VAULT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
