# SPEC game-jam/laberinto/01 — Integración del juego GLOTÓN (persecución en laberinto tipo Pac-Man)

> **Estado:** Aprobado · **Depende de:** 04-supabase-setup, 05-asteroids-game, 06-leaderboard, 09-games-catalog-supabase · **Fecha:** 2026-07-20
> **Objetivo:** integrar el juego GLOTÓN como página /games/gloton con HUD sincronizado (puntuación, vidas y nivel), guardado de puntuaciones en Supabase y presencia automática en el leaderboard.

## Por qué existe este spec

El catálogo ya tiene la entrada `gloton` (GLOTÓN), un comecocos temático con cover (`cover-glot`), categoría ARCADE, color `yellow` y descripciones que describen literalmente Pac-Man ("Un círculo glotón patrulla un laberinto coleccionando puntos luminosos. Cuatro espectros lo persiguen, pero cada cierto tiempo aparece una píldora que invierte los papeles"), pero **sin `play_route`**: hoy es un placeholder que enlaza al reproductor genérico `/game/[id]/play`, no a un juego real. Este es exactamente el estado en que estaba `serpentina` antes del spec 10. Como con Snake, **no hay un `game.js` de partida** en `references/started-games/` (solo existen 02-asteroids, 03-tetris y 04-arkanoid) — este spec diseña el engine desde cero aplicando el mismo patrón de integración validado (bridge de callbacks, HUD sincronizado, modal de game over), sin un paso de "migración" de código legado. Cierra el hueco del tema de la game jam ("persecución en laberinto tipo Pac-Man") dándole por fin engine a una fila que llevaba desde el 2026-07-14 esperándolo.

## Scope

**In:**

- Diseño e implementación de `lib/games/gloton/game.ts` en TypeScript strict desde cero: clase `GlotonEngine` con loop continuo por `dt` (movimiento fluido por los carriles del laberinto, no por ticks de grilla como Serpentina), reutilizando el patrón de acumulación de tiempo de Asteroids.
- Bridge de callbacks `GlotonCallbacks` = `onScore`, `onLives`, `onLevel`, `onGameOver` — los cuatro, porque el juego **tiene vidas** (un fantasma no asustado te atrapa y pierdes una vida) además de puntuación y niveles.
- Componente `components/games/gloton/GlotonGame.tsx` que monta el `<canvas>`, crea el engine con los callbacks y lo destruye al desmontar (calcado de `SerpentinaGame.tsx`).
- Página `app/games/gloton/page.tsx` con HUD (Jugador / Puntuación / Vidas / Nivel), botón PAUSA (`engine.setPaused`), botón SALIR y modal de game over con captura de nombre (input máx 10, mayúsculas) y `saveScore('gloton', nombre || 'INVITADO', finalScore)`.
- **Reutilización de la fila `gloton` existente** en la tabla `games` de Supabase vía migración: `update games set play_route = '/games/gloton' where id = 'gloton'` (no se crea fila nueva ni se toca `sort_order`, igual que hizo el spec 10 con `serpentina`). Ver justificación en Decisiones.
- Reutilización de la clase de cover `cover-glot`, que **ya existe** en `app/globals.css` (líneas ~747-762) — no se crea ni modifica CSS de cover.

**Fuera de scope (para specs futuros):**

- Modificar el leaderboard: ya es genérico (spec 06); solo se aprovecha y se verifica.
- Crear una entrada nueva de catálogo o un `id`/slug nuevo: se **reutiliza** la fila `gloton`.
- Fruta / bonus de nivel (cerezas, etc.): elemento clásico pero no esencial; queda para un spec futuro.
- Sonidos y música (waka-waka, sirena): sin audio, coherente con el resto de la plataforma.
- Sprites o spritesheets: render 100% vectorial con primitivas de canvas.
- Cutscenes entre niveles, modo dos jugadores, tablas de velocidad por nivel al detalle del arcade original.
- Controles táctiles / swipe para mobile.
- El otro contenido del tema game jam (cualquier variante de laberinto distinta): cada juego, si llega, va en su propio spec.
- Autenticación y realtime.

