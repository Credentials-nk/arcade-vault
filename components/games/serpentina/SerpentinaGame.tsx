'use client';

import { useEffect, useRef } from 'react';
import { SerpentinaEngine, SerpentinaCallbacks } from '@/lib/games/serpentina/game';
import { getSkin } from '@/lib/skins';

interface SerpentinaGameProps {
  callbacks: SerpentinaCallbacks;
  engineRef: React.MutableRefObject<SerpentinaEngine | null>;
}

export default function SerpentinaGame({ callbacks, engineRef }: SerpentinaGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new SerpentinaEngine(canvas, callbacks, getSkin('serpentina'));
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
      width={600}
      height={600}
      style={{ width: '100%', height: 'auto', maxWidth: '600px', display: 'block' }}
    />
  );
}
