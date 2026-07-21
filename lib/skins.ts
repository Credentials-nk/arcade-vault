// Sistema de skins de Arcade Vault.
//
// La plataforma mantiene 3 skins canónicos que operan siempre sobre el fondo
// oscuro fijo de la app (--bg: #0a0a0f); ninguno es un tema claro:
//
//   - neon     → la estética actual: colores saturados y glow intenso.
//   - clasico  → arcade sobrio: colores planos/apagados, glow mínimo, legible.
//   - retro    → CRT monocromo: un único tinte de fósforo (ámbar) con scanlines.
//
// Cada juego tiene UNA skin fija asignada en GAME_SKINS. El componente del juego
// resuelve su paleta con getSkin('<id>') y se la pasa al engine por constructor;
// el chrome (HUD/botones/CRT/modal) se reskin­a con data-skin en app/globals.css.
//
// La tabla de asignación por juego es fuente de verdad compartida en
// references/game-skins.md.

/** Paleta que consume el canvas de cada engine. */
export interface Skin {
  /** Fondo del lienzo de juego. */
  bg: string;
  /** Primer plano principal: nave/serpiente/balas/wireframe/texto de HUD del canvas. */
  primary: string;
  /** Acento: comida, power-ups, resaltados. */
  accent: string;
  /** Llama del propulsor / partículas cálidas de Asteroids. */
  flame: string;
  /** Líneas de rejilla (formato rgba con alpha). */
  line: string;
  /** Brillo superior de los bloques (formato rgba con alpha). */
  highlight: string;
  /** Paleta de las 8 piezas de Caída, alineada con los índices 1–8 del tablero. */
  pieces: readonly [string, string, string, string, string, string, string, string];
  /** Texto de HUD/overlay dibujado directo en el canvas (score, nivel, mensajes). */
  text: string;
}

export type SkinName = 'neon' | 'clasico' | 'retro';

// ── neon ────────────────────────────────────────────────────────────────────
// Estética actual: verde/magenta saturados sobre negro puro, alto contraste.
export const NEON: Skin = {
  bg: '#000000',
  primary: '#00ff88',
  accent: '#ff006e',
  flame: 'rgba(255, 130, 0, 0.85)',
  line: 'rgba(255, 255, 255, 0.06)',
  highlight: 'rgba(255, 255, 255, 0.12)',
  pieces: ['#00f5ff', '#f5ff00', '#c04dff', '#00ff88', '#ff3b3b', '#4d9bff', '#ff9500', '#c7d0e0'],
  text: '#e6e9ff',
};

// ── clasico ─────────────────────────────────────────────────────────────────
// Arcade sobrio: colores planos y apagados, glow mínimo, legibilidad ante todo.
export const CLASICO: Skin = {
  bg: '#050507',
  primary: '#d7dbe8',
  accent: '#e0b64d',
  flame: 'rgba(220, 120, 40, 0.8)',
  line: 'rgba(255, 255, 255, 0.05)',
  highlight: 'rgba(255, 255, 255, 0.1)',
  pieces: ['#5aa9b5', '#c9b25c', '#9a76ad', '#6fa86f', '#c06b6b', '#6f8fb0', '#c2905a', '#8f97a3'],
  text: '#e6e9ff',
};

// ── retro ───────────────────────────────────────────────────────────────────
// CRT monocromo: un único fósforo ámbar sobre negro. Sin multicolor.
export const RETRO: Skin = {
  bg: '#000000',
  primary: '#ffb000',
  accent: '#ffce5c',
  flame: 'rgba(255, 176, 0, 0.85)',
  line: 'rgba(255, 176, 0, 0.14)',
  highlight: 'rgba(255, 200, 90, 0.15)',
  pieces: ['#ffb000', '#ffc94d', '#e69e00', '#ffd98a', '#cc8c00', '#ffbf33', '#b37a00', '#8a5e00'],
  text: '#ffd591',
};

const SKINS: Record<SkinName, Skin> = {
  neon: NEON,
  clasico: CLASICO,
  retro: RETRO,
};

/** Skin fija asignada a cada juego, por su `id`. Fuente de verdad de la corrida. */
export const GAME_SKINS: Record<string, SkinName> = {
  asteroids: 'retro',
  caida: 'clasico',
  serpentina: 'neon',
  'bloque-buster': 'neon',
};

/** Resuelve la paleta de un juego por su id (fallback a NEON). */
export function getSkin(id: string): Skin {
  const name = GAME_SKINS[id];
  return name ? SKINS[name] : NEON;
}

/**
 * Convierte un color hex (#rgb o #rrggbb) a la terna "r, g, b" para componer
 * rgba(...) con alpha variable (pulsos, partículas) en los engines.
 */
export function rgbTriplet(hex: string): string {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}