## Diseño del engine (no hay código de partida)

Al no existir un `game.js` de referencia, se define aquí el diseño que `/spec-impl` debe construir:

**Grilla y canvas:** el laberinto se define como un **mapa ASCII estático** (array de strings), donde cada carácter es una celda: `#` muro, `.` pastilla, `o` power-pellet, ` ` pasillo vacío, `-` puerta de la casa de fantasmas, `P` spawn del jugador, `G` spawn de fantasma. El engine parsea el mapa una vez a estructuras internas (grilla de muros `boolean[][]`, conjunto de pastillas, spawns). Cada celda mide `CELL = 24` px; el tamaño del canvas se deriva del mapa (`COLS * CELL` × `ROWS * CELL`). Se recomienda un laberinto compacto y simétrico de ~19 columnas × 21 filas (canvas ≈ 456×504) con un **túnel horizontal** en una fila central. El trazado exacto del mapa se autora durante la implementación; el spec fija el formato y las dimensiones, no el dibujo celda a celda.

**Estado:**

```ts
type Dir = { x: -1 | 0 | 1; y: -1 | 0 | 1 };

type GhostMode = 'scatter' | 'chase' | 'frightened' | 'eyes';
type GameState = 'playing' | 'dying' | 'levelclear' | 'gameover';

interface GlotonCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

Internamente el engine mantiene: `walls: boolean[][]`, `pellets: boolean[][]` + `powerPellets: boolean[][]` + `pelletsRemaining: number`, el jugador (posición en píxeles `x/y`, `dir` actual y `desiredDir` en buffer), un array `ghosts` de 4 fantasmas (cada uno con `x/y`, `dir`, `mode`, color y su función de tile-objetivo), `score`, `lives`, `level`, `frightTimer`, `ghostChain` (índice de la cadena de puntos por comer fantasmas), `modeTimer` (alternancia scatter/chase) y `gameState`.

**Loop continuo por `dt` (no por ticks):** a diferencia de Serpentina (pasos discretos de grilla), Glotón se mueve de forma **fluida** por los pasillos, como el Pac-Man original. El `requestAnimationFrame` corre cada frame con `dt = min((ts - last)/1000, 0.05)` — mismo cálculo y mismo tope de `dt` que Asteroids. Jugador y fantasmas avanzan `velocidad * dt` px por frame a lo largo del carril actual.

**Movimiento por carriles con giro bufferizado:** las entidades solo pueden girar cuando están **centradas** en una celda (dentro de un epsilon) y la celda vecina en la dirección deseada no es muro. El jugador guarda la última flecha en `desiredDir` y el engine la aplica en cuanto está alineado y el giro es legal; si `desiredDir` no es transitable, sigue recto hasta chocar (entonces se detiene, esperando otra flecha). Es el patrón estándar de Pac-Man y reutiliza la aritmética de celdas de la grilla.

**IA de persecución de los fantasmas:** cada fantasma tiene una **personalidad** expresada como una función que devuelve su _tile objetivo_, y en cada intersección elige el vecino transitable (sin invertir la dirección salvo cambio de modo global) que **minimiza la distancia** a ese objetivo — la navegación greedy clásica del arcade:

- **Rojo (persecución directa):** objetivo = tile actual del jugador.
- **Rosa (emboscada):** objetivo = 4 tiles por delante del jugador según su dirección.
- **Cian (flanqueo):** objetivo = reflejo, calculado a partir del vector desde el fantasma rojo hacia un punto adelantado del jugador.
- **Naranja (tímido):** objetivo = el jugador si está lejos, su esquina de refugio si está cerca (< 8 tiles).

**Modos globales (máquina de estados de fantasma):** un `modeTimer` alterna **scatter** (cada fantasma va a su esquina de refugio) y **chase** (usa su personalidad), p. ej. 7 s scatter / 20 s chase. Comer un power-pellet fuerza **frightened** durante `FRIGHT_TIME` segundos: los fantasmas se vuelven azules, bajan de velocidad, invierten su dirección y se pueden comer. Un fantasma comido pasa a **eyes** (solo ojos), vuelve a la casa por el camino más corto y allí revive en modo normal. Al terminar `frightTimer` los supervivientes vuelven a scatter/chase.

**Pastillas, power-pellets y score:**

- Pastilla comida: `+PELLET_POINTS` (10), `pelletsRemaining--`.
- Power-pellet comido: `+POWER_POINTS` (50), dispara `frightened` y resetea `ghostChain = 0`.
- Fantasma asustado comido: puntos según la cadena `GHOST_POINTS = [200, 400, 800, 1600]` (avanza `ghostChain` y se reinicia con cada power-pellet).
- `onScore(score)` se llama en cada mutación de la puntuación.

**Vidas y muerte:** contacto con un fantasma en modo `chase`/`scatter` → `gameState = 'dying'`, breve animación, `lives--`, `onLives(lives)`. Si `lives > 0`, se reposicionan jugador y fantasmas a sus spawns **conservando** el estado de pastillas del laberinto y se reanuda; si `lives === 0`, `gameState = 'gameover'` y `onGameOver(score)`. `START_LIVES = 3`.

**Niveles:** cuando `pelletsRemaining === 0`, `gameState = 'levelclear'`, `level++`, `onLevel(level)`, se rellena el laberinto, se reposiciona todo y sube la dificultad: la velocidad de los fantasmas aumenta levemente por nivel y `FRIGHT_TIME` decrece por nivel (con un piso). El `level` se lleva como contador propio (se incrementa al limpiar el laberinto), **no** se deriva del score como en Serpentina.

**Túnel wrap:** en la fila del túnel, cruzar un borde lateral reaparece por el opuesto (reutiliza la idea de `wrap()` de Asteroids, aplicada solo a esa fila). Los fantasmas se ralentizan al atravesar el túnel, como en el original.

**Controles:** solo teclado — `↑ ↓ ← →` fijan `desiredDir`. Sin control por ratón (no aplica a un laberinto direccional). La pausa se maneja en la página con `P`/`Escape` (mismo precedente que Serpentina), no dentro del engine.

**Render:** sin sprites ni sonidos — todo con primitivas de canvas (estética vectorial de neón como Asteroids). Muros como trazos redondeados azul-neón; pastillas como puntos pequeños; power-pellets como discos grandes pulsantes; jugador como un arco `yellow` con boca animada (cuña que abre/cierra según avanza); fantasmas con la silueta clásica (cúpula + faldón ondulado) y ojos mirando a su dirección. En modo `frightened` los fantasmas se pintan azules con boca ondulada; en `eyes`, solo los ojos. Los colores de render de los fantasmas (rojo/rosa/cian/naranja) son fills libres de canvas y **no** están atados a la paleta de 4 colores del catálogo — igual que Asteroids pinta blanco/naranja/cian sin restricción. El acento de catálogo de la tarjeta sigue siendo `yellow`. Cero assets nuevos.

**Sin clases para cada tipo de dato trivial:** las pastillas viven en grillas `boolean[][]` y los muros igual; solo el jugador y los fantasmas ameritan estructura propia (interfaz o clase ligera) por tener estado y comportamiento — el resto de la lógica se encapsula en `GlotonEngine`, mismo criterio que `Rect`/`Ball`/`Block` en Bloque Buster.

## Modelo de datos

**No introduce datos nuevos en Supabase:** reutiliza la tabla `scores` y el `saveScore` existentes (`game_id = 'gloton'`), y **reutiliza la fila `gloton` ya presente** en la tabla `games` (solo se le añade `play_route` vía migración). Sin assets nuevos (sin sprites ni audio); la clase `cover-glot` ya existe en `globals.css`.

```ts
// lib/games/gloton/game.ts
const CELL = 24; // px por celda; canvas = COLS*CELL × ROWS*CELL
const PELLET_POINTS = 10;
const POWER_POINTS = 50;
const GHOST_POINTS = [200, 400, 800, 1600]; // cadena por power-pellet
const FRIGHT_TIME = 6; // s en nivel 1, decrece por nivel con piso
const START_LIVES = 3;

