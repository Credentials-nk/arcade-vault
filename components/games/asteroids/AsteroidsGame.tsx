'use client';

import { useEffect, useRef } from 'react';
import { AsteroidsEngine, AsteroidsCallbacks } from '@/lib/games/asteroids/game';
import { getSkin } from '@/lib/skins';

interface AsteroidsGameProps {
  callbacks: AsteroidsCallbacks;
  engineRef: React.MutableRefObject<AsteroidsEngine | null>;
}

export default function AsteroidsGame({ callbacks, engineRef }: AsteroidsGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new AsteroidsEngine(canvas, callbacks, getSkin('asteroids'));
    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
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
