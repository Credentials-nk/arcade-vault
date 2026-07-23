'use client';

import { useEffect, useRef } from 'react';
import { ArkanoidEngine, ArkanoidCallbacks } from '@/lib/games/bloque-buster/game';
import { getSkin } from '@/lib/skins';

interface BloqueBusterGameProps {
  callbacks: ArkanoidCallbacks;
  engineRef: React.MutableRefObject<ArkanoidEngine | null>;
  heightPx?: number; // override de altura (criterio táctil unificado — ver references/mobile-porter-todo.md)
}

export default function BloqueBusterGame({
  callbacks,
  engineRef,
  heightPx,
}: BloqueBusterGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new ArkanoidEngine(canvas, callbacks, getSkin('bloque-buster'));
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
      style={{
        width: '100%',
        height: heightPx ? `${heightPx}px` : 'auto',
        maxWidth: '800px',
        display: 'block',
      }}
    />
  );
}
