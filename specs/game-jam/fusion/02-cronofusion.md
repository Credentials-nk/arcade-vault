# SPEC game-jam/fusion/02 — Integración del juego CRONOFUSIÓN (fusión contrarreloj con combos)

> **Estado:** Borrador · **Depende de:** 04-supabase-setup, 05-asteroids-game, 06-leaderboard, 09-games-catalog-supabase · **Fecha:** 2026-07-23
> **Objetivo:** Integrar el juego CRONOFUSIÓN como página /games/cronofusion con HUD sincronizado, guardado de puntuaciones en Supabase y presencia automática en el leaderboard.

## Por qué existe este spec

Es la segunda variante de la corrida `game-jam · fusion` (junto a `01-fusion.md`, el modo clásico): mismo tablero deslizante de fusión de fichas numéricas, pero con una regla diferenciadora real — un cronómetro que corre en tiempo real y un multiplicador de combo por rachas de fusiones consecutivas — en vez de un simple cambio de color/skin. Reutiliza el diseño de tablero de `01-fusion.md` como base pero introduce un elemento de tiempo continuo que Fusión clásico deliberadamente no tiene, evitando así clonar la misma mecánica dos veces en el mismo lote. No hay `game.js` de partida: el engine se diseña desde cero.

## Scope

**In:**

- Diseño e implementación de `lib/games/cronofusion/game.ts` en TypeScript strict desde cero: clase `CronofusionEngine` con el mismo motor de deslizamiento/fusión por turnos de Fusión clásico, más un cronómetro continuo (`dt`) y un contador de combo.
- Bridge de callbacks `CronofusionCallbacks` = `onScore`, `onLevel`, `onGameOver`, más **`onTime`** (callback adicional específico de esta variante — ver Decisiones). **Sin `onLives`** — no hay concepto de vidas.
- Componente `components/games/cronofusion/CronofusionGame.tsx` que monta el `<canvas>` (468×468), crea el engine con los callbacks y lo destruye al desmontar.
- Página `app/games/cronofusion/page.tsx` con HUD (Jugador / Puntuación / Nivel / Tiempo restante — sin stat de vidas), botón PAUSA y modal de game over con captura de nombre (input máx 10, mayúsculas) y `saveScore('cronofusion', nombre || 'INVITADO', finalScore)`.
- Fila **nueva** en la tabla `games` de Supabase vía migración: `id='cronofusion'`, `title='CRONOFUSIÓN'`, `cat='PUZZLE'`, `color='yellow'`, `play_route='/games/cronofusion'`, siguiente `sort_order` disponible (actualmente 9, tras `frogger` y `fusion`; reverificar contra la tabla real al implementar — si `01-fusion` aún no aterrizó, sería 8).
- Clase `.cover-cronofusion` nueva en `app/globals.css`, siguiendo el patrón CSS-puro existente — motivo de grilla con fichas numeradas y un acento de reloj/cronómetro en tonos amarillo.
- Sin assets nuevos (sin sprites ni audio).

**Fuera de scope (para specs futuros):**

- Modificar el leaderboard: ya es genérico (spec 06); solo se aprovecha y se verifica.
- El otro juego del lote (`fusion`, modo clásico) — ya especificado en `01-fusion.md`.
- Animaciones de deslizamiento tipo "tween" con interpolación de posición de fichas (mismo criterio que `01-fusion.md`).
- Power-ups adicionales (congelar el reloj, doblar el multiplicador, etc.) — más allá del bonus de tiempo por fusión y el multiplicador de combo ya descritos, cualquier otro power-up queda fuera.
- Tablas de puntuación por dificultad/duración de partida configurable.
- Controles táctiles / swipe para mobile (los añade `@mobile-porter` sobre la base ya implementada).
- Skins visuales alternativas (las asigna `@skin-designer` en un paso posterior del flujo `/spec-impl-game`).
- Autenticación, realtime, y cualquier otro juego.

## Diseño del engine (no hay código de partida)

Al no existir un `game.js` de referencia, se define aquí el diseño que `/spec-impl` debe construir. Reutiliza el algoritmo de deslizamiento/fusión de `01-fusion.md` (mismo tablero 4×4, mismas reglas de compactación y fusión) y le agrega lo siguiente:

**Grilla y canvas:** idéntico a Fusión clásico — `BOARD_SIZE = 4`, `CELL = 100`, `GAP = 12`, `PAD = 16`, canvas `468×468` (misma identidad visual entre variantes del mismo juego base). 2 fichas iniciales al arrancar.

**Estado:**

