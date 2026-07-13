# SPEC 07 — Integración del juego Caída (Tetris)

> **Estado:** Implementado · **Depende de:** 04-supabase-setup, 05-asteroids-game, 06-leaderboard · **Fecha:** 2026-07-13
> **Objetivo:** Integrar el clásico Tetris (started-game `03-tetris`) como página jugable `/games/caida` —reutilizando la entrada `caida` del catálogo—, con su engine migrado a TypeScript, HUD sincronizado (puntuación, líneas, nivel y próxima pieza), guardado de puntuaciones en Supabase y presencia automática en el leaderboard.

## Por qué existe este spec

El catálogo ya tiene la entrada `caida` (CAÍDA), un Tetris temático, pero **sin `playRoute`**: no se puede jugar. Este spec la vuelve jugable siguiendo el patrón de integración validado con Asteroids (spec 05) y aprovechando el leaderboard genérico (spec 06). El engine original (`references/started-games/03-tetris/game.js`) es funcional, acoplado al DOM y sin clases, así que el grueso del trabajo es encapsularlo y desacoplarlo, no reescribir la lógica.

## Scope

**In:**

- Copiar `game.js` de `03-tetris` a `lib/games/caida/` y migrarlo a `lib/games/caida/game.ts` (TypeScript strict), encapsulado en una clase `TetrisEngine`.
- Bridge de callbacks `TetrisCallbacks` = `onScore`, `onLines`, `onLevel`, `onGameOver` (sin `onLives` — Tetris no tiene vidas).
- Componente `components/games/caida/CaidaGame.tsx` que monta los dos canvas (tablero + próxima pieza), crea el engine con los callbacks y lo destruye al desmontar.
- Página `app/games/caida/page.tsx` con HUD (Jugador / Puntuación / Líneas / Nivel + preview), botón PAUSA y modal de game over con captura de nombre (input máx 10, mayúsculas) y `saveScore('caida', nombre || 'INVITADO', finalScore)`.
- Agregar `playRoute: '/games/caida'` a la entrada `caida` existente en `lib/data.ts`.

**Fuera de scope (para specs futuros):**

- Modificar el leaderboard: ya es genérico (spec 06); solo se aprovecha y se verifica.
- Crear una entrada nueva de catálogo: se **reutiliza** `caida`.
- El theme-toggle y el `localStorage` (`tetris-theme`) de la demo standalone — la plataforma maneja su propio tema.
- Autenticación, realtime, input táctil, y cualquier otro juego.

## Modelo de datos

**No introduce datos nuevos en la base:** reutiliza la tabla `scores` y el `saveScore` existentes (los scores se guardan con `game_id = 'caida'`). Tampoco hay assets nuevos (el juego no usa sprites ni sonidos).

Sí introduce tipos TypeScript en el engine (al migrar el `game.js` no tipado):

