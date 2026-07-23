'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import FroggerGame from '@/components/games/frogger/FroggerGame';
import TouchPlayerShell from '@/components/games/TouchPlayerShell';
import SkinModeSelect from '@/components/games/SkinModeSelect';
import { useTouchDevice } from '@/hooks/useTouchDevice';
import { FroggerEngine, FroggerCallbacks } from '@/lib/games/frogger/game';
import { saveScore } from '@/app/actions/saveScore';
import { GAME_SKINS, SKINS, type SkinName } from '@/lib/skins';

const NAME_KEY = 'av_player_name';

export default function FroggerPage() {
  const router = useRouter();
  const engineRef = useRef<FroggerEngine | null>(null);
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
  // GAME_SKINS['frogger'] todavía no existe (@skin-designer la asigna en la
  // Fase B de /spec-impl-game) — fallback a 'neon', igual criterio que getSkin().
  const [displayMode, setDisplayMode] = useState<SkinName>(GAME_SKINS['frogger'] ?? 'neon');

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    engineRef.current?.setSkin(SKINS[displayMode]);
  }, [displayMode, gameKey]);

  useEffect(() => {
    // Lectura única de localStorage al montar (no una suscripción a cambios
    // externos) — el caso que la regla no cubre bien; ver hooks/useTouchDevice
    // para el patrón useSyncExternalStore cuando sí hace falta sincronización continua.
    const stored = localStorage.getItem(NAME_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setPlayerName(stored);
  }, []);

  const callbacks: FroggerCallbacks = {
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
        await saveScore('frogger', playerName || 'INVITADO', finalScore);
        if (playerName) localStorage.setItem(NAME_KEY, playerName);
        setSaved(true);
      } catch {
        setSaveError('Error al guardar. Intenta de nuevo.');
      }
    });
  }

  return (
    <div
      className={`av-player fade-in${isTouch ? ' av-player-touch' : ''}`}
      data-skin={displayMode}
    >
      {isTouch ? (
        <TouchPlayerShell
          title="FROGGER"
          touch={{
            dpad: ['up', 'left', 'right', 'down'],
            actions: [
              { label: 'B', muted: true, color: 'blue' },
              { label: 'A', muted: true, color: 'red' },
            ],
          }}
          paused={paused}
          gameOver={gameOver}
          onPauseToggle={handlePause}
          onExit={handleExit}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
        >
          <FroggerGame key={gameKey} callbacks={callbacks} engineRef={engineRef} heightPx={340} />
        </TouchPlayerShell>
      ) : (
        <>
          {/* HUD exterior (desktop) */}
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
              <SkinModeSelect value={displayMode} onChange={setDisplayMode} />
              <button className="btn ghost" onClick={handleExit}>
                SALIR
              </button>
            </div>
          </div>

          {/* Canvas dentro del marco CRT — .crt-frogger ajusta el aspect-ratio
              del visor a 640×560 (el 4:3 por defecto recortaría la fila de
              inicio, ver app/globals.css) */}
          <div className="crt crt-frogger">
            <div className="crt-screen" style={{ borderRadius: 0 }}>
              <FroggerGame key={gameKey} callbacks={callbacks} engineRef={engineRef} />
              {paused && !gameOver && <div className="pause-overlay">EN PAUSA</div>}
            </div>
            <div className="crt-bottom">
              <span className="led">SEÑAL OK</span>
              <span>FROGGER · CRT-83 · 60 HZ</span>
              <span>CARGA · 1MB</span>
            </div>
          </div>
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
