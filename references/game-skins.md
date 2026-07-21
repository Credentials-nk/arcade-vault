# Skins de Arcade Vault — asignación por juego

Fuente de verdad de qué skin usa cada juego y por qué. Mantenida por el subagente
`@skin-designer`. El sistema tipado vive en `lib/skins.ts` (interfaz `Skin`,
constantes `NEON`/`CLASICO`/`RETRO`, mapa `GAME_SKINS`, helper `getSkin(id)`).

Los 3 skins operan siempre sobre el fondo oscuro fijo de la app (`--bg: #0a0a0f`
en `app/globals.css`); ninguno es un tema claro.

## Los 3 skins canónicos

| Skin      | Identidad                                                                                         | Notas                                                                                |
| --------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `neon`    | Estética actual de la plataforma: colores saturados (verde/magenta/cian/amarillo), glow intenso.  | Es el punto de partida; `[data-skin='neon']` en `globals.css` es idéntico a `:root`. |
| `clasico` | Arcade sobrio: colores planos y apagados, glow mínimo, legibilidad ante todo.                     | Nuevo default conceptual de la plataforma.                                           |
| `retro`   | CRT monocromo: un único tinte de fósforo ámbar (`#ffb000`) sobre negro, con scanlines reforzadas. | Sin multicolor; pensado para wireframes/vectores.                                    |

Los valores exactos de cada paleta (canvas) están en `lib/skins.ts`; los del
chrome (HUD/botones/CRT/modal) en los bloques `[data-skin]` de `app/globals.css`.

## Tabla de asignación

| ID              | Juego         | Skin      | Razón                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------- | ------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `asteroids`     | ASTEROIDS     | `retro`   | Wireframe vectorial (nave/asteroides trazados con `stroke`) encaja naturalmente con el fósforo monocromo CRT; sin sprites ni relleno de color que perder.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `caida`         | CAÍDA         | `clasico` | Tetris se apoya en 8 colores de pieza (`pieces`) para que el jugador distinga formas al instante; el arcade sobrio mantiene esa distinción sin el glow saturado de neon, priorizando legibilidad.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `serpentina`    | SERPENTINA    | `neon`    | Snake clásico: cuerpo verde saturado sobre negro puro es la identidad original del juego (`SNAKE_COLOR`); neon la preserva tal cual.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `bloque-buster` | BLOQUE BUSTER | `neon`    | El engine **no pinta con `fillStyle`**: bloques, paddle y pelota vienen de un spritesheet PNG (`/games/bloque-buster/spritesheet-breakout.png`) indexado por nombre de color (`red`/`cyan`/`magenta`/…), no por hex de la skin. Reskinarlo a `retro` monocromo exigiría re-tintar sprites (canvas offscreen + `globalCompositeOperation`) — alto costo, bajo beneficio para un solo juego. Se asigna `neon` (bajo impacto): solo se parametrizaron el fondo del canvas (`bg`) y el texto de HUD/overlay (`text`) que sí se dibujaban con `fillStyle` literal; el spritesheet queda intacto. Resultado: visualmente ~idéntico al estado previo a este sistema de skins. |

## Detalle de implementación por juego

- **`asteroids`** — `lib/games/asteroids/game.ts` recibe `skin: Skin` en el
  constructor y arma una `RenderPalette` (`bg`, `fg` ← `primary`, `fgRgb`,
  `accent`, `flame`) usada en nave, asteroides, partículas, HUD y power-ups.
- **`caida`** — `lib/games/caida/game.ts` recibe `skin: Skin`; usa
  `skin.pieces` (8 colores indexados 1–8), `skin.line` (rejilla) y
  `skin.highlight` (brillo superior de bloque). No dibuja overlay de texto en
  canvas (el HUD y el modal de game over son React puro).
- **`serpentina`** — `lib/games/serpentina/game.ts` recibe `skin: Skin`; usa
  `skin.bg`, `skin.primary` (cuerpo) y `skin.accent` (comida, con pulso de
  alpha vía `rgbTriplet`).
- **`bloque-buster`** — `lib/games/bloque-buster/game.ts` recibe `skin: Skin`;
  usa únicamente `skin.bg` (fondo del canvas + rgba del scrim de overlay vía
  `rgbTriplet`) y `skin.text` (HUD de score/nivel y mensaje de fin de juego).
  Bloques, paddle, pelota y explosiones siguen viniendo 100% del spritesheet.

## Campo `text` en `Skin`

Se agregó `text: string` a la interfaz `Skin` (no existía en la corrida
anterior) porque Bloque Buster es el único de los 4 engines que dibuja texto de
HUD/overlay directo en el canvas con un `fillStyle` de color neutro (blanco),
sin mapear naturalmente a `primary`/`accent` de los otros juegos. Valores:

| Skin      | `text`    | Nota                                                                                   |
| --------- | --------- | -------------------------------------------------------------------------------------- |
| `neon`    | `#e6e9ff` | Igual al `--ink` de `:root` — perceptualmente blanco, preserva el look actual.         |
| `clasico` | `#e6e9ff` | El chrome `[data-skin='clasico']` no sobrescribe `--ink`, así que coincide con `neon`. |
| `retro`   | `#ffd591` | Coincide con el `--ink` que sí sobrescribe `[data-skin='retro']` en `globals.css`.     |

## Cómo se aplica el chrome

Cada página `app/games/<id>/page.tsx` pone `data-skin={GAME_SKINS['<id>']}` en
el contenedor raíz (`.av-player`). Los bloques `[data-skin='neon'|'clasico'|'retro']`
en `app/globals.css` sobrescriben `--cyan/--magenta/--yellow/--green` (+ sus
`-glow` en rgb triplet) y `--line`; `retro` además ajusta `--ink` y refuerza las
scanlines del marco CRT (`.crt-screen`). El HUD, los botones (`.btn`) y el
modal ya derivan de esas variables, así que reskinan solos.

## Actualizar este documento

En cada corrida del subagente `@skin-designer`: si se agrega un juego nuevo,
sumar una fila a la tabla de asignación con su razón; si se ajustan valores de
paleta, reflejarlos aquí solo si cambian la asignación o el razonamiento (los
valores exactos viven en `lib/skins.ts`, no se duplican letra por letra salvo
para casos especiales como `text` arriba).
