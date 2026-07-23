# Game Performance Booster — memoria viva

> Memoria viva del subagente **`@game-performance-booster`**
> (`.claude/agents/game-performance-booster.md`). Mismo patrón que
> `references/game-skins.md` (para `@skin-designer`) y
> `references/mobile-porter-todo.md` (para `@mobile-porter`): el agente lee
> este documento al arrancar cada corrida y registra acá qué patrones de la
> checklist P1–P5 ya se revisaron/aplicaron en qué motor, para no
> re-auditar lo ya hecho ni perder el criterio de una corrida a la otra.
> Trabaja **de a un motor por corrida** (`lib/games/<id>/game.ts`), nunca
> barre el catálogo.

## Checklist de referencia (fija, no se repite por corrida)

- **P1** — Un solo dueño del `requestAnimationFrame` (cancelar antes de
  reagendar en todo camino que reanude/reinicie/arranque el loop).
  Referencia canónica: `init()` de `lib/games/caida/game.ts`.
- **P2** — Compactación de arrays in-place por frame en vez de
  `filter()`/`concat()` (nunca filtrar el mismo array dos veces en el mismo
  frame).
- **P3** — Sacar del frame la construcción de `rgba(...)`/estilos
  por-entidad-por-frame (cachear en constructor/`setSkin`, o bucketear por
  alpha cuantizado). Referencia: `rgbTriplet` en `lib/skins.ts`.
- **P4** — Cachear contenido estático del canvas (`Path2D`/offscreen) en vez
  de re-emitir N `stroke`/`lineTo` por frame.
- **P5** — Poolear alocaciones de `Audio` por evento en vez de
  `new Audio()`/`cloneNode()` por evento.

Anti-sobreingeniería (nunca aplicar): spatial partitioning, dirty-rect
clearing, caps de crecimiento, pooling de entidades más allá del contenedor
de P2, micro-optimización matemática. Ningún engine del catálogo supera
~100 entidades vivas.

## Tabla de corridas

| Fecha      | Juego (`id`)    | Encontrados    | Aplicados      | N/A        | Build |
| ---------- | --------------- | -------------- | -------------- | ---------- | ----- |
| 2026-07-23 | `asteroids`     | P1, P2, P3, P4 | P1, P2, P3, P4 | P5         | Verde |
| 2026-07-23 | `caida`         | P1, P4         | P1, P4         | P2, P3, P5 | Verde |
| 2026-07-23 | `bloque-buster` | P1, P2, P3, P5 | P1, P2, P3, P5 | P4         | Verde |
| 2026-07-23 | `serpentina`    | P1, P3         | P1, P3         | P2, P4, P5 | Verde |

Las 4 corridas fueron una pasada de revisión standalone sobre todo el
catálogo existente (pedida explícitamente por el usuario, fuera de la
cadena `/spec-impl-game`), lanzadas en paralelo una instancia por juego.
Ninguna hizo commit — los diffs quedaron para revisión humana y se
consolidaron manualmente en la rama `chore/game-performance-booster-review`.

## Detalle por juego

### `asteroids` (corrida 2026-07-23, standalone, fuera de la cadena `/spec-impl-game`)

Archivo tocado: `lib/games/asteroids/game.ts` (único).

- **P1 — aplicado.** `setPaused(false)` re-agendaba `requestAnimationFrame`
  sin cancelar el `rafId` previo (a diferencia de `init()` de Caída, que sí
  tiene la guarda). En el flujo normal el loop ya está "muerto" cuando se
  pausa (el propio `loop()` corta con `if (this.paused) return;` sin
  reagendarse), así que hoy no se observa doble loop — pero el camino
  quedaba sin la guarda defensiva que exige el patrón. Se agregó
  `cancelAnimationFrame(this.rafId)` justo antes de
  `this.rafId = requestAnimationFrame(this.loop)` en `setPaused`.
  Equivalencia: con como máximo un frame vivo en todo momento (que es el
  comportamiento actual observado), cancelar uno inexistente/ya disparado es
  un no-op — el juego de un solo loop queda idéntico; solo se blinda contra
  el estado patológico de doble loop si `setPaused(false)` se llegara a
  invocar dos veces sin pausa intermedia.