type Dir = { x: -1 | 0 | 1; y: -1 | 0 | 1 };
type GhostMode = 'scatter' | 'chase' | 'frightened' | 'eyes';
type GameState = 'playing' | 'dying' | 'levelclear' | 'gameover';

interface GlotonCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

## Plan de implementación

1. Crear rama `gloton-game` desde `main`.

2. Crear `lib/games/gloton/game.ts` en TypeScript strict, tipos base y parser del mapa:
   - Tipar primero `Dir`, `GhostMode`, `GameState`, `GlotonCallbacks` y las constantes.
   - Definir el mapa ASCII estático y un parser que produzca `walls`, `pellets`, `powerPellets`, `pelletsRemaining` y los spawns (jugador + 4 fantasmas + casa).
   - Utilidades de grilla: conversión celda↔píxel, `isWall(c, r)`, `atCellCenter(entity)` y `wrap()` para la fila del túnel.
     Verificar: `tsc --noEmit` sin errores; un log del parseo muestra el conteo de pastillas y los spawns correctos.

3. Implementar el jugador y el consumo de pastillas dentro de `GlotonEngine`:
   - Constructor `new GlotonEngine(canvas, callbacks)`: inicializa estado, coloca al jugador en su spawn, `score = 0`, `lives = 3`, `level = 1`, `gameState = 'playing'`; llama `onScore(0)`, `onLives(3)`, `onLevel(1)`.
   - Listener de teclado (`keydown` en `window`, removido en `destroy()`) que fija `desiredDir`.
   - Movimiento fluido por carriles con giro bufferizado; comer pastilla/power-pellet suma puntos y actualiza `pelletsRemaining`; loop `requestAnimationFrame` con `dt` capado y render básico (muros + pastillas + jugador con boca animada).
   - Métodos públicos `setPaused(paused)` y `destroy()`.
     Verificar: el glotón se mueve con las flechas, come pastillas, la puntuación sube y no atraviesa muros.

