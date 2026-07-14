# SPEC 08 — Integración del juego Arkanoid (Bloque Buster)

> **Estado:** Implementado · **Depende de:** 04-supabase-setup, 05-asteroids-game, 06-leaderboard · **Fecha:** 2026-07-14
> **Objetivo:** Integrar el clásico Arkanoid (started-game `04-arkanoid`) como página jugable `/games/bloque-buster` —reutilizando la entrada `bloque-buster` del catálogo—, con su engine migrado a TypeScript, HUD sincronizado (puntuación, vidas y nivel), guardado de puntuaciones en Supabase y presencia automática en el leaderboard.

## Por qué existe este spec

El catálogo ya tiene la entrada `bloque-buster` (BLOQUE BUSTER), un breakout temático de neón, pero **sin `playRoute`**: no se puede jugar. Este spec la vuelve jugable siguiendo el patrón de integración validado con Asteroids (spec 05) y Caída (spec 07), y aprovechando el leaderboard genérico (spec 06). El engine original (`references/started-games/04-arkanoid/game.js`) es funcional, acoplado al DOM, sin clases y con assets propios (spritesheet + sonidos), así que el grueso del trabajo es encapsularlo, desacoplarlo del DOM y reubicar los assets en `public/`, no reescribir la lógica.

A diferencia de Asteroids y Caída, Arkanoid tiene **dos estados terminales**: `gameover` (se pierden las 3 vidas) y `win` (se completan los 5 niveles). Ambos cierran la partida y disparan el guardado de puntuación.

## Scope

**In:**

- Copiar `game.js`, `levels.js` y `assets/spritesheet.js` de `04-arkanoid` a `lib/games/bloque-buster/` y migrarlos a `lib/games/bloque-buster/game.ts` (TypeScript strict), encapsulado en una clase `ArkanoidEngine`.
- Copiar los assets binarios a `public/games/bloque-buster/`: `spritesheet-breakout.png` y `sounds/ball-bounce.mp3`, `sounds/break-sound.mp3`. Referenciarlos con rutas **absolutas** desde el engine.
- Bridge de callbacks `ArkanoidCallbacks` = `onScore`, `onLives`, `onLevel`, `onGameOver` (con `onLives`: Arkanoid sí tiene vidas). `onGameOver(finalScore, won)` incluye un booleano `won` para distinguir victoria de derrota en el modal.
- Componente `components/games/bloque-buster/BloqueBusterGame.tsx` que monta el `<canvas>` (800×600), crea el engine con los callbacks y lo destruye al desmontar.
- Página `app/games/bloque-buster/page.tsx` con HUD exterior (Jugador / Puntuación / Vidas / Nivel), botón PAUSA y modal de game over con captura de nombre (input máx 10, mayúsculas) y `saveScore('bloque-buster', nombre || 'INVITADO', finalScore)`.
- Agregar `playRoute: '/games/bloque-buster'` a la entrada `bloque-buster` existente en `lib/data.ts`.

**Fuera de scope (para specs futuros):**

- Modificar el leaderboard: ya es genérico (spec 06); solo se aprovecha y se verifica.
- Crear una entrada nueva de catálogo: se **reutiliza** `bloque-buster`.
- El overlay de pausa dibujado en canvas con selector de nivel (botones 1–5) y su `click` handler sobre el canvas: era una ayuda de desarrollo de la demo standalone. La plataforma usa su propio botón/overlay de PAUSA.
- Autenticación, realtime, input táctil, y cualquier otro juego.

## Modelo de datos

**No introduce datos nuevos en la base:** reutiliza la tabla `scores` y el `saveScore` existentes (los scores se guardan con `game_id = 'bloque-buster'`).

**Sí introduce assets estáticos nuevos** en `public/games/bloque-buster/` (spritesheet PNG + 2 MP3), copiados desde el started-game.

Y tipos TypeScript en el engine (al migrar el `game.js` no tipado):

```ts
// lib/games/bloque-buster/game.ts
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Ball extends Rect {
  vx: number;
  vy: number;
}

interface Block extends Rect {
  color: string;
  alive: boolean;
}

interface Explosion extends Rect {
  color: string;
  elapsed: number;
}

interface Level {
  speed: number;
  blocks: { col: number; row: number; color: string }[];
}

interface ArkanoidCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number, won: boolean) => void;
}
```

Convenciones del engine (heredadas del original): canvas 800×600; grilla de bloques 10×6, bloque 64×24, origen `(BLOCKS_ORIGIN_X, 80)`; paddle 81×14 en `y = 560`; pelota 16×16; 3 vidas; +10 pts por bloque; `BASE_BALL_VX = 200`, `BASE_BALL_VY = -300`; 5 niveles con multiplicador de velocidad creciente (×1.0 → ×1.46); `gameState ∈ 'playing' | 'gameover' | 'win'`.

## Plan de implementación

1. Crear rama `spec-08-bloque-buster-game` desde `main`. Copiar `references/started-games/04-arkanoid/{game.js,levels.js,assets/spritesheet.js}` a `lib/games/bloque-buster/` como punto de partida. Copiar los assets binarios a `public/games/bloque-buster/` (`spritesheet-breakout.png` y `sounds/`).

