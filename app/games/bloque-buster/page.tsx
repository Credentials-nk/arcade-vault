'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import BloqueBusterGame from '@/components/games/bloque-buster/BloqueBusterGame';
import { ArkanoidEngine, ArkanoidCallbacks } from '@/lib/games/bloque-buster/game';
import { saveScore } from '@/app/actions/saveScore';
import { GAME_SKINS } from '@/lib/skins';

export default function BloqueBusterPage() {
  const router = useRouter();
  const engineRef = useRef<ArkanoidEngine | null>(null);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [playerName, setPlayerName] = useState('');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [gameKey, setGameKey] = useState(0);

  const [isPending, startTransition] = useTransition();

  const callbacks: ArkanoidCallbacks = {
    onScore: setScore,
    onLives: setLives,
    onLevel: setLevel,
    onGameOver: (s, w) => {
      setFinalScore(s);
      setWon(w);
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
    setWon(false);
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
        await saveScore('bloque-buster', playerName || 'INVITADO', finalScore);
        setSaved(true);
      } catch {
        setSaveError('Error al guardar. Intenta de nuevo.');
      }
    });
  }

  return (
    <div className="av-player fade-in" data-skin={GAME_SKINS['bloque-buster']}>
      {/* HUD exterior */}
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
          <button className="btn ghost" onClick={handleExit}>
            SALIR
          </button>
        </div>
      </div>

      {/* Canvas dentro del marco CRT */}
      <div className="crt">
        <div className="crt-screen" style={{ borderRadius: 0 }}>
          <BloqueBusterGame key={gameKey} callbacks={callbacks} engineRef={engineRef} />
          {paused && !gameOver && <div className="pause-overlay">EN PAUSA</div>}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>BLOQUE BUSTER · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {/* Modal Game Over / Victoria */}
      {gameOver && (
        <div className="modal-bd">
          <div className="modal">
            <h2>{won ? '¡COMPLETADO!' : 'FIN DEL JUEGO'}</h2>
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
