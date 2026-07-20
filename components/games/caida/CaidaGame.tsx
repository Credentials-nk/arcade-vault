'use client';

import { useEffect, useRef } from 'react';
import { TetrisEngine, TetrisCallbacks } from '@/lib/games/caida/game';
import { getSkin } from '@/lib/skins';

interface CaidaGameProps {
  callbacks: TetrisCallbacks;
  engineRef: React.MutableRefObject<TetrisEngine | null>;
}

export default function CaidaGame({ callbacks, engineRef }: CaidaGameProps) {
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

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', justifyContent: 'center' }}>
      <canvas
        ref={boardRef}
        width={300}
        height={600}
        style={{ width: '100%', maxWidth: '300px', height: 'auto', display: 'block' }}
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
      </div>
    </div>
  );
}