- **P2 — aplicado.** En `update()`, `this.bullets` se filtraba **dos veces**
  en el mismo frame: una vez tras `update(dt)` (poda por TTL) y otra vez tras
  el doble bucle de colisión bullets×asteroids (poda por impacto). Además
  `asteroids`/`particles`/`powerUps` usaban `filter()`/`filter().concat()`,
  alocando un array nuevo cada frame. Se agregó un helper
  `compactDead<T extends { dead: boolean }>(arr: T[]): void` que compacta
  in-place por índice de escritura (preserva orden) y se reemplazaron los
  `filter()` de las 3 ramas de estado (`playing`, `dead`, `gameover`) por
  llamadas a este helper; el filtrado intermedio de `bullets` (poda por TTL)
  se eliminó porque el bucle de colisión ya excluye balas con `b.dead` true
  vía el chequeo `!b.dead` — el compactado final (que corre después del
  bucle de colisión) captura ambas causas de muerte (TTL y colisión) en un
  solo pase. Equivalencia: mismo conjunto de sobrevivientes (una bala/
  asteroide/partícula/power-up sigue vivo en el array final si y solo si
  `dead === false` al terminar el frame, exactamente igual que antes) y mismo
  orden relativo (compactación por índice preserva el orden de aparición);
  el orden no afecta el render (cada entidad se dibuja independientemente,
  sin z-order dependiente de posición en el array) ni la lógica de colisión
  (recorre todos los pares, no depende de índice). `asteroids.concat(new
Asteroids)` se reemplazó por `compactDead` + `push(...newAsteroids)`
  (mismo orden: sobrevivientes primero, nuevos al final, igual que
  `filter().concat()`).

- **P3 — aplicado.** `Particle.draw()` armaba
  `` `rgba(${pal.fgRgb}, ${alpha.toFixed(2)})` `` por partícula y por frame,
  con `alpha` variando continuamente en `(0, 1]` según `ttl/life`. Se
  agregó una tabla `particleAlpha: string[]` de 101 entradas (bucket
  `0..100`, un paso por centésima) precomputada una vez en el constructor y
  en `setSkin()` (junto al resto de `RenderPalette`, mismo lugar que ya
  cachea `fgRgb` vía `rgbTriplet`), y `Particle.draw()` ahora indexa
  `pal.particleAlpha[Math.round(alpha * 100)]` en vez de construir el
  string. Equivalencia: el bucket de cuantización (pasos de 0.01) es
  idéntico a la precisión que ya usaba `alpha.toFixed(2)` — la cadena
  emitida es **exactamente la misma** para cada valor de `alpha`, no solo
  "visualmente indistinguible"; solo se elimina la alocación de template
  string y el `toFixed()` por partícula por frame.

- **P4 — aplicado (geometría local del asteroide, no hay grid/fondo fijo en
  este juego).** Este engine no tiene rejilla ni chrome de tablero (el
  "fondo" es un único `fillRect` con el color de la skin, ya lo más barato
  posible). Sí aparece el mismo espíritu de P4 en `Asteroid.draw()`: los
  vértices del wireframe (`this.verts`, 8–13 puntos generados una vez en el
  constructor y nunca reasignados) se re-emitían como `moveTo` + N×`lineTo`
  - `closePath()` **cada frame por cada asteroide vivo** (hasta ~20–30
    simultáneos tras varios splits) — la única parte que cambia por frame es
    el `ctx.translate`/`ctx.rotate` (posición/rotación), no los puntos
    locales. Se cacheó un `Path2D` (`this.path`) construido una vez en el
    constructor a partir de `verts` (mismo `moveTo`/`lineTo`/`closePath`,
    mismo orden de vértices) y `draw()` ahora hace `ctx.stroke(this.path)` en
    vez de re-teselar el contorno. Equivalencia: mismos puntos, mismo orden,
    mismo `closePath`, mismo `strokeStyle`/`lineWidth`/`lineJoin` y misma
    transformación (`translate`+`rotate` se siguen aplicando por frame antes
    del `stroke`) → píxeles idénticos. **No** se aplicó a `Ship` (triángulo de
    4 puntos, una sola instancia en juego, ya trivial de re-emitir) ni a la
    llama del propulsor de `Ship` (su longitud usa `rand(6, 14)` por frame,
    así que el path cambia cada vez y no es cacheable sin alterar el consumo
    de `Math.random`).

- **P5 — N/A.** El engine no usa `Audio`/`new Audio()`/`cloneNode()` en
  ningún punto (grep confirmado, cero coincidencias) — no hay sonido en
  este motor, nada que poolear.

Build: `npm run build` verde tras cada patrón (P1→P2→P3→P4, uno a la vez).
Smoke: Playwright en `/games/asteroids`, cero errores nuevos de consola,
`ArrowUp`/`ArrowLeft`/`Space` siguen respondiendo (nave gira/acelera, dispara),
screenshot post-refactor cualitativamente idéntico al base.