4. Implementar los 4 fantasmas y su IA de persecución:
   - Estructura de fantasma con `x/y`, `dir`, `mode`, color y función de tile-objetivo (rojo/rosa/cian/naranja).
   - Navegación greedy en intersecciones hacia el tile objetivo, sin invertir salvo cambio de modo; alternancia global scatter↔chase por `modeTimer`.
   - Render de la silueta clásica con ojos orientados.
     Verificar: los cuatro fantasmas salen de la casa, persiguen al jugador con comportamientos distinguibles y respetan los muros.

5. Implementar power-pellets, modo `frightened`/`eyes`, vidas y niveles:
   - Comer power-pellet → `frightened` (fantasmas azules, lentos, invierten dirección); comer fantasma asustado → puntos de `GHOST_POINTS`, pasa a `eyes` y revive en la casa.
   - Colisión con fantasma normal → `dying`, `lives--`, `onLives`; reposicionar o `gameover` + `onGameOver` según vidas.
   - Limpiar el laberinto → `levelclear`, `level++`, `onLevel`, refill y subida de dificultad.
     Verificar: el ciclo completo (asustar, comer fantasmas, morir, perder vidas, limpiar nivel) funciona y dispara los callbacks correctos.

6. Crear `components/games/gloton/GlotonGame.tsx` (Client Component) calcado de `SerpentinaGame.tsx`: canvas con `width`/`height` derivados del mapa y `style` `width: 100%; height: auto; max-width`, crea el `GlotonEngine` en un `useEffect`, lo destruye al desmontar, soporta reinicio vía `key`.
   Verificar: el juego arranca y responde a las flechas al montar el componente.

7. Crear `app/games/gloton/page.tsx` calcada de `app/games/serpentina/page.tsx`: HUD exterior (Jugador `INVITADO` / Puntuación / Vidas / Nivel), botón PAUSA (`engine.setPaused`), botón SALIR, atajo `P`/`Escape` para pausar y modal de game over con input de nombre (máx 10, mayúsculas) que llama `saveScore('gloton', playerName || 'INVITADO', finalScore)`.
   Verificar: el HUD refleja en tiempo real puntuación, vidas y nivel del engine.

