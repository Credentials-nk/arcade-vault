# SPEC 10 — Integración del juego Snake (Serpentina)

> **Estado:** Implementado · **Depende de:** 04-supabase-setup, 05-asteroids-game, 06-leaderboard, 09-games-catalog-supabase · **Fecha:** 2026-07-14
> **Objetivo:** Construir un engine de Snake desde cero e integrarlo como página jugable `/games/serpentina` —reutilizando la entrada `serpentina` del catálogo—, con HUD sincronizado (puntuación y nivel), guardado de puntuaciones en Supabase y presencia automática en el leaderboard.

## Por qué existe este spec

El catálogo ya tiene la entrada `serpentina` (SERPENTINA), un Snake temático con cover (`cover-snake`) y descripciones, pero **sin `playRoute`**: no se puede jugar. A diferencia de Asteroids/Caída/Bloque Buster, **no hay un `game.js` de partida** en `references/started-games/` — este spec diseña el engine desde cero, aplicando el mismo patrón de integración validado (bridge de callbacks, HUD sincronizado, modal de game over) pero sin un paso de "migración", ya que no hay código legado que preservar.

## Scope

**In:**

- Diseño e implementación de `lib/games/serpentina/game.ts` en TypeScript strict desde cero: clase `SerpentinaEngine` con loop por "ticks" de grilla (no física continua como Asteroids/Arkanoid).
- Bridge de callbacks `SerpentinaCallbacks` = `onScore`, `onLevel`, `onGameOver` (sin `onLives` — Snake clásico no tiene vidas, un solo choque termina la partida).
- Componente `components/games/serpentina/SerpentinaGame.tsx` que monta el `<canvas>` (600×600), crea el engine con los callbacks y lo destruye al desmontar.
- Página `app/games/serpentina/page.tsx` con HUD (Jugador / Puntuación / Nivel — sin stat de vidas), botón PAUSA y modal de game over con captura de nombre (input máx 10, mayúsculas) y `saveScore('serpentina', nombre || 'INVITADO', finalScore)`.
- Agregar `playRoute: '/games/serpentina'` a la entrada `serpentina` existente en el catálogo (ver nota de dependencia condicional en el Plan, paso 5).

**Fuera de scope (para specs futuros):**

- Modificar el leaderboard: ya es genérico (spec 06); solo se aprovecha y se verifica.
- Crear una entrada nueva de catálogo: se **reutiliza** `serpentina`.
- Controles táctiles / swipe para mobile.
- Power-ups, obstáculos o modos de dificultad adicionales — es un Snake clásico, sin variantes.
- Autenticación, realtime, y cualquier otro juego.

## Diseño del engine (no hay código de partida)

Al no existir un `game.js` de referencia, se define aquí el diseño que `/spec-impl` debe construir:

**Grilla y canvas:** 30 columnas × 30 filas, celda de 20 px → canvas de 600×600. Serpiente inicial de 3 segmentos en el centro, moviéndose hacia la derecha. El juego arranca automáticamente al cargar la página (sin click adicional), igual que Asteroids/Bloque Buster.

**Estado:**

```ts
interface Point {
  x: number;
  y: number;
}

interface SerpentinaCallbacks {
  onScore: (score: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

Internamente el engine mantiene: `snake: Point[]` (cabeza en el índice 0), `direction: Point` (dirección actual, p. ej. `{x:1,y:0}`), `pendingDirection: Point` (última tecla presionada, se aplica recién en el próximo tick — evita que dos giros en el mismo frame provoquen un choque contra el propio cuello), `food: Point`, `score`, `level`, `gameState: 'playing' | 'gameover'` (sin estado `'win'` — Snake clásico no se "completa").

**Loop por ticks (no física continua):** a diferencia de Asteroids/Arkanoid (integración continua con `dt`), Snake avanza en pasos discretos de grilla. El `requestAnimationFrame` sigue corriendo cada frame para renderizar, pero la serpiente solo avanza una celda cuando un acumulador de tiempo supera `tickInterval` — mismo patrón de acumulador que ya usa Caída (Tetris) con `dropAccum`/`dropInterval` (spec 07), aplicado aquí al movimiento en vez de a la caída de una pieza.

**Velocidad y nivel:**

- `level = floor(score / 50) + 1`.
- `tickInterval = max(70, 160 - (level - 1) * 12)` ms — arranca en 160 ms/celda y baja 12 ms por nivel, con piso de 70 ms.
- `onLevel` se llama cada vez que `level` sube.

**Colisiones:**

- **Bordes: wrap-around**, igual que Asteroids (`wrap(x, COLS)` / `wrap(y, ROWS)`). Decisión explicada abajo — la descripción del catálogo ("crece sin morder tu propia cola") solo menciona el peligro de autocolisión, no los bordes.
- **Autocolisión:** si la nueva posición de la cabeza coincide con cualquier segmento existente del cuerpo → `gameState = 'gameover'`, `onGameOver(score)`.
- **Comida:** si la nueva cabeza coincide con `food`, el cuerpo crece (no se descarta la cola ese tick), `score += 10`, `onScore(score)`, se recalcula `level`/`tickInterval`, y se reubica `food` en una celda libre aleatoria (verificando que no caiga sobre el cuerpo).

**Controles:** solo teclado — `↑ ↓ ← →` cambian `pendingDirection`; se ignora una entrada que revierta directamente la dirección actual (evita un choque inmediato contra el propio cuello). Sin control por mouse — no aplica a un juego de grilla direccional.

**Render:** sin sprites ni sonidos — cuadrados lisos por celda (estética vectorial de neón, como Asteroids, no spritesheet como Arkanoid). Cuerpo en el color `green` ya asignado a `serpentina` en el catálogo; comida como cuadrado magenta pulsante, consistente con "núcleos magenta" de la descripción existente. Cero assets nuevos.

**Sin clases para entidades:** `snake`/`food` son datos simples (`Point[]` / `Point`), no ameritan clases propias — toda la lógica vive encapsulada en `SerpentinaEngine`, igual que `Rect`/`Ball`/`Block` en Bloque Buster son interfaces, no clases con comportamiento.

## Modelo de datos

**No introduce datos nuevos en Supabase:** reutiliza la tabla `scores` y el `saveScore` existentes (`game_id = 'serpentina'`). Sin assets nuevos (sin sprites ni audio).

```ts
// lib/games/serpentina/game.ts
const COLS = 30;
const ROWS = 30;
const CELL = 20; // canvas 600×600

