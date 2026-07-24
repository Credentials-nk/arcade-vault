# SPEC game-jam/fusion/01 — Integración del juego FUSIÓN (deslizar y fusionar fichas numéricas)

> **Estado:** Borrador · **Depende de:** 04-supabase-setup, 05-asteroids-game, 06-leaderboard, 09-games-catalog-supabase · **Fecha:** 2026-07-23
> **Objetivo:** Integrar el juego FUSIÓN como página /games/fusion con HUD sincronizado, guardado de puntuaciones en Supabase y presencia automática en el leaderboard.

## Por qué existe este spec

El tema de esta corrida (`game-jam · fusion`) es un puzzle 2048-like ya anotado como idea en `references/game-suggestions.md` (fila `fusion`, PUZZLE/cyan, 2026-07-20: "deslizar y fusionar números iguales. Controles mínimos, partidas cortas"), pero nunca se escribió el spec ni existe fila en la tabla `games` (verificado por `execute_sql`: `select ... where id in ('fusion','cronofusion')` devuelve vacío). Este spec es la variante **clásica** del juego base — el modo "fiel al 2048 original" — y sirve de referencia para la variante hermana `02-cronofusion.md` (contrarreloj con combos), que reutiliza el mismo diseño de tablero pero le añade una regla de tiempo real. No hay `game.js` de partida: el engine se diseña desde cero, igual que Serpentina (spec 10).

## Scope

**In:**

- Diseño e implementación de `lib/games/fusion/game.ts` en TypeScript strict desde cero: clase `FusionEngine` con lógica de tablero por turnos discretos (sin física continua, sin ticks por acumulador).
- Bridge de callbacks `FusionCallbacks` = `onScore`, `onLevel`, `onGameOver` (**sin `onLives`** — un puzzle de fusión de fichas no tiene concepto de vidas).
- Componente `components/games/fusion/FusionGame.tsx` que monta el `<canvas>` (468×468), crea el engine con los callbacks y lo destruye al desmontar.
- Página `app/games/fusion/page.tsx` con HUD (Jugador / Puntuación / Nivel — sin stat de vidas), botón PAUSA y modal de game over con captura de nombre (input máx 10, mayúsculas) y `saveScore('fusion', nombre || 'INVITADO', finalScore)`.
- Fila **nueva** en la tabla `games` de Supabase vía migración: `id='fusion'`, `title='FUSIÓN'`, `cat='PUZZLE'`, `color='cyan'`, `play_route='/games/fusion'`, siguiente `sort_order` disponible (actualmente 8, tras `frogger`; reverificar contra la tabla real al implementar por si `02-cronofusion` ya aterrizó primero y lo tomó).
- Clase `.cover-fusion` nueva en `app/globals.css`, siguiendo el patrón CSS-puro de las coberturas existentes (`.cover-tetro`, `.cover-snake`, etc.) — motivo de grilla con fichas numeradas en tonos cyan.
- Sin assets nuevos (sin sprites ni audio; render 100% con formas/texto en canvas, como Asteroids/Serpentina).

**Fuera de scope (para specs futuros):**

- Modificar el leaderboard: ya es genérico (spec 06); solo se aprovecha y se verifica.
- La variante `cronofusion` (contrarreloj + combos) — va en su propio spec, `02-cronofusion.md`.
- Animaciones de deslizamiento tipo "tween" con interpolación de posición de fichas.
- Modos de dificultad, tableros de tamaño distinto a 4×4, deshacer movimientos.
- Controles táctiles / swipe para mobile (los añade `@mobile-porter` sobre la base ya implementada, fuera de este spec).
- Skins visuales alternativas (las asigna `@skin-designer` en un paso posterior del flujo `/spec-impl-game`, no este spec).
- Autenticación, realtime, y cualquier otro juego.

## Diseño del engine (no hay código de partida)

Al no existir un `game.js` de referencia, se define aquí el diseño que `/spec-impl` debe construir:

**Grilla y canvas:** tablero de `BOARD_SIZE = 4` × 4 celdas. `CELL = 100` px, `GAP = 12` px entre celdas, `PAD = 16` px de margen exterior → canvas cuadrado de `468×468` (`PAD*2 + CELL*BOARD_SIZE + GAP*(BOARD_SIZE-1)`). Al arrancar la partida se colocan 2 fichas iniciales en celdas vacías aleatorias.

**Estado:**

```ts
type Cell = number; // 0 = vacío; si no, una potencia de 2 (2, 4, 8, ...)
type Grid = Cell[][]; // grid[fila][columna], BOARD_SIZE × BOARD_SIZE

interface FusionCallbacks {
  onScore: (score: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

Internamente el engine mantiene: `grid: Grid`, `score`, `level`, `gameState: 'playing' | 'gameover'` (sin estado `'win'` — igual que Serpentina, ningún juego implementado expone una victoria explícita; el objetivo es maximizar el score, no "llegar a 2048").

**Loop:** a diferencia de Asteroids (física continua con `dt`) y de Serpentina (ticks por acumulador), Fusión avanza el tablero **una sola vez por cada pulsación de flecha** — no hay avance automático por tiempo. El `requestAnimationFrame` sigue activo para redibujar cada frame y respetar `setPaused`, pero `update(dt)` no mueve fichas por sí solo.

**Progresión y nivel (sin velocidad — no aplica a un juego por turnos):**

- `level = max(1, log2(maxTileValue) - 1)`, recalculado cada vez que aparece una ficha con el valor más alto visto hasta ahora (p. ej. ficha `2`/`4` → nivel 1, `8` → nivel 2, `16` → nivel 3, …).
- `onLevel` se llama solo cuando `level` cambia.

**Movimiento y fusión (equivalente a "colisiones"):** al presionar una flecha, para cada una de las 4 líneas del tablero en la dirección de movimiento: compactar las fichas no vacías hacia ese extremo, fusionar pares adyacentes de igual valor (cada ficha se fusiona **como máximo una vez por movimiento** — se marca tras fusionarse para no volver a combinarse en la misma pasada), sumar el valor resultante de cada fusión al `score`. Si al menos una línea cambió: llamar `onScore`, recalcular `level`, y colocar una ficha nueva en una celda vacía aleatoria (`90%` valor `2`, `10%` valor `4`). Si ninguna línea cambió (movimiento inválido, p. ej. presionar una flecha contra el borde ya compactado), no pasa nada — no se gasta turno ni aparece ficha nueva.

**Game over:** se evalúa tras cada movimiento válido, simulando (sin mutar el tablero real) si alguna de las 4 direcciones produciría un cambio. Si el tablero está lleno **y** ninguna dirección produciría una fusión → `gameState = 'gameover'`, `onGameOver(score)`.

**Controles:** solo teclado — `↑ ↓ ← →`. Sin control por mouse — no aplica a un puzzle de grilla direccional (mismo criterio que Serpentina).

**Render:** sin sprites ni sonidos — celdas vacías como recuadros tenues, fichas como cuadrados con esquinas redondeadas cuyo `fillStyle` varía de intensidad/brillo según la potencia de 2 (más brillo cuanto mayor el valor), valor numérico centrado en cada ficha. Estética vectorial de neón, consistente con Asteroids/Serpentina. Cero assets nuevos.

**Sin clases para entidades:** el tablero es un `Grid` (array de arrays de `number`), no amerita clases propias — toda la lógica vive encapsulada en `FusionEngine`, igual que `snake`/`food` en Serpentina son datos simples.

## Modelo de datos

**No introduce datos nuevos en Supabase:** reutiliza la tabla `scores` y el `saveScore` existentes (`game_id = 'fusion'`). Sin assets nuevos (sin sprites ni audio).

```ts
// lib/games/fusion/game.ts
const BOARD_SIZE = 4;
const CELL = 100;
const GAP = 12;
const PAD = 16;
const SPAWN_FOUR_CHANCE = 0.1;

type Cell = number; // 0 = vacío; si no, potencia de 2
type Grid = Cell[][];

