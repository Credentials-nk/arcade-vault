# Mobile Porter — pendiente de layout táctil consistente

> Memoria viva del subagente **`@mobile-porter`** (`.claude/agents/mobile-porter.md`,
> creado 2026-07-22). Mismo patrón que `references/game-skins.md` para
> `@skin-designer`: el agente lee este documento al arrancar cada corrida y
> registra acá el criterio unificado y el estado de la tarea. La tarea de
> abajo sigue **pendiente** hasta que una corrida del agente la resuelva y el
> usuario la valide en un dispositivo real.

## El problema (reportado por el usuario, 2026-07-22)

El layout de **desktop** es consistente en los 4 juegos: lo único que cambia
de uno a otro es el contenido del `<canvas>`, el resto del HUD/CRT se ve
siempre igual. Correcto, no tocar.

El layout **móvil/táctil** (gamepad + tamaño del display) **no** es
consistente entre juegos. Según el usuario, la distribución correcta —la
única que hay que tomar como referencia/base— es la de **Asteroids**:
ahí se hizo bien tanto el display del juego como el gamepad y los
botones. Los otros tres (**Caída**, **Serpentina**, **Bloque Buster**)
**no** son la base — se desviaron al cablearlos y hay que alinearlos a
Asteroids, no al revés. En algunos el display queda más chico, en otros
más grande, sin un criterio compartido.

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
juegos, usando **únicamente Asteroids** como referencia de la
distribución correcta (display, gamepad y botones). Caída, Serpentina y
Bloque Buster deben alinearse a ese patrón, no al revés. Confirmar con
el usuario en un dispositivo real antes de fijar los números definitivos
(el entorno de desarrollo de este repo no permite emular fielmente un
viewport móvil real — ver notas de `specs/11-controles-tactiles.md`).

## Criterio unificado: EL SHELL (fijado en corrida 2, 2026-07-22)

Tras el feedback del usuario a la corrida 1 ("para todos tiene que ser
igual, lo único que cambia es el contenido del display"), el criterio dejó
de ser "números aplicados página por página" y pasó a ser **un shell
inamovible materializado como componente compartido**.

### El componente: `components/games/TouchPlayerShell.tsx`

Las 4 páginas lo consumen cuando `isTouch` (Asteroids incluida — Asteroids
ES el shell: su render táctil quedó pixel-idéntico al previo). Estructura
fija, sin ningún knob de layout por juego:

1. **Caja del display**: `.crt crt-800` → `.crt-screen` (borderRadius 0),
   con el pause-overlay y — si el mapeo es `drag` — el overlay de arrastre
   DENTRO de la caja; bisel `.crt-bottom` («SEÑAL OK · {título} · CRT-83 ·
   60 HZ · CARGA · 1MB»).
2. **Gamepad** (`TouchControls`) como hermano debajo de la caja, anclado al
   pie por `.av-player-touch .touch-controls` (`margin-top: auto`).
3. **Fila inferior** PAUSA / selector de modo / SALIR
   (`.touch-hud-actions`). Con mapeo `drag` no hay gamepad en flujo y esta
   fila toma el ancla al pie (`.touch-hud-actions-footer`).

**Las DOS únicas variaciones por juego** (props del shell):

- `children` = el contenido del display (lo que se renderea adentro de la
  caja), y
- `touch` = el mapeo de la botonera (`Omit<TouchControlsProps, 'hidden'>`:
  botones activos vs `muted`; gamepad vs `drag`). `hidden` lo gobierna el
  shell con `gameOver`.
- (`title` es solo el texto del bisel — no mueve nada.)

Si una página "necesita algo especial" en el shell, o es un cambio AL shell
(para todos por igual) o va adentro del display — nunca un caso especial de
esa página.

### Los números del shell (heredados de Asteroids)

- **Display: `340px` de alto**, ancho completo del contenedor (`crt-800`;
  en 360vw quedan 352px útiles: 360 − 2px de `.av-player.av-player-touch`
  − 6px de `.av-player-touch .crt`). Cada componente de juego acepta
  `heightPx?: number`; la página pasa `340` dentro del shell y nada en
  desktop.
- Presupuesto vertical (360×740, Nav oculto): 35 (padding-top) + 346 (caja)
  - ~26 (bisel) + 152 (gamepad) + ~70 (fila inferior) ≈ 630px < 740 → sin
    scroll, holgura absorbida por el `margin-top: auto` del bloque de pie.

### Cómo adapta cada juego su contenido ADENTRO de la caja

- **asteroids**: canvas 800×600 estirado a `width:100%` × 340px (dibuja
  SCORE/NIVEL/vidas él mismo). Referencia intacta.
- **bloque-buster**: mismo canvas 800×600, mismo estiramiento → densidad
  idéntica a la referencia. Dibuja Score/Nivel/vidas él mismo. Mapeo
  `drag`.
- **serpentina**: canvas 600×600 estirado a `width:100%` × 340 (compresión
  ~3%, imperceptible) + franja `.touch-screen-stats` superpuesta arriba
  DENTRO de la caja (PUNTOS/NIVEL — su canvas no los dibuja; espeja el HUD
  que asteroids dibuja en el suyo). Gamepad con A/B `muted` (paridad de
  silueta).
- **caida**: tablero 300×600 (1:2) dimensionado POR ALTURA —
  `height: 340px` + `width: auto` → 170px sin distorsión (estirarlo a lo
  ancho sería >100% de distorsión) — con el panel «SIGUIENTE» (120×120) al
  costado sin wrap (170 + 16 + 120 = 306px ≤ ancho útil) y las stats
  (puntos/líneas/nivel) en la columna del panel vía prop `panelExtra` de
  `CaidaGame` + `.touch-panel-stats`. Todo dentro de la caja. El
  `flexWrap: 'wrap'` paliativo quedó solo en la rama desktop del
  componente (sin `heightPx`), que es byte a byte la original.

### Notas de implementación

- El shell se monta con `isTouch ? <TouchPlayerShell…> : <markup desktop
original>` en cada página: el desktop quedó intacto por construcción
  (misma estructura JSX que antes en la rama `!isTouch`). Efecto colateral
  aceptado: si `pointer: coarse` cambiara EN VIVO (caso borde de
  laboratorio, no de teléfono), el canvas se remonta y la partida
  reinicia — antes el `.crt` era compartido entre ambos modos y no se
  remontaba.
- CSS del shell/contenido en `app/globals.css`: `.touch-screen-stats`,
  `.touch-panel-stats`, `.av-player-touch .touch-hud-actions-footer` (+ el
  bloque táctil preexistente del spec 11). La fila exterior `.touch-stats`
  de la corrida 1 se eliminó: violaba el principio (markup fuera de la
  caja que solo algunas páginas montaban).

### Estado

- **Corrida 1 (2026-07-22): descartada por feedback del usuario** ("se ve
  mal") — alineaba números pero dejaba que cada página armara su propia
  variante del layout (filas de stats exteriores en caida/serpentina).
- **Corrida 2 (2026-07-22): implementado el shell, pendiente de validación
  en dispositivo real.** `TouchPlayerShell` consumido por las 4 páginas;
  `npm run build` verde; screenshots orientativos en
  `.playwright-screenshots/` a 360×740 y 390×844 (las 4 capturas deben
  verse idénticas salvo el contenido del display). Si lo que se ve en el
  teléfono no coincide, ajustar los números de arriba y re-correr el
  agente.

## Relacionado

- `specs/11-controles-tactiles.md` — spec original de controles táctiles
  (gamepad/drag), ya implementado en los 4 juegos.
- `references/game-skins.md` — documento equivalente para `@skin-designer`.