interface Point {
  x: number;
  y: number;
}

interface SerpentinaCallbacks {
  onScore: (score: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

## Plan de implementación

1. Crear rama `10-serpentina-game` desde `main`.

2. Crear `lib/games/serpentina/game.ts` en TypeScript strict, clase `SerpentinaEngine`, desde cero (no hay `game.js` que migrar):
   - Tipar primero `Point` y `SerpentinaCallbacks`.
   - Constructor: `new SerpentinaEngine(canvas, callbacks)`. Inicializa `snake` (3 segmentos, centro de la grilla), `direction`, `food` (posición aleatoria libre), `score = 0`, `level = 1`, `gameState = 'playing'`.
   - Listener de teclado (`keydown` en `window`, removido en `destroy()`) que actualiza `pendingDirection`, ignorando reversiones directas.
   - Loop `requestAnimationFrame` con acumulador de tiempo (`tickAccum += dt`); cuando `tickAccum >= tickInterval`, avanza la serpiente un paso, resetea `tickAccum` y aplica `pendingDirection` como `direction`.
   - Wrap-around en los bordes; detección de autocolisión; detección y consumo de comida con recálculo de `level`/`tickInterval`; llamada a los callbacks en los puntos exactos de mutación.
   - Métodos públicos `setPaused(paused)` y `destroy()` (cancela el `requestAnimationFrame`, remueve el listener de teclado).
     Verificar: `tsc --noEmit` sin errores.

3. Crear `components/games/serpentina/SerpentinaGame.tsx` (Client Component): canvas 600×600 con `width: 100%; height: auto; max-width: 600px`, crea el `SerpentinaEngine` en un `useEffect`, lo destruye al desmontar, soporta reinicio vía `key`.
   Verificar: la serpiente se mueve sola al cargar y responde a las flechas.

4. Crear `app/games/serpentina/page.tsx` calcada de `app/games/caida/page.tsx`: HUD exterior (Jugador `INVITADO` / Puntuación / Nivel — sin stat de vidas), botón PAUSA (`engine.setPaused`) y botón SALIR, y modal de game over con input de nombre (máx 10, mayúsculas) que llama `saveScore('serpentina', playerName || 'INVITADO', finalScore)`.
   Verificar: el HUD refleja en tiempo real el estado interno del engine.

5. Agregar `playRoute: '/games/serpentina'` a la entrada `serpentina`. **Nota de dependencia condicional (resuelta):** el spec 09 ya estaba `Implementado` al momento de implementar este spec, así que este paso se hizo como migración `update games set play_route = '/games/serpentina' where id = 'serpentina'` contra Supabase — no como edición de `lib/data.ts` (ese archivo ya no tiene `GAMES`).
   Verificar: la tarjeta SERPENTINA en la biblioteca/home enlaza a la página jugable.

6. Ejecutar `npm run build` y corregir errores de TypeScript o ESLint. Marcar el spec como `Implementado` y crear PR `10-serpentina-game` → `main`.

## Criterios de aceptación

- [x] `/games/serpentina` carga sin errores en consola; la serpiente se mueve sola desde el inicio y responde a `↑ ↓ ← →`.
- [x] Comer la comida (cuadrado magenta) crece la serpiente en 1 segmento y suma 10 puntos.
- [x] Cruzar cualquier borde del canvas hace reaparecer a la serpiente por el lado opuesto (wrap-around), sin terminar la partida.
- [x] Chocar contra el propio cuerpo termina la partida y dispara el modal de game over.
- [x] El HUD exterior muestra puntuación y nivel actualizados en tiempo real; el nivel sube cada 50 puntos y la serpiente se mueve visiblemente más rápido. _(El cambio de puntuación/nivel en vivo se verificó; la subida de nivel a los 50 puntos se verificó por revisión de código — no se alcanzó ese puntaje en la prueba manual.)_
- [x] El botón PAUSA detiene el juego; pulsarlo de nuevo lo reanuda.
- [x] El botón SALIR navega a `/library` y destruye el engine (sin loops ni listeners en background).
- [x] El input de nombre acepta máximo 10 caracteres y los convierte a mayúsculas; guardar inserta una fila en `scores` con `game_id = 'serpentina'` sin requerir autenticación.
- [x] La puntuación guardada aparece en el leaderboard por juego (`/game/serpentina`) y, si es alta, en el global de la home — **sin** haber modificado el leaderboard.
- [x] La tarjeta SERPENTINA enlaza a `/games/serpentina`.
- [x] `npm run build` completa sin errores de TypeScript ni ESLint.

## Decisiones

- **Sí:** reutilizar la entrada `serpentina` (no crear `snake`). Razón: ya existe como Snake temático con cover (`cover-snake`), categoría y descripciones; mismo precedente que Bloque Buster (Arkanoid) y Caída (Tetris).
- **Sí:** diseñar el engine desde cero en TypeScript strict, sin paso de migración. Razón: no existe `game.js` de partida en `references/started-games/` ni en el resto del repo — se confirmó explícitamente con el usuario antes de redactar este spec.
- **Sí:** bordes en wrap-around, no game over al tocar la pared. Razón: la descripción existente del catálogo ("crece sin morder tu propia cola") solo nombra el autocontacto como peligro; wrap-around además reutiliza el patrón `wrap()` ya validado en Asteroids. Confirmado explícitamente con el usuario.
- **Sí:** callbacks `onScore` / `onLevel` / `onGameOver`, sin `onLives`. Razón: Snake clásico no tiene vidas — un solo choque contra el propio cuerpo termina la partida, mismo criterio que Caída (Tetris) al omitir `onLives`.
- **Sí:** loop por ticks con acumulador, no física continua. Razón: Snake es un juego de grilla por naturaleza; el patrón de acumulador ya existe en Caída (`dropAccum`/`dropInterval`) y es el más apto, no la integración continua de Asteroids/Arkanoid.
- **Sí:** sin sprites ni sonido, render con formas vectoriales lisas. Razón: cero necesidad de assets nuevos; consistente con la estética vectorial ya usada en Asteroids.
- **No:** power-ups, obstáculos o modos de dificultad. Razón: es un Snake clásico; cualquier variante queda para un spec futuro si se decide.
- **No:** controles táctiles. Razón: fuera de scope de este MVP, igual que en los demás juegos integrados.
- **Sí (agregado en implementación):** atajo de teclado `P`/`Escape` para pausar, manejado en `page.tsx` (no en el engine). Razón: no estaba en el diseño original del engine, pero replica el precedente ya validado en Bloque Buster; se implementa en la página para no inventar un callback nuevo fuera de `SerpentinaCallbacks`.

## Riesgos

| Riesgo                                                                                      | Mitigación                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Doble giro en el mismo tick provoca un choque inmediato contra el propio cuello             | `pendingDirection` se aplica una sola vez por tick y se ignora cualquier intento de revertir la dirección actual directamente.                                             |
| El acumulador de tiempo (`tickAccum`) se dispara con un `dt` grande tras cambiar de pestaña | Tope de `dt` en el loop (`Math.min(dt, 0.05)`), igual que en Asteroids y Bloque Buster.                                                                                    |
| La comida se reubica sobre una celda ocupada por el propio cuerpo                           | Al reubicar, verificar que la celda elegida no esté en `snake`; si lo está, volver a sortear (la grilla de 900 celdas hace esto trivialmente rápido).                      |
| El paso 5 (agregar `playRoute`) depende de si el spec 09 ya aterrizó                        | Documentado explícitamente como nota condicional en el plan; quien implemente este spec debe revisar el estado real de `lib/data.ts` / la tabla `games` antes de ese paso. |

## Lo que **no** está en este spec

- Modificar el leaderboard (ya genérico).
- Crear una entrada nueva de catálogo (se reutiliza `serpentina`).
- Controles táctiles / swipe.
- Power-ups, obstáculos o modos de dificultad adicionales.
- Autenticación, realtime, y cualquier otro juego.

Cada uno, si llega, va en su propio spec.