### `caida` (corrida 2026-07-23, standalone, fuera de la cadena `/spec-impl-game`)

Archivo tocado: `lib/games/caida/game.ts` (único).

| Patrón | ¿Aparece?                                                                                                                                                                                  | ¿Vale la pena?                                                                                                                                                     | Veredicto    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| P1     | `init()` ya tenía la guarda correcta (`cancelAnimationFrame` antes de re-agendar). `setPaused(false)` **no** — re-agendaba sin cancelar primero.                                           | Sí — si `setPaused(false)` se llama dos veces sin pausa intermedia, corren dos loops en paralelo (doble update+draw) y `destroy()` solo cancela el último `rafId`. | **Aplicado** |
| P2     | No hay arrays de vida corta. `board` es una matriz fija `ROWS×COLS`; `clearLines()` usa `splice`/`unshift` sobre esa matriz fija, solo ante un evento raro (línea completa), no por frame. | No aplica: no hay `filter()`/`concat()` por frame en todo el archivo (confirmado por grep).                                                                        | **N/A**      |
| P3     | Los colores de bloque ya vienen precalculados como strings fijos desde la skin (constructor/`setSkin`); no hay ningún template literal `rgba(...)` compuesto por entidad y por frame.      | No aplica: no hay construcción de string en el frame, solo lookup de un array ya cacheado.                                                                         | **N/A**      |
| P4     | `drawGrid()` reemite 28 líneas (`COLS-1 + ROWS-1`) vía `beginPath`/`moveTo`/`lineTo`/`stroke` individuales **cada frame**, aunque la geometría de la rejilla nunca cambia.                 | Sí — geometría 100% estática, candidato directo de P4.                                                                                                             | **Aplicado** |
| P5     | No hay ningún `Audio`/sonido en este engine (confirmado por grep, cero matches).                                                                                                           | No aplica: no hay nada que poolear.                                                                                                                                | **N/A**      |

- **P1 — aplicado.** `cancelAnimationFrame(this.rafId)` inmediatamente antes
  de `this.rafId = requestAnimationFrame(this.loop)` en la rama `!paused`
  de `setPaused`, igual al guard que ya tenía `init()`. Equivalencia: el
  juego de un solo loop vivo queda idéntico; si `setPaused(false)` se
  invocara dos veces seguidas sin pausa intermedia, ahora solo queda un
  `rafId` vivo en vez de dos loops paralelos duplicando update+draw.
- **P4 — aplicado.** Campo `private readonly gridPath: Path2D`, construido
  una sola vez en el constructor con las mismas 28 subrutas
  `moveTo`/`lineTo` que antes se emitían cada frame en `drawGrid()`.
  `drawGrid()` ahora fija `strokeStyle`/`lineWidth` una vez y llama
  `this.ctx.stroke(this.gridPath)` una sola vez. Equivalencia: mismas
  coordenadas exactas por subruta; sin relleno ni solape con cap/join
  distinto de "butt" → píxeles idénticos. La geometría no depende de la
  skin (solo el color, dinámico vía `this.gridLine`), así que no hace falta
  reconstruir el `Path2D` al cambiar de skin.
- **P2, P3, P5** — no aplicados (no hay patrón real que corregir).

Verificación: `npm run build` verde. Smoke con Playwright en `/games/caida`:
canvas monta con tamaño > 0, cero errores nuevos en consola, flechas/rotación
y pausa/reanudación (tecla P) siguen respondiendo, screenshot post-refactor
cualitativamente idéntico a la base.

### `bloque-buster` (corrida 2026-07-23, standalone, fuera de la cadena `/spec-impl-game`)

Archivo tocado: `lib/games/bloque-buster/game.ts` (único).

- **P1 — aplicado.** `setPaused(false)` re-agendaba `requestAnimationFrame`
  sin cancelar el `rafId` anterior. Se agregó
  `cancelAnimationFrame(this.rafId)` justo antes de re-agendar. Equivalencia:
  en el camino normal el `rafId` previo ya identifica un loop muerto o
  expirado, cancelarlo es un no-op inofensivo; el guard solo elimina el
  estado patológico de doble loop en paralelo.
- **P2 — aplicado.** La poda de `this.explosions` usaba
  `this.explosions = this.explosions.filter(...)` cada frame, incluso vacío.
  Reemplazado por compactación in-place con índice de escritura +
  `this.explosions.length = writeIdx`. Equivalencia: mismo conjunto de
  sobrevivientes, mismo orden, sin alocación de array nueva por frame.
