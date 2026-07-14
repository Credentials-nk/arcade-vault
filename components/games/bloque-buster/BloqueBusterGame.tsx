'use client';

import { useEffect, useRef } from 'react';
import { ArkanoidEngine, ArkanoidCallbacks } from '@/lib/games/bloque-buster/game';

interface BloqueBusterGameProps {
  callbacks: ArkanoidCallbacks;
  engineRef: React.MutableRefObject<ArkanoidEngine | null>;
}

export default function BloqueBusterGame({ callbacks, engineRef }: BloqueBusterGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new ArkanoidEngine(canvas, callbacks);
    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      style={{ width: '100%', height: 'auto', maxWidth: '800px', display: 'block' }}
    />
  );
}