```ts
// lib/games/caida/game.ts
type Cell = number; // 0 = vacío; 1–8 = índice de color de pieza
type Board = Cell[][]; // matriz ROWS(20) × COLS(10)

interface Piece {
  type: number;
  shape: number[][];
  x: number;
  y: number;
}

interface TetrisCallbacks {
  onScore: (score: number) => void;
  onLines: (lines: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

Convenciones del engine (heredadas del original): tablero 10×20 con bloque de 30px (canvas 300×600); segundo canvas de preview 120×120; velocidad `dropInterval = max(100, 1000 − (level−1)·90)` ms; `level = floor(lines/10) + 1`.

## Plan de implementación

1. Crear rama `spec-07-caida-game` desde `main`. Copiar `references/started-games/03-tetris/game.js` a `lib/games/caida/game.js` como punto de partida.

2. Migrar a `lib/games/caida/game.ts` en TypeScript strict. Tipar **primero** (`Cell`, `Board`, `Piece`, `TetrisCallbacks`) y **después** encapsular los globales de estado (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `dropAccum`, `animId`) como propiedades de la clase `TetrisEngine`.
   - Constructor: `new TetrisEngine(boardCanvas, nextCanvas, callbacks)`.
   - Desacoplar del DOM: recibir los canvas por parámetro (nada de `getElementById`); adjuntar el listener de teclado en el constructor y **removerlo en `destroy()`**; descartar el theme-toggle y el `localStorage`.
   - Llamar los callbacks en los puntos exactos de mutación: `onScore` tras cambiar `score` (`clearLines`, `hardDrop`, `softDrop`), `onLines` y `onLevel` en `clearLines`, `onGameOver(score)` en `endGame`.
   - Métodos públicos: `setPaused(paused)` y `destroy()`.
     Verificar: `tsc --noEmit` sin errores.

3. Crear `components/games/caida/CaidaGame.tsx` (Client Component): renderiza `<canvas>` del tablero (300×600) y `<canvas>` de preview (120×120), crea el `TetrisEngine` con ambos canvas y los callbacks en un `useEffect`, y lo destruye al desmontar. Soporta reinicio vía `key`.
   Verificar: el juego arranca y responde a los controles.

4. Crear `app/games/caida/page.tsx` calcada de `app/games/asteroids/page.tsx`: HUD exterior (Jugador `INVITADO` / Puntuación / **Líneas** / Nivel) con el preview de próxima pieza, botón PAUSA (`engine.setPaused`), y modal de game over con input de nombre (máx 10, mayúsculas) que llama `saveScore('caida', playerName || 'INVITADO', finalScore)`.
   Verificar: el HUD refleja en tiempo real el estado interno del engine.

5. En `lib/data.ts`, agregar `playRoute: '/games/caida'` a la entrada `caida` (sin tocar el resto de sus campos).
   Verificar: la tarjeta CAÍDA en la biblioteca enlaza a la página jugable.

6. Ejecutar `npm run build` y corregir errores de TypeScript o ESLint. Marcar el spec como `Implementado` y crear PR `spec-07-caida-game` → `main`.

## Criterios de aceptación

- [ ] `/games/caida` carga sin errores en consola y el Tetris es jugable con los controles: ←/→ mover, ↓ soft drop, ↑ o X rotar, Espacio hard drop, P (o botón) pausa.
- [ ] El HUD muestra puntuación, líneas y nivel actualizados en tiempo real, y el canvas de preview muestra la próxima pieza.
- [ ] La pausa detiene y reanuda el juego correctamente.
- [ ] Al game over aparece el modal; ingresar un nombre y guardar inserta una fila en `scores` con `game_id = 'caida'`.
- [ ] La puntuación guardada aparece en el leaderboard por juego (`/game/caida`) y, si es alta, en el global de la home — **sin** haber modificado el leaderboard.
- [ ] La tarjeta CAÍDA de la biblioteca enlaza a `/games/caida`.
- [ ] `npm run build` completa sin errores de TypeScript ni ESLint.

## Decisiones

- **Sí:** reutilizar la entrada `caida` (no crear `tetris`). Razón: ya existe como Tetris temático con cover (`cover-tetro`), categoría y descripciones; crear otra sería duplicar y dejar `caida` huérfano.
- **Sí:** encapsular en una clase `TetrisEngine` con los canvas por parámetro. Razón: consistencia con `AsteroidsEngine`; desacopla el engine del DOM y lo hace montable/desmontable en React.
- **Sí:** callbacks `onScore` / `onLines` / `onLevel` / `onGameOver`; **omitir `onLives`**. Razón: Tetris no tiene vidas; el HUD usa "Líneas" en lugar de "Vidas".
- **Sí:** pasar el segundo canvas (próxima pieza) al engine para el preview. Razón: es parte del Tetris clásico y el original ya lo dibuja.
- **No:** theme-toggle ni `localStorage` de la demo. Razón: la plataforma tiene su propio tema; son ruido fuera de scope.
- **No:** tocar el leaderboard. Razón: es genérico desde el spec 06; basta con `game_id = 'caida'` consistente.
- **Definición rápida vía `/add-game`.** El análisis del engine y los metadatos fueron relevados por el skill `add-game`; el usuario delegó las decisiones de diseño por tratarse de un MVP didáctico.

## Riesgos

| Riesgo                                                                                      | Mitigación                                                                                                                  |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Migrar globals mutables + desacoplar del DOM a TS strict resulta más extenso de lo esperado | Tipar `Cell`/`Board`/`Piece` primero; encapsular el estado en la clase al final; nunca desactivar `strict` globalmente.     |
| El listener de teclado global captura teclas fuera del juego o rompe el scroll de la página | Adjuntar/remover el listener en `constructor`/`destroy`; `preventDefault` solo en las teclas del juego (flechas y espacio). |
| El segundo canvas (preview) rompe el layout responsivo del HUD                              | Integrarlo dentro del HUD con tamaño fijo (120×120) y `max-width` como el canvas principal de Asteroids.                    |

## Lo que **no** está en este spec

- Modificar el leaderboard (ya genérico).
- Crear una entrada nueva de catálogo (se reutiliza `caida`).
- Theme-toggle / `localStorage` de la demo.
- Autenticación, realtime, input táctil.

Cada uno, si llega, va en su propio spec.