8. Aplicar la migración de catálogo: `update games set play_route = '/games/gloton' where id = 'gloton'` (reutiliza la fila existente; no toca `sort_order`, `cover`, `color` ni descripciones).
   Verificar: la tarjeta GLOTÓN en la biblioteca/home enlaza a `/games/gloton` y ya no al reproductor genérico.

9. Ejecutar `npm run build` y corregir errores de TypeScript o ESLint. Marcar el spec como `Implementado` y crear PR `gloton-game` → `main`.

## Criterios de aceptación

- [ ] `/games/gloton` carga sin errores en consola y es jugable con `↑ ↓ ← →`.
- [ ] El glotón se mueve de forma fluida por los pasillos, gira solo cuando el giro es legal y nunca atraviesa un muro.
- [ ] Comer una pastilla suma 10 puntos; comer un power-pellet suma 50 y pone a los cuatro fantasmas en modo asustado (azules).
- [ ] Durante el modo asustado, comer fantasmas otorga 200, 400, 800 y 1600 puntos en cadena; el fantasma comido vuelve a la casa como ojos y revive.
- [ ] Los cuatro fantasmas persiguen al jugador con comportamientos distinguibles y respetan los muros.
- [ ] Chocar con un fantasma no asustado resta una vida; al llegar a 0 vidas se dispara el modal de game over.
- [ ] Limpiar todas las pastillas del laberinto sube de nivel, rellena el laberinto y aumenta la dificultad.
- [ ] El HUD exterior muestra puntuación, vidas y nivel actualizados en tiempo real (reflejo del estado interno del engine).
- [ ] El botón PAUSA (y `P`/`Escape`) detiene el juego; pulsarlo de nuevo lo reanuda.
- [ ] El botón SALIR navega a `/library` y destruye el engine (sin loops ni listeners en background).
- [ ] El input de nombre acepta máx 10 caracteres en mayúsculas; guardar inserta una fila en `scores` con `game_id = 'gloton'` sin requerir autenticación.
- [ ] La puntuación guardada aparece en el leaderboard por juego (`/game/gloton`) y, si es alta, en el global de la home — **sin** haber modificado el leaderboard.
- [ ] La tarjeta GLOTÓN enlaza a `/games/gloton`.
- [ ] `npm run build` completa sin errores de TypeScript ni ESLint.

## Decisiones

