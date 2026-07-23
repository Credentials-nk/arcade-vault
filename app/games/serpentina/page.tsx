'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import SerpentinaGame from '@/components/games/serpentina/SerpentinaGame';
import TouchControls from '@/components/games/TouchControls';
import SkinModeSelect from '@/components/games/SkinModeSelect';
import { useTouchDevice } from '@/hooks/useTouchDevice';
import { SerpentinaEngine, SerpentinaCallbacks } from '@/lib/games/serpentina/game';
import { saveScore } from '@/app/actions/saveScore';
import { GAME_SKINS, SKINS, type SkinName } from '@/lib/skins';

export default function SerpentinaPage() {
  const router = useRouter();
  const engineRef = useRef<SerpentinaEngine | null>(null);
  const isTouch = useTouchDevice();

  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [playerName, setPlayerName] = useState('');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [gameKey, setGameKey] = useState(0);
  const [displayMode, setDisplayMode] = useState<SkinName>(GAME_SKINS['serpentina']);

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    engineRef.current?.setSkin(SKINS[displayMode]);
  }, [displayMode, gameKey]);

  const callbacks: SerpentinaCallbacks = {
    onScore: setScore,
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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && !gameOver) {
        handlePause();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, gameOver]);

  function handleExit() {
    router.push('/library');
  }

  function handleRestart() {
    setGameOver(false);
    setSaved(false);
    setSaveError('');
    setScore(0);
    setLevel(1);
    setPaused(false);
    setGameKey((k) => k + 1);
  }

  function handleSave() {
    setSaveError('');
    startTransition(async () => {
      try {
        await saveScore('serpentina', playerName || 'INVITADO', finalScore);
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
      {/* HUD exterior — oculto en touch: el canvas de Serpentina ya dibuja el juego */}
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
      )}

      {/* Canvas dentro del marco CRT */}
      <div className="crt">
        <div className="crt-screen" style={{ borderRadius: 0 }}>
          <SerpentinaGame key={gameKey} callbacks={callbacks} engineRef={engineRef} />
          {paused && !gameOver && <div className="pause-overlay">EN PAUSA</div>}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>SERPENTINA · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {isTouch && (
        <>
          <TouchControls dpad={['up', 'left', 'right', 'down']} hidden={gameOver} />
          {!gameOver && (
            <div className="hud-actions touch-hud-actions">
              <button className="btn yellow" onClick={handlePause}>
                {paused ? 'REANUDAR' : 'PAUSA'}
              </button>
              <SkinModeSelect value={displayMode} onChange={setDisplayMode} />
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
