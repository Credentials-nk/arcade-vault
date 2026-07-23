'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import CaidaGame from '@/components/games/caida/CaidaGame';
import TouchPlayerShell from '@/components/games/TouchPlayerShell';
import SkinModeSelect from '@/components/games/SkinModeSelect';
import { useTouchDevice } from '@/hooks/useTouchDevice';
import { TetrisEngine, TetrisCallbacks } from '@/lib/games/caida/game';
import { saveScore } from '@/app/actions/saveScore';
import { GAME_SKINS, SKINS, type SkinName } from '@/lib/skins';

export default function CaidaPage() {
  const router = useRouter();
  const engineRef = useRef<TetrisEngine | null>(null);
  const isTouch = useTouchDevice();

  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [playerName, setPlayerName] = useState('');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [gameKey, setGameKey] = useState(0);
  const [displayMode, setDisplayMode] = useState<SkinName>(GAME_SKINS['caida']);

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    engineRef.current?.setSkin(SKINS[displayMode]);
  }, [displayMode, gameKey]);

  const callbacks: TetrisCallbacks = {
    onScore: setScore,
    onLines: setLines,
    onLevel: setLevel,
    onGameOver: (s) => {
      setFinalScore(s);
      setGameOver(true);
    },
  };

  // La pausa es una sola: botón y tecla P pasan por acá para no desincronizar el HUD.
  const togglePause = useCallback(() => {
    setPaused((prev) => {
      const nextPaused = !prev;
      engineRef.current?.setPaused(nextPaused);
      return nextPaused;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyP') togglePause();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePause]);

  function handleExit() {
    router.push('/library');
  }

  function handleRestart() {
    setGameOver(false);
    setSaved(false);
    setSaveError('');
    setScore(0);
    setLines(0);
    setLevel(1);
    setPaused(false);
    setGameKey((k) => k + 1);
  }

  function handleSave() {
    setSaveError('');
    startTransition(async () => {
      try {
        await saveScore('caida', playerName || 'INVITADO', finalScore);
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
        /* Shell táctil compartido. Contenido del display: tablero por altura
           (340px, sin distorsión) + panel «SIGUIENTE» al costado, con las
           stats (puntuación/líneas/nivel) DENTRO de la caja, bajo el panel —
           el canvas de Caída no las dibuja y el player-hud está oculto. */
        <TouchPlayerShell
          title="CAÍDA"
          touch={{
            dpad: ['up', 'left', 'right', 'down'],
            dpadMuted: ['up'],
            dpadRepeat: true,
            actions: [
              {
                label: 'B',
                caption: 'ROTAR',
                synthKey: { code: 'ArrowUp', key: 'ArrowUp' },
                color: 'blue',
              },
              {
                label: 'A',
                caption: 'SOLTAR',
                synthKey: { code: 'Space', key: ' ' },
                color: 'red',
              },
            ],
          }}
          paused={paused}
          gameOver={gameOver}
          onPauseToggle={togglePause}
          onExit={handleExit}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
        >
          <CaidaGame
            key={gameKey}
            callbacks={callbacks}
            engineRef={engineRef}
            heightPx={340}
            panelExtra={
              <div className="touch-panel-stats">
                <div className="hud-stat">
                  <div className="l">Puntos</div>
                  <div className="v">{score.toLocaleString('es-ES')}</div>
                </div>
                <div className="hud-stat">
                  <div className="l">Líneas</div>
                  <div className="v">{lines}</div>
                </div>
                <div className="hud-stat level">
                  <div className="l">Nivel</div>
                  <div className="v">{String(level).padStart(2, '0')}</div>
                </div>
              </div>
            }
          />
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
              <div className="hud-stat">
                <div className="l">Líneas</div>
                <div className="v">{lines}</div>
              </div>
              <div className="hud-stat level">
                <div className="l">Nivel</div>
                <div className="v">{String(level).padStart(2, '0')}</div>
              </div>
            </div>
            <div className="hud-actions">
              <button className="btn yellow" onClick={togglePause} disabled={gameOver}>
                {paused ? 'REANUDAR' : 'PAUSA'}
              </button>
              <SkinModeSelect value={displayMode} onChange={setDisplayMode} />
              <button className="btn ghost" onClick={handleExit}>
                SALIR
              </button>
            </div>
          </div>

          {/* Canvas dentro del marco CRT */}
          <div className="crt">
            <div className="crt-screen" style={{ borderRadius: 0 }}>
              <CaidaGame key={gameKey} callbacks={callbacks} engineRef={engineRef} />
              {paused && !gameOver && <div className="pause-overlay">EN PAUSA</div>}
            </div>
            <div className="crt-bottom">
              <span className="led">SEÑAL OK</span>
              <span>CAÍDA · CRT-83 · 60 HZ</span>
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