- **Sí (recomendado):** reutilizar la fila `gloton` existente y solo añadirle `play_route = '/games/gloton'` vía migración. Razón: la fila ya es un placeholder de Pac-Man perfecto (título GLOTÓN, ARCADE, `yellow`, cover `cover-glot`, descripciones de "círculo glotón / laberinto / cuatro espectros / píldora que invierte los papeles"), con `play_route: null`. Es el mismo precedente exacto de Serpentina (spec 10), Caída y Bloque Buster, que reutilizaron entradas de catálogo ya presentes. El vínculo con `TICKER_ROWS` es puramente cosmético: el ticker de la home referencia "Glotón" por **nombre de display** (string del marquee), no por `id`, así que darle engine no lo altera. Trade-off: se hereda el `best`/`plays` seed de la fila (96400 / "27.2K"), que son valores decorativos del catálogo — igual que Serpentina/Caída heredaron los suyos; el leaderboard real se lee de `scores`, no de `games.best`, así que no hay inconsistencia funcional.
- **No (alternativa considerada):** elegir un `id`/slug nuevo (p. ej. `comelaberinto` o `tragabolas`) y dejar la fila `gloton` como placeholder muerto. Razón para descartarla: crearía **dos** entradas ARCADE/`yellow` de comecocos (una sin engine, otra con engine), duplicación confusa; obligaría a crear fila, cover y descripciones nuevas; y dejaría `gloton` enlazando para siempre al reproductor genérico. Reutilizar es más limpio y resuelve de raíz el motivo por el que `gloton` figura como `Descartado` en `game-suggestions.md` ("id ya ocupado"). El `id` `gloton` se usa de forma consistente en el título, la ruta `/games/gloton`, el `saveScore('gloton', …)` y la migración de la fila.
- **Sí:** callbacks `onScore` / `onLives` / `onLevel` / `onGameOver` — los cuatro. Razón: a diferencia de Serpentina (sin vidas), Glotón tiene 3 vidas y un fantasma normal te mata sin terminar la partida de inmediato; mismo criterio de vidas que Asteroids y Bloque Buster.
- **Sí:** loop continuo por `dt` con movimiento fluido por carriles, no por ticks de grilla. Razón: es el feel auténtico del comecocos y reutiliza el cálculo de `dt` capado de Asteroids; aporta además diversidad de mecánica frente al loop por ticks de Serpentina.
- **Sí:** IA de fantasmas por tile-objetivo + elección greedy en intersecciones. Razón: reproduce las personalidades clásicas (persecución/emboscada/flanqueo/tímido) con poco código y sin pathfinding costoso.
- **Sí:** laberinto como mapa ASCII estático parseado en el arranque. Razón: separa datos (trazado) de lógica, fácil de leer/ajustar, y evita generación procedural innecesaria para un MVP.
- **No:** fruta/bonus, audio, sprites, cutscenes ni modo 2 jugadores. Razón: no esenciales para el MVP jugable; cada uno va a su propio spec si se decide.
- **No:** controles táctiles. Razón: fuera de scope de este MVP, igual que en los demás juegos integrados.
- **Sí:** pausa por `P`/`Escape` manejada en `page.tsx`, no en el engine. Razón: replica el precedente de Serpentina/Bloque Buster y evita inventar un callback nuevo fuera de `GlotonCallbacks`.

## Riesgos

| Riesgo                                                                                                | Mitigación                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Escribir el engine (grilla, IA, estados) directamente en TS strict resulta más extenso de lo esperado | Tipar primero (`Dir`, `GhostMode`, `GameState`, callbacks), encapsular el estado mutable dentro de `GlotonEngine` al final, y nunca desactivar `strict` globalmente.                 |
| El giro bufferizado falla en las esquinas (el jugador se "pega" o corta muros)                        | Permitir el giro solo cuando la entidad está centrada en la celda (epsilon) y la celda destino es transitable; snapear al centro exacto al girar.                                    |
| La IA greedy hace que los cuatro fantasmas se agrupen y sean triviales de esquivar                    | Personalidades con tiles objetivo distintos + alternancia scatter/chase; ajustar los tiempos de modo durante el paso 4 hasta que se sientan diferenciados.                           |
| Un fantasma queda encerrado en la casa o no encuentra salida tras ser comido (`eyes`)                 | Ruta de salida/entrada de la casa fija y probada; en `eyes`, dirigir el objetivo a la puerta de la casa y luego al punto de revivido.                                                |
| El `dt` se dispara tras cambiar de pestaña y las entidades atraviesan muros en un solo frame          | Tope de `dt` (`Math.min(dt, 0.05)`) como en Asteroids/Serpentina; el movimiento resuelve colisión con muros por celda, no por gran salto.                                            |
| El túnel wrap deja al jugador o a un fantasma medio-celda desalineado                                 | Aplicar `wrap()` solo en la fila del túnel y re-snapear al centro de celda tras el cruce.                                                                                            |
| La migración de `play_route` colisiona con un `lib/data.ts` que aún tuviera `GAMES` hardcodeado       | El spec 09 ya está `Implementado`: `lib/data.ts` no tiene `GAMES`; el paso 8 es una migración `update` contra Supabase, verificada con `select … where id = 'gloton'` antes/después. |

## Lo que **no** está en este spec

- Modificar el leaderboard (ya genérico).
- Crear una entrada nueva de catálogo o un `id`/slug distinto (se reutiliza `gloton`).
- Fruta/bonus, audio, sprites, cutscenes, tablas de velocidad al detalle del arcade y modo 2 jugadores.
- Controles táctiles / swipe.
- Autenticación, realtime, y cualquier otro juego del tema laberinto.

Cada uno, si llega, va en su propio spec.