2. Migrar a `lib/games/bloque-buster/game.ts` en TypeScript strict, encapsulado en la clase `ArkanoidEngine`. Tipar **primero** las estructuras (`Rect`, `Ball`, `Block`, `Explosion`, `Level`, `ArkanoidCallbacks`) y los datos de `LEVELS`, y **después** encapsular los globales de estado (`paddle`, `ball`, `blocks`, `explosions`, `lives`, `score`, `currentLevel`, `gameState`, `isPaused`, `keys`, `lastTime`, `animId`) como propiedades de la clase.
   - Constructor: `new ArkanoidEngine(canvas, callbacks)`.
   - Desacoplar del DOM: recibir el canvas por parámetro (nada de `getElementById`). Integrar el helper del spritesheet (`loadSpritesheet` / `drawSprite` / `drawFrame`, más `SPRITES` / `EXPLOSION_FRAMES` / `EXPLOSION_DURATION`) dentro del módulo, apuntando a `/games/bloque-buster/spritesheet-breakout.png`. Instanciar los `Audio` con rutas absolutas `/games/bloque-buster/sounds/…`.
   - Listeners: `mousemove` sobre el **canvas** (paddle sigue el mouse, respetando el escalado CSS vía `getBoundingClientRect`), `keydown`/`keyup` en `document` para `←`/`→` y `P`/`Escape`. Adjuntarlos en el constructor y **removerlos todos en `destroy()`**.
   - Descartar el overlay de pausa dibujado en canvas, el selector de nivel 1–5 y el `click` handler asociado.
   - Añadir un tope de `dt` (p. ej. `Math.min(dt, 0.05)`) en el loop para evitar que la pelota atraviese bloques tras un cambio de pestaña.
   - Llamar los callbacks en los puntos exactos de mutación: `onScore` tras `score += 10` (colisión con bloque); `onLives` tras `lives--` (pelota perdida) y una vez al iniciar con el valor inicial; `onLevel` en `loadLevel` (cambio de `currentLevel`); `onGameOver(score, false)` al entrar en `gameover`, `onGameOver(score, true)` al entrar en `win`.
   - Métodos públicos: `setPaused(paused)` y `destroy()`. El engine arranca el loop en el callback de `loadSpritesheet`; `destroy()` cancela el `requestAnimationFrame` aunque el sprite aún no haya cargado.
     Verificar: `tsc --noEmit` sin errores.

3. Crear `components/games/bloque-buster/BloqueBusterGame.tsx` (Client Component): renderiza el `<canvas>` (800×600 con estilo `width: 100%; height: auto; max-width: 800px`), crea el `ArkanoidEngine` con el canvas y los callbacks en un `useEffect`, y lo destruye al desmontar. Soporta reinicio vía `key` y expone el engine por `engineRef` (igual que `AsteroidsGame`).
   Verificar: el juego arranca y responde a mouse y flechas.

4. Crear `app/games/bloque-buster/page.tsx` calcada de `app/games/asteroids/page.tsx`: HUD exterior (Jugador `INVITADO` / Puntuación / Vidas `♥` / Nivel), botón PAUSA (`engine.setPaused`) y botón SALIR, y modal de game over con input de nombre (máx 10, mayúsculas) que llama `saveScore('bloque-buster', playerName || 'INVITADO', finalScore)`. El modal muestra el título según `won`: `¡COMPLETADO!` en victoria, `FIN DEL JUEGO` en derrota.
   Verificar: el HUD refleja en tiempo real el estado interno del engine.

5. En `lib/data.ts`, agregar `playRoute: '/games/bloque-buster'` a la entrada `bloque-buster` (sin tocar el resto de sus campos: `title`, `cover: 'cover-bricks'`, `color: 'cyan'`, `cat: 'ARCADE'`, descripciones).
   Verificar: la tarjeta BLOQUE BUSTER en la biblioteca/home enlaza a la página jugable.

6. Ejecutar `npm run build` y corregir errores de TypeScript o ESLint. Marcar el spec como `Implementado` y crear PR `spec-08-bloque-buster-game` → `main`.

## Criterios de aceptación

