'use client';

import { useEffect, useRef } from 'react';
import {
  FroggerEngine,
  FroggerCallbacks,
  FROGGER_CANVAS_W,
  FROGGER_CANVAS_H,
} from '@/lib/games/frogger/game';
import { getSkin } from '@/lib/skins';

interface FroggerGameProps {
  callbacks: FroggerCallbacks;
  engineRef: React.MutableRefObject<FroggerEngine | null>;
  heightPx?: number; // override de altura (estira más allá de la proporción natural, solo capa visual)
}

export default function FroggerGame({ callbacks, engineRef, heightPx }: FroggerGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new FroggerEngine(canvas, callbacks, getSkin('frogger'));
    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={FROGGER_CANVAS_W}
      height={FROGGER_CANVAS_H}
      style={{
        width: '100%',
        height: heightPx ? `${heightPx}px` : 'auto',
        maxWidth: `${FROGGER_CANVAS_W}px`,
        display: 'block',
      }}
    />
  );
}