```ts
type Cell = number; // 0 = vacío; si no, potencia de 2
type Grid = Cell[][]; // BOARD_SIZE × BOARD_SIZE

interface CronofusionCallbacks {
  onScore: (score: number) => void;
  onLevel: (level: number) => void;
  onTime: (secondsLeft: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

Internamente el engine mantiene, además del `grid`/`score`/`gameState` de Fusión clásico: `timeLeft` (segundos, empieza en `TIME_START = 90`), `combo` (racha actual de movimientos consecutivos con al menos una fusión) y `maxCombo` (racha máxima alcanzada en la partida, fuente del `level`).

**Loop híbrido:** a diferencia de Fusión clásico (puramente event-driven, sin reloj de juego), Cronofusión combina ambos patrones ya validados en la plataforma: el mismo manejo discreto de movimiento por tecla (compactar + fusionar, como en `01-fusion.md`) **más** un cronómetro continuo — `update(dt)` decrementa `timeLeft` en cada frame mientras `gameState === 'playing'`, igual que el acumulador de tiempo de Serpentina pero aplicado a una cuenta regresiva en vez de a un tick de movimiento.

**Progresión y nivel:** `level = 1 + floor(maxCombo / 3)`. Cada vez que `combo` supera el `maxCombo` previo, se actualiza `maxCombo` y, si el `level` resultante cambió, se llama `onLevel`. A diferencia de Fusión clásico (nivel atado al valor de ficha más alto), aquí el nivel refleja la mejor racha de combos lograda — coherente con que esta variante premia la velocidad de encadenar fusiones, no solo alcanzar fichas grandes.

**Movimiento, fusión y combo:** al presionar una flecha, se aplica el mismo algoritmo de compactación/fusión de `01-fusion.md` sobre las 4 líneas. Si el movimiento fue válido (el tablero cambió):

- Si produjo al menos una fusión: `combo++`; el score de cada fusión se multiplica por `multiplier = min(1 + 0.1 * combo, 2.0)` antes de sumarse (tope `2.0x` con `combo = 10`); se añade `TIME_BONUS_PER_MERGE = 1.5` segundos por cada fusión ocurrida en ese movimiento, con `timeLeft` acotado a un techo de `TIME_START` (no se puede acumular tiempo infinito).
- Si no produjo ninguna fusión (solo desplazó fichas): `combo = 0`.
- Tras el movimiento: colocar una ficha nueva en una celda vacía aleatoria (`90%` valor `2`, `10%` valor `4`), igual que Fusión clásico.

Si el movimiento no fue válido (no cambió nada), no pasa nada — no se gasta turno, no se toca `combo` ni `timeLeft`.

**Fin de partida (dos condiciones independientes, la que ocurra primero):**

- `timeLeft <= 0` → `gameState = 'gameover'`, `onGameOver(score)`.
- Tablero lleno y ninguna dirección produciría una fusión (misma simulación que Fusión clásico) → `gameState = 'gameover'`, `onGameOver(score)`.

**Controles:** solo teclado — `↑ ↓ ← →`. Sin control por mouse.

**Render:** igual que Fusión clásico (celdas + fichas con `fillStyle` por potencia de 2, valor centrado); sin HUD de texto dentro del canvas — el tiempo restante, la puntuación y el nivel se comunican al HTML exterior vía callbacks, igual que Serpentina. Cero assets nuevos.

## Modelo de datos

**No introduce datos nuevos en Supabase:** reutiliza la tabla `scores` y el `saveScore` existentes (`game_id = 'cronofusion'`). Sin assets nuevos (sin sprites ni audio).

```ts
// lib/games/cronofusion/game.ts
const BOARD_SIZE = 4;
const CELL = 100;
const GAP = 12;
const PAD = 16;
const SPAWN_FOUR_CHANCE = 0.1;

const TIME_START = 90; // segundos
const TIME_BONUS_PER_MERGE = 1.5; // segundos ganados por cada fusión en un movimiento
const MAX_COMBO_MULTIPLIER = 2.0;
const COMBO_MULTIPLIER_STEP = 0.1;

type Cell = number;
type Grid = Cell[][];

