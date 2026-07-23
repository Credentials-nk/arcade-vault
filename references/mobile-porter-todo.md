# Mobile Porter — pendiente de layout táctil consistente

> Documento de arranque para un futuro subagente `@mobile-porter` (todavía no
> creado — no crear `.claude/agents/mobile-porter.md` hasta que se pida
> explícitamente). Mismo patrón que `references/game-skins.md` para
> `@skin-designer`: una tarea puntual queda anotada acá hasta que el agente
> exista y la retome.

## El problema (reportado por el usuario, 2026-07-22)

El layout de **desktop** es consistente en los 4 juegos: lo único que cambia
de uno a otro es el contenido del `<canvas>`, el resto del HUD/CRT se ve
siempre igual. Correcto, no tocar.

El layout **móvil/táctil** (gamepad + tamaño del display) **no** es
consistente entre juegos. Según el usuario, la distribución correcta —la
que hay que tomar como referencia— es la de **Asteroids** y **Serpentina**.
Los otros dos (**Caída**, **Bloque Buster**) se desvían: en algunos el
display queda más chico, en otros más grande, sin un criterio compartido.

El usuario pidió explícitamente **no corregir esto ahora** — quedó para
cuando exista el agente `@mobile-porter`.

## Puntos a revisar (no diagnosticado a fondo, solo observaciones de código)

- `components/games/asteroids/AsteroidsGame.tsx` acepta un prop `heightPx`
  (se le pasa `340` en touch, `undefined` en desktop) para estirar el canvas
  más allá de su 4:3 natural — ver commit `85dd5cd` ("stretch asteroids
  canvas past 4:3 for density, anchor gamepad to footer"). Ninguno de los
  otros tres componentes (`CaidaGame.tsx`, `SerpentinaGame.tsx`,
  `BloqueBusterGame.tsx`) tiene un prop equivalente.
- `.av-player-touch .crt-screen { aspect-ratio: auto; }` (en
  `app/globals.css`) es una regla global que aplica a los 4 juegos por
  igual; sin un `heightPx` explícito, el tamaño resultante del
  `crt-screen` depende de la proporción nativa de cada canvas — que es
  distinta en cada juego:
  - asteroids: 800×600 (4:3), con `heightPx=340` en touch.
  - caida: tablero 300×600 + panel «SIGUIENTE» 120×120 al lado (flex).
  - serpentina: 600×600 (1:1).
  - bloque-buster: 800×600 (4:3), sin override de altura.
- Caída además compite por ancho entre el tablero y el panel «SIGUIENTE»
  en pantallas angostas (se agregó `flexWrap: 'wrap'` como paliativo en
  `components/games/caida/CaidaGame.tsx`, pero no resuelve el criterio de
  tamaño general).

## Tarea para `@mobile-porter`

Unificar el criterio de tamaño/densidad del canvas en modo táctil en los 4
juegos, usando **Asteroids + Serpentina** como referencia de la
distribución correcta. Confirmar con el usuario en un dispositivo real
antes de fijar los números definitivos (el entorno de desarrollo de este
repo no permite emular fielmente un viewport móvil real — ver notas de
`specs/11-controles-tactiles.md`).

## Relacionado

- `specs/11-controles-tactiles.md` — spec original de controles táctiles
  (gamepad/drag), ya implementado en los 4 juegos.
- `references/game-skins.md` — documento equivalente para `@skin-designer`.