- [x] `/games/bloque-buster` carga sin errores en consola y el Arkanoid es jugable con los controles: mouse o `←`/`→` mover el paddle, `P` o `Escape` (o el botón) pausar.
- [x] El spritesheet y los sonidos cargan desde `/games/bloque-buster/…` (rutas absolutas); se ven los sprites y se escuchan rebote y ruptura de bloque.
- [x] El HUD exterior muestra puntuación (+10 por bloque), vidas (`♥`) y nivel (1–5) actualizados en tiempo real conforme cambia el estado interno del engine.
- [x] El canvas se escala para no desbordar el viewport manteniendo proporción 4:3; la colisión no se ve afectada por el escalado visual.
- [x] El botón PAUSA detiene el juego; pulsarlo de nuevo lo reanuda.
- [x] El botón SALIR navega a `/library` y destruye el engine (sin loops ni listeners en background).
- [x] Al perder las 3 vidas aparece el modal con título `FIN DEL JUEGO`; al completar los 5 niveles aparece con título `¡COMPLETADO!`. En ambos casos con la puntuación final. _(verificado en vivo el caso de derrota; el caso de victoria se verificó por revisión de código — mismo mecanismo `onGameOver`, ya que jugar 300 bloques en 5 niveles no es práctico en una prueba manual)._
- [x] El input de nombre acepta máximo 10 caracteres y los convierte a mayúsculas; guardar inserta una fila en `scores` con `game_id = 'bloque-buster'` sin requerir autenticación.
- [x] La puntuación guardada aparece en el leaderboard por juego (`/game/bloque-buster`) y, si es alta, en el global de la home — **sin** haber modificado el leaderboard.
- [x] La tarjeta BLOQUE BUSTER enlaza a `/games/bloque-buster`.
- [x] `npm run build` completa sin errores de TypeScript ni ESLint.

## Decisiones

- **Sí:** reutilizar la entrada `bloque-buster` (no crear `arkanoid`). Razón: ya existe como breakout temático con cover (`cover-bricks`), categoría y descripciones; crear otra sería duplicar y dejar `bloque-buster` huérfano. Mismo precedente que Caída (Tetris) en el spec 07.
- **Sí:** encapsular en una clase `ArkanoidEngine` con el canvas por parámetro. Razón: consistencia con `AsteroidsEngine` / `TetrisEngine`; desacopla el engine del DOM y lo hace montable/desmontable en React.
- **Sí:** callbacks `onScore` / `onLives` / `onLevel` / `onGameOver`. Razón: Arkanoid tiene puntuación, vidas y niveles; el HUD es idéntico al de Asteroids.
- **Sí:** `onGameOver(finalScore, won)` con booleano `won`. Razón: Arkanoid, a diferencia de Asteroids/Caída, se puede ganar (5 niveles) o perder (3 vidas); ambos cierran la partida y guardan score, pero el modal cambia el título. Es la única desviación respecto a la firma de Asteroids, justificada por el estado `win`.
- **Sí:** copiar assets (spritesheet + 2 sonidos) a `public/games/bloque-buster/` y referenciarlos con rutas absolutas. Razón: en Next.js los estáticos se sirven desde `public/`; el engine no puede depender de rutas relativas de la demo standalone.
- **Sí:** integrar el helper `spritesheet.js` dentro de `game.ts`. Razón: es lógica de dibujo propia del engine; mantenerlo como script global suelto rompería el aislamiento del módulo.
- **Sí:** tope de `dt` en el loop. Razón: el original no lo tiene; sin él, tras un cambio de pestaña un `dt` grande hace que la pelota atraviese bloques.
- **No:** overlay de pausa en canvas con selector de nivel 1–5. Razón: era ayuda de desarrollo; la plataforma pausa con su propio botón/overlay y el salto de nivel arbitrario no aplica a una partida puntuada.
- **No:** tocar el leaderboard. Razón: es genérico desde el spec 06; basta con `game_id = 'bloque-buster'` consistente.
- **Definición rápida vía `/add-game`.** El análisis del engine y los metadatos fueron relevados por el skill `add-game`; el usuario confirmó las tres decisiones de plataforma (reutilizar `bloque-buster`, victoria guarda score, integrar sonidos).

## Riesgos

| Riesgo                                                                                                                    | Mitigación                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrar globals mutables + desacoplar del DOM + carga async del spritesheet a TS strict resulta más extenso de lo esperado | Tipar estructuras y `LEVELS` primero; encapsular el estado en la clase al final; iniciar el loop en el callback de carga; nunca desactivar `strict` globalmente. |
| El spritesheet no carga si la ruta relativa de la demo (`assets/…`) queda sin actualizar                                  | Copiar a `public/games/bloque-buster/` y usar rutas absolutas `/games/bloque-buster/…`; verificar en la pestaña de red que devuelven 200.                        |
| Autoplay de audio bloqueado por el navegador hasta la primera interacción                                                 | El paddle sigue el mouse; el primer `mousemove`/tecla cuenta como interacción. Aceptable: el sonido arranca al primer input, no antes.                           |
| El listener global de teclado captura teclas fuera del juego o rompe el scroll                                            | Adjuntar/remover en `constructor`/`destroy`; solo `←`/`→`/`P`/`Escape` se consumen. `mousemove` va sobre el canvas, no sobre `document`.                         |
| La pelota atraviesa un bloque a alta velocidad (nivel 5, ×1.46)                                                           | Tope de `dt` y colisión AABB con `break` de un bloque por frame (heredado del original); riesgo residual bajo a esta escala.                                     |

## Lo que **no** está en este spec

- Modificar el leaderboard (ya genérico).
- Crear una entrada nueva de catálogo (se reutiliza `bloque-buster`).
- Overlay de pausa en canvas con selector de nivel 1–5.
- Autenticación, realtime, input táctil, y cualquier otro juego.

Cada uno, si llega, va en su propio spec.