interface CronofusionCallbacks {
  onScore: (score: number) => void;
  onLevel: (level: number) => void;
  onTime: (secondsLeft: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

## Plan de implementación

1. Crear rama `cronofusion-game` desde `main`.

2. Crear `lib/games/cronofusion/game.ts` en TypeScript strict, clase `CronofusionEngine`, desde cero:
   - Tipar primero `Cell`, `Grid` y `CronofusionCallbacks`.
   - Reutilizar (reimplementar localmente, sin import cruzado entre juegos) el mismo algoritmo de compactación/fusión por línea que `01-fusion.md`.
   - Constructor: `new CronofusionEngine(canvas, callbacks)`. Inicializa `grid` (4×4, 2 fichas), `score = 0`, `combo = 0`, `maxCombo = 0`, `level = 1`, `timeLeft = TIME_START`, `gameState = 'playing'`.
   - Listener de teclado (`keydown` en `window`, removido en `destroy()`) que dispara el movimiento en la dirección presionada.
   - Lógica de combo/multiplicador/bonus de tiempo tras cada movimiento válido, con el techo de `timeLeft` en `TIME_START`.
   - `update(dt)`: decrementa `timeLeft` mientras `gameState === 'playing'`; dispara `onTime` y, si llega a 0, `gameState = 'gameover'` + `onGameOver(score)`.
   - Loop `requestAnimationFrame` con `dt` para el cronómetro (patrón continuo, distinto del event-driven puro de Fusión clásico).
   - Métodos públicos `setPaused(paused)` y `destroy()` (cancela el `requestAnimationFrame`, remueve el listener de teclado).
     Verificar: `tsc --noEmit` sin errores; el cronómetro baja visiblemente en consola y una fusión lo aumenta.

3. Crear `components/games/cronofusion/CronofusionGame.tsx` (Client Component): canvas 468×468 con `width: 100%; height: auto; max-width: 468px`, crea el `CronofusionEngine` en un `useEffect`, lo destruye al desmontar, soporta reinicio vía `key`.
   Verificar: el tablero se renderiza y el cronómetro corre desde que carga la página.

4. Crear `app/games/cronofusion/page.tsx` calcada de `app/games/fusion/page.tsx` (spec `01-fusion.md`), agregando un stat de HUD "Tiempo" alimentado por `onTime`: HUD exterior (Jugador `INVITADO` / Puntuación / Nivel / Tiempo — sin stat de vidas), botón PAUSA (`engine.setPaused`) y botón SALIR, y modal de game over con input de nombre (máx 10, mayúsculas) que llama `saveScore('cronofusion', playerName || 'INVITADO', finalScore)`.
   Verificar: el HUD refleja en tiempo real puntuación, nivel y tiempo restante.

5. Migración SQL: insertar fila nueva en `games` (`id='cronofusion'`, `title='CRONOFUSIÓN'`, `short`/`long` descriptivos, `cat='PUZZLE'`, `cover='cover-cronofusion'`, `color='yellow'`, `play_route='/games/cronofusion'`, siguiente `sort_order` disponible). Agregar clase `.cover-cronofusion` en `app/globals.css`.
   Verificar: la tarjeta CRONOFUSIÓN aparece en biblioteca/home y enlaza a la página jugable.

6. Ejecutar `npm run build` y corregir errores de TypeScript o ESLint. Marcar el spec como `Implementado` y crear PR `cronofusion-game` → `main`.

## Criterios de aceptación

- [ ] `/games/cronofusion` carga sin errores en consola, arranca con 2 fichas, cronómetro en 90s corriendo, y es jugable con `↑ ↓ ← →`.
- [ ] Deslizar con una flecha mueve y fusiona fichas igual que en Fusión clásico; cada fusión suma al score multiplicada por el factor de combo vigente.
- [ ] Un movimiento con al menos una fusión incrementa el combo en 1 y suma `1.5s` por fusión al tiempo restante (sin superar `90s` de techo).
- [ ] Un movimiento válido sin ninguna fusión reinicia el combo a 0 (sin bonus de tiempo).
- [ ] El multiplicador de score no supera `2.0x` aunque el combo siga subiendo más allá de 10.
- [ ] La partida termina por tiempo (`timeLeft` llega a 0) o por tablero sin movimientos posibles, lo que ocurra primero, y en ambos casos dispara el modal de game over.
- [ ] El HUD exterior muestra puntuación, nivel y tiempo restante actualizados en tiempo real; el nivel sube cuando se supera la mejor racha de combo previa.
- [ ] El botón PAUSA detiene el juego (incluido el cronómetro); pulsarlo de nuevo lo reanuda.
- [ ] El botón SALIR navega a `/library` y destruye el engine (sin loops ni listeners en background).
- [ ] Al game over, guardar con nombre inserta una fila en `scores` con `game_id = 'cronofusion'` (input acepta máximo 10 caracteres, convertidos a mayúsculas).
- [ ] La puntuación aparece en el leaderboard por juego (`/game/cronofusion`) y, si es alta, en el global de la home — **sin** haber tocado el leaderboard.
- [ ] La tarjeta CRONOFUSIÓN enlaza a `/games/cronofusion`.
- [ ] `npm run build` completa sin errores de TypeScript ni ESLint.

## Decisiones

- **Sí:** id `cronofusion` (nuevo, no reutiliza ninguna fila existente). Razón: `fusion` ya lo reclama la variante clásica (`01-fusion.md`); verificado que `cronofusion` no colisiona con ningún juego implementado ni con ninguna fila de `references/game-suggestions.md`.
- **Sí:** categoría `PUZZLE` / color `yellow`. Razón: `PUZZLE` no tiene **ninguna** entrada en `yellow` ni entre los juegos implementados ni entre las 22 filas de `game-suggestions.md` — hueco real del catálogo; mantiene además la coherencia temática con `fusion` (misma categoría, distinto color) al ser variantes del mismo juego base.
- **Sí:** reutilizar el tablero 4×4 y el algoritmo de fusión de `01-fusion.md` sin modificarlo. Razón: la diferenciación de esta variante es el tiempo real y el combo, no el tablero — cambiar también el tamaño de grilla habría sido una segunda variable de diseño innecesaria (riesgo de sobre-ingeniería).
- **Sí:** callback adicional `onTime`, más allá del bridge canónico (`onScore`/`onLives`/`onLevel`/`onGameOver`). Razón: el cronómetro es un estado central de esta variante que debe reflejarse en tiempo real en el HUD exterior, igual de crítico que `onScore`; omitirlo forzaría a leer el tiempo desde el canvas (inconsistente con el patrón de HUD sincronizado por callbacks que usan los demás juegos).
- **Sí:** nivel atado a la mejor racha de combo (`maxCombo`), no al valor de ficha más alto. Razón: refuerza mecánicamente el diferenciador de esta variante (premia encadenar fusiones rápido) en vez de duplicar el criterio de nivel de Fusión clásico.
- **Sí:** techo de `90s` para el tiempo acumulado por bonus. Razón: evita una partida potencialmente infinita si el jugador encadena fusiones indefinidamente; mantiene el score como el objetivo real, no la supervivencia.
- **Sí:** loop híbrido (event-driven para movimiento + continuo con `dt` para el cronómetro). Razón: es la combinación mínima necesaria — un loop puramente continuo no tiene sentido sin movimiento automático, y uno puramente discreto no puede decrementar un reloj en tiempo real.
- **No:** power-ups adicionales (congelar reloj, comodines, etc.). Razón: el bonus de tiempo por fusión y el multiplicador de combo ya son suficiente diferenciador; más mecánicas es sobre-ingeniería para esta corrida.
- **No:** `onLives`. Razón: no hay concepto de vidas; el fin de partida es por tiempo o por tablero bloqueado.
- **No:** animaciones de deslizamiento con tween. Razón: mismo criterio que `01-fusion.md`.

## Riesgos

| Riesgo                                                                                              | Mitigación                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tipar el estado mutable (grid + combo + cronómetro) en TS strict resulta más extenso de lo esperado | Tipar `Cell`/`Grid`/`CronofusionCallbacks` primero, encapsular el estado mutable dentro de `CronofusionEngine` al final; nunca desactivar `strict` globalmente. |
| El acumulador de `dt` del cronómetro se dispara con un salto grande tras cambiar de pestaña         | Tope de `dt` en el loop (`Math.min(dt, 0.05)`), igual que en Asteroids y Serpentina.                                                                            |
| Divergencia accidental entre el algoritmo de fusión de esta variante y el de `01-fusion.md`         | Implementar y probar primero la función de movimiento/fusión de forma aislada (mismo caso de prueba manual que Fusión clásico) antes de agregar combo/tiempo.   |
| El bonus de tiempo por fusión, sin techo, permitiría una partida indefinida                         | `timeLeft` se acota explícitamente a `TIME_START` como techo tras cada bonus — documentado en el diseño del engine, no solo en la implementación.               |
| El `sort_order` elegido (9) choca si `01-fusion` aún no se implementó y este spec aterriza primero  | Reverificar `select max(sort_order) from games` contra la tabla real justo antes de la migración del paso 5, no asumir el valor de este spec a ciegas.          |

## Lo que **no** está en este spec

- Modificar el leaderboard (ya genérico).
- El modo clásico `fusion` — spec `01-fusion.md`.
- Animaciones de deslizamiento con tween.
- Power-ups adicionales más allá del bonus de tiempo y el multiplicador de combo.
- Tablas de dificultad/duración configurable.
- Controles táctiles / swipe.
- Skins visuales alternativas.
- Autenticación, realtime, y cualquier otro juego.

Cada uno, si llega, va en su propio spec.
