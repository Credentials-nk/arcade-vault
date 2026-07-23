'use client';

import { useEffect, useRef } from 'react';
import { TetrisEngine, TetrisCallbacks } from '@/lib/games/caida/game';
import { getSkin } from '@/lib/skins';

interface CaidaGameProps {
  callbacks: TetrisCallbacks;
  engineRef: React.MutableRefObject<TetrisEngine | null>;
  heightPx?: number; // override de altura del tablero (criterio táctil unificado — ver references/mobile-porter-todo.md)
  panelExtra?: React.ReactNode; // contenido extra bajo el panel «SIGUIENTE» (touch: stats DENTRO de la caja del display)
}

export default function CaidaGame({ callbacks, engineRef, heightPx, panelExtra }: CaidaGameProps) {
  const boardRef = useRef<HTMLCanvasElement>(null);
  const nextRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const board = boardRef.current;
    const next = nextRef.current;
    if (!board || !next) return;

    const engine = new TetrisEngine(board, next, callbacks, getSkin('caida'));
    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Con heightPx (touch): el tablero 1:2 se dimensiona POR ALTURA (340px →
     170px de ancho derivados del aspect intrínseco del canvas, sin
     distorsión) y el panel «SIGUIENTE» va al costado sin wrap: 170 + 16 +
     120 = 306px ≤ 352px útiles en 360vw. Estirarlo a lo ancho como los
     canvas 4:3 sería una distorsión >100%. El flexWrap 'wrap' era un
     paliativo solo-touch: sin heightPx (desktop) el layout queda idéntico
     al original. Ver references/mobile-porter-todo.md (criterio 1). */
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: heightPx ? 'nowrap' : 'wrap',
        gap: heightPx ? 16 : 20,
        alignItems: 'flex-start',
        justifyContent: 'center',
      }}
    >
      <canvas
        ref={boardRef}
        width={300}
        height={600}
        style={
          heightPx
            ? { width: 'auto', height: `${heightPx}px`, display: 'block' }
            : { width: '100%', maxWidth: '300px', height: 'auto', display: 'block' }
        }
      />
      <div>
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.15em',
            color: 'var(--ink-faint)',
            marginBottom: 8,
          }}
        >
          SIGUIENTE
        </div>
        <canvas
          ref={nextRef}
          width={120}
          height={120}
          style={{ width: '120px', height: '120px', display: 'block' }}
        />
        {panelExtra}
      </div>
    </div>
  );
}