interface FusionCallbacks {
  onScore: (score: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

## Plan de implementación

1. Crear rama `fusion-game` desde `main`.

2. Crear `lib/games/fusion/game.ts` en TypeScript strict, clase `FusionEngine`, desde cero:
   - Tipar primero `Cell`, `Grid` y `FusionCallbacks`.
   - Constructor: `new FusionEngine(canvas, callbacks)`. Inicializa `grid` (4×4 de ceros), coloca 2 fichas iniciales, `score = 0`, `level = 1`, `gameState = 'playing'`.
   - Listener de teclado (`keydown` en `window`, removido en `destroy()`) que dispara el movimiento en la dirección presionada.
   - Función de movimiento por línea (compactar + fusionar una sola vez por ficha) aplicada a las 4 líneas según dirección; devuelve si la línea cambió y cuánto sumó al score.
   - Tras un movimiento válido: spawn de ficha nueva, recálculo de `level`, chequeo de game over simulando las 4 direcciones sin mutar el tablero real.
   - Loop `requestAnimationFrame` que solo redibuja (no mueve fichas por tiempo) y respeta `paused`.
   - Métodos públicos `setPaused(paused)` y `destroy()` (cancela el `requestAnimationFrame`, remueve el listener de teclado).
     Verificar: `tsc --noEmit` sin errores; el tablero cambia correctamente al presionar cada flecha en una prueba manual en consola.

3. Crear `components/games/fusion/FusionGame.tsx` (Client Component): canvas 468×468 con `width: 100%; height: auto; max-width: 468px`, crea el `FusionEngine` en un `useEffect`, lo destruye al desmontar, soporta reinicio vía `key`.
   Verificar: el tablero se renderiza con 2 fichas iniciales y responde a las flechas.

4. Crear `app/games/fusion/page.tsx` calcada de `app/games/serpentina/page.tsx`: HUD exterior (Jugador `INVITADO` / Puntuación / Nivel — sin stat de vidas), botón PAUSA (`engine.setPaused`) y botón SALIR, y modal de game over con input de nombre (máx 10, mayúsculas) que llama `saveScore('fusion', playerName || 'INVITADO', finalScore)`.
   Verificar: el HUD refleja en tiempo real el estado interno del engine.

5. Migración SQL: insertar fila nueva en `games` (`id='fusion'`, `title='FUSIÓN'`, `short`/`long` descriptivos, `cat='PUZZLE'`, `cover='cover-fusion'`, `color='cyan'`, `play_route='/games/fusion'`, siguiente `sort_order` disponible). Agregar clase `.cover-fusion` en `app/globals.css`.
   Verificar: la tarjeta FUSIÓN aparece en biblioteca/home y enlaza a la página jugable.

6. Ejecutar `npm run build` y corregir errores de TypeScript o ESLint. Marcar el spec como `Implementado` y crear PR `fusion-game` → `main`.

## Criterios de aceptación

- [ ] `/games/fusion` carga sin errores en consola, arranca con 2 fichas y es jugable con `↑ ↓ ← →`.
- [ ] Deslizar con una flecha mueve todas las fichas posibles en esa dirección y fusiona pares adyacentes de igual valor, sumando el valor fusionado a la puntuación.
- [ ] Ninguna ficha se fusiona dos veces dentro del mismo movimiento.
- [ ] Tras cualquier movimiento válido (que cambia el tablero) aparece una ficha nueva (2 con 90% de probabilidad, 4 con 10%) en una celda vacía aleatoria.
- [ ] Un movimiento que no cambia ninguna celda no genera ficha nueva ni gasta turno.
- [ ] La partida termina (game over, dispara el modal) cuando el tablero está lleno y ningún movimiento en ninguna dirección produciría una fusión.
- [ ] El HUD exterior muestra puntuación y nivel actualizados en tiempo real; el nivel sube cada vez que aparece una ficha con un valor máximo nuevo.
- [ ] El botón PAUSA detiene el juego; pulsarlo de nuevo lo reanuda.
- [ ] El botón SALIR navega a `/library` y destruye el engine (sin loops ni listeners en background).
- [ ] Al game over, guardar con nombre inserta una fila en `scores` con `game_id = 'fusion'` (input acepta máximo 10 caracteres, convertidos a mayúsculas).
- [ ] La puntuación aparece en el leaderboard por juego (`/game/fusion`) y, si es alta, en el global de la home — **sin** haber tocado el leaderboard.
- [ ] La tarjeta FUSIÓN enlaza a `/games/fusion`.
- [ ] `npm run build` completa sin errores de TypeScript ni ESLint.

## Decisiones

- **Sí:** id `fusion`, reutilizando la entrada ya reservada en `references/game-suggestions.md` (2026-07-20). Razón: es la fila que le dio origen a esta corrida de game-jam; no existe fila en la tabla `games` (verificado), así que se crea desde cero, no se migra un placeholder.
- **Sí:** categoría `PUZZLE` / color `cyan`. Razón: coinciden con la fila ya reservada en la memoria compartida; mantiene consistencia con lo que `@game-planner` ya tenía anotado.
- **Sí:** engine desde cero en TypeScript strict, sin paso de migración. Razón: no existe `game.js` de partida, mismo precedente que Serpentina (spec 10).
- **Sí:** loop event-driven por tecla, sin física continua ni ticks por acumulador. Razón: 2048 es un juego de turnos discretos por naturaleza — un reloj de juego (como en Serpentina) no aporta nada aquí; ese es justamente el diferenciador de la variante `cronofusion`.
- **Sí:** tablero 4×4 fiel al 2048 original. Razón: sirve de modo "base/clásico" frente a la variante `cronofusion`, que reutiliza el mismo tamaño de tablero pero cambia la regla de tiempo/score.
- **Sí:** puntuación = suma de los valores fusionados (regla estándar de 2048). Razón: produce un score entero natural, comparable en el leaderboard, sin inventar una fórmula nueva.
- **Sí:** sin estado "victoria" al alcanzar 2048; la partida continúa hasta que no haya movimientos posibles. Razón: consistente con el precedente de Serpentina/Bloque Buster (ningún juego implementado expone un estado `'win'`), y mantiene el foco en maximizar el score del leaderboard.
- **No:** animaciones de deslizamiento con interpolación de posición (tween). Razón: sobre-ingeniería para este alcance; redibujar el tablero final tras cada movimiento es suficiente y evita estado de animación adicional.
- **No:** `onLives`. Razón: no hay concepto de vidas en un puzzle de fusión de fichas.
- **No:** deshacer movimientos / historial de jugadas. Razón: no es parte del 2048 clásico; fuera de scope.

## Riesgos

| Riesgo                                                                                                 | Mitigación                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tipar el estado mutable del tablero (`Grid`) en TS strict resulta más extenso de lo esperado           | Tipar `Cell`/`Grid`/`FusionCallbacks` primero, encapsular el estado mutable dentro de `FusionEngine` al final; nunca desactivar `strict` globalmente.       |
| Bug clásico de implementaciones de 2048: una ficha se fusiona dos veces en el mismo movimiento         | Marcar cada ficha como "ya fusionada este movimiento" antes de permitir una segunda fusión sobre ella en la misma pasada.                                   |
| Detección de "no hay movimientos posibles" mal calculada deja partidas colgadas sin disparar game over | Reutilizar la misma función de simulación de movimiento (sin mutar el tablero real) para las 4 direcciones al chequear game over, no una heurística aparte. |
| El `sort_order` elegido (8) choca si `02-cronofusion` se implementa primero y lo toma                  | Reverificar `select max(sort_order) from games` contra la tabla real justo antes de la migración del paso 5, no asumir el valor de este spec a ciegas.      |

## Lo que **no** está en este spec

- Modificar el leaderboard (ya genérico).
- La variante `cronofusion` (contrarreloj + combos) — spec `02-cronofusion.md`.
- Animaciones de deslizamiento con tween.
- Modos de dificultad, tableros de tamaño distinto, deshacer movimientos.
- Controles táctiles / swipe.
- Skins visuales alternativas.
- Autenticación, realtime, y cualquier otro juego.

Cada uno, si llega, va en su propio spec.