- **P3 — aplicado.** `drawOverlay()` reconstruía
  `` `rgba(${this.bgRgb}, 0.6)` `` en cada llamada (el loop sigue vivo tras
  game over/win, dibujando el overlay indefinidamente). Se agregó el campo
  cacheado `overlayFill`, calculado en el constructor y recalculado en
  `setSkin()`. Equivalencia: la cadena de color emitida es exactamente la
  misma en cada frame. (Evaluado y descartado: `'block_' + block.color` en
  `draw()` no es una construcción de color/estilo sino una clave de lookup
  de sprite — fuera de alcance de P3.)
- **P4 — N/A.** No hay geometría estática re-teselada por líneas/`stroke`
  individuales por frame; el fondo es un solo `fillRect` y los sprites ya
  vienen de un canvas offscreen pre-decodificado (`ssImg`).
- **P5 — aplicado.** `playSound()` hacía `audio.cloneNode()` por cada
  evento de rebote/rotura. Se agregó una clase `AudioPool` (round-robin de
  4 `HTMLAudioElement` pre-alocados por sonido) reemplazando
  `bounceSound`/`breakSound`. Equivalencia: mismo clip audible en cada
  evento; el pool de 4 nodos cubre con margen el peor caso observado
  (≤3 disparos simultáneos por frame).

Verificación: `npm run build` verde tras cada patrón (4 builds). Smoke con
Playwright en `/games/bloque-buster`: canvas monta, cero errores nuevos en
consola, pausa/reanudación funciona, una partida completa llegó a game over
de forma natural (overlay cacheado visible tras el modal), bloques/sprites
visualmente idénticos a la base.

### `serpentina` (corrida 2026-07-23, standalone, fuera de la cadena `/spec-impl-game`)

Archivo tocado: `lib/games/serpentina/game.ts` (único).

| Patrón | ¿Aparece?                                                                                                                                | ¿Vale la pena?                                                 | Veredicto    |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------ |
| P1     | Sí — `setPaused(false)` reagenda `requestAnimationFrame` sin cancelar el `rafId` previo primero.                                         | Sí — mismo riesgo de doble loop que ya se corrigió en Caída.   | **Aplicado** |
| P2     | No — no hay arrays de vida corta podados por frame; la serpiente se muta con `unshift`/`pop` por tick (ya in-place).                     | N/A                                                            | **N/A**      |
| P3     | Sí — `draw()` arma `` `rgba(${this.foodRgb}, ${pulse.toFixed(2)})` `` (template string nuevo) en cada frame para el pulso de la comida.  | Sí — se repite 1x por frame, siempre, mientras el juego corre. | **Aplicado** |
| P4     | No — no hay rejilla ni fondo fijo re-teselado por frame; el fondo es un único `fillRect` (ya barato) y no hay `stroke`/`lineTo` en loop. | N/A                                                            | **N/A**      |
| P5     | No — el engine no reproduce ningún sonido (`grep Audio` sin resultados).                                                                 | N/A                                                            | **N/A**      |

- **P1 — aplicado.** En `setPaused(false)` y en el arranque inicial del
  constructor, se antepone `cancelAnimationFrame(this.rafId)` justo antes de
  `this.rafId = requestAnimationFrame(this.loop)`, calcando el patrón de
  `init()` de Caída. Equivalencia: el juego real de un solo loop sigue
  produciendo exactamente un `rafId` vivo; solo cambia el estado patológico
  de doble invocación sin pausa intermedia.
- **P3 — aplicado.** Caché `foodAlphaCache: string[]` de 101 entradas
  (precalculadas en el constructor y en `setSkin`). En `draw()`, el pulso se
  redondea a un índice `0..100` y se usa como lookup directo en vez de
  reconstruir el string con template literal + `toFixed(2)` cada frame.
  Equivalencia: `toFixed(2)` ya cuantizaba el alpha a pasos de 0.01 antes del
  cambio — la caché reproduce exactamente esos mismos strings, indexados por
  el mismo redondeo.
- **P2, P4, P5 — N/A.** Único array de entidades (`this.snake`) mutado
  in-place, sin balas/partículas/power-ups; sin rejilla ni geometría
  estática repetida; sin sonido en el engine.

Build: `npm run build` verde tras cada edición. Smoke: Playwright en
`/games/serpentina` — cero errores nuevos de consola, teclas de flecha
responden, screenshot post-cambio cualitativamente idéntico al base.

## Relacionado

- `references/game-skins.md` — documento equivalente para `@skin-designer`.
- `references/mobile-porter-todo.md` — documento equivalente para
  `@mobile-porter`.
