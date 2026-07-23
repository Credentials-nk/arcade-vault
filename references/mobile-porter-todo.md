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
   con el pause-overlay y — si `dragOverlay` — el overlay de arrastre real
   DENTRO de la caja; bisel `.crt-bottom` («SEÑAL OK · {título} · CRT-83 ·
   60 HZ · CARGA · 1MB»).
2. **Panel Gamepad MK-II** (`.touch-gamepad`, **UNA sola pieza visual**,
   corrida 3): cruceta + A/B arriba (`TouchControls`) y la fila PAUSA /
   selector de modo / SALIR integrada como **sección inferior del mismo
   panel** (`.touch-gamepad-footer`, separada por un divisor sutil) — no un
   bloque suelto debajo. Todo el panel se ancla al pie con
   `.av-player-touch .touch-gamepad { margin-top: auto }` y se oculta
   entero cuando `gameOver`.

**Las DOS únicas variaciones por juego** (props del shell):

- `children` = el contenido del display (lo que se renderea adentro de la
  caja), y
- `touch` = el mapeo de la botonera del panel (`Omit<TouchControlsProps,
'hidden' | 'drag'>`: botones activos vs `muted`). Nunca incluye `drag`.
- `dragOverlay?: boolean` = monta ADEMÁS el overlay de arrastre real dentro
  de la caja (bloque-buster); el panel se muestra igual, con `touch`
  decorativo (ver `DRAG_DECORATIVE_PAD`, exportado desde
  `TouchPlayerShell.tsx`).
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
  idéntica a la referencia. Dibuja Score/Nivel/vidas él mismo. `dragOverlay`
  (el panel se muestra igual que en los otros 3, decorativo — ver corrida 3).
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
  `.touch-panel-stats` (+ el gamepad MK-II, ver más abajo). La fila
  exterior `.touch-stats` de la corrida 1 se eliminó: violaba el principio
  (markup fuera de la caja que solo algunas páginas montaban). La clase
  `.touch-hud-actions-footer` de la corrida 2 también se eliminó en la
  corrida 3: dejó de hacer falta al fusionarse la fila de botones dentro
  del panel único (ver abajo).

## Gamepad MK-II (fijado en corrida 3, 2026-07-22)

Feedback del usuario tras validar el shell de la corrida 2 en su teléfono:
el shell (tamaños/posiciones) estaba bien, pero pidió restylear el gamepad
con un diseño de referencia — **material en `references/gamepad-assets/`**
(`gamepad.html` con el CSS completo, `gamepad-neon.png`, y sobre todo
`mobile-layout-target.png`: captura real del teléfono del usuario con la
distribución objetivo — **un único panel redondeado** que integra cruceta +
A/B y la fila PAUSA/selector/SALIR como sección inferior del mismo panel).
Mandato textual: **"poner ese gamepad en los 4"**, Bloque Buster incluido.

### Qué cambió

- **`.touch-gamepad`** (nuevo, en `app/globals.css`): el panel único —
  fondo degradado + borde neón + textura de puntos + doble borde interior,
  portado 1:1 de `.gp` en `gamepad.html`. Mismo `max-width: 848px` que
  `.crt-800` para que ambas piezas midan igual. Es el elemento que ahora se
  ancla al pie (`.av-player-touch .touch-gamepad { margin-top: auto }`,
  reemplaza al `.touch-controls` de la corrida 2).
- **Cruceta**: reposicionada en absoluto (antes CSS grid) con hub central y
  gema LED pulsante (`.touch-dpad-hub`/`.touch-dpad-gem`), flechas SVG
  (`.touch-dpad-arrow`, triángulos calcados del HTML) en vez de glifos de
  texto. Efecto de pulsación 3D (`translateY` + glow) en `:active` — no se
  agregó una clase `.on` con JS nuevo: el `:active` nativo alcanza porque
  `setPointerCapture` (spec 11, sin tocar) mantiene el estado presionado.
- **A/B**: círculos con gradiente radial + anillo punteado que aparece al
  presionar (`.touch-action-ring`), letra pixel grande
  (`.touch-action-letter`) y **caption opcional** debajo
  (`.touch-action-caption`, texto chico con la acción real — ver decisión
  de Caída).
- **Fila PAUSA/MODO/SALIR**: pasó de bloque suelto (`.touch-hud-actions`)
  a **sección inferior integrada del mismo panel** (`.touch-gamepad-footer`,
  con separador sutil `border-top`), calcando
  `mobile-layout-target.png`. Ya no existe un caso especial para
  bloque-buster (antes `.touch-hud-actions-footer` la anclaba aparte
  cuando no había gamepad en flujo) — ahora el panel entero siempre se
  ancla igual, con o sin `dragOverlay`.
- **Colores desde variables**: todo el CSS portado usa
  `var(--cyan)`/`var(--magenta)`/`var(--yellow)` y sus `*-glow` (en rgb,
  para `rgba(var(--x-glow), a)`) en vez de los hex hardcodeados del HTML de
  referencia (`#00f5ff`/`#ff006e`). Como cada `[data-skin]` ya sobrescribe
  esas variables (retro → ámbar monocromo, clásico → sobrio, neon →
  actual), el panel hereda la skin fija de cada juego sin código adicional.
  Verificado en captura: asteroids (retro) sale todo ámbar, serpentina
  (neon) sale cian/magenta, caida (clásico) sale apagado.
- **Fuentes**: ninguna importación nueva — el HTML de referencia usa
  Google Fonts (`Press Start 2P`, `JetBrains Mono`) que la app ya trae via
  `var(--pixel)`/`var(--mono)`; se reusaron esas variables tal cual.
- **Bloque Buster ahora SIEMPRE muestra el panel completo** (antes tenía un
  hueco vacío entre display y fila de botones): `touch` recibe
  `DRAG_DECORATIVE_PAD` (cruceta + A/B `muted`, cero dispatch) y
  `dragOverlay` monta ADEMÁS el overlay de arrastre real dentro de la caja
  — dos mecanismos separados y explícitos en `TouchPlayerShellProps`
  (antes, en la corrida 2, un solo `touch.drag` decidía ambas cosas a la
  vez, lo cual ya no alcanzaba porque ahora el panel decorativo y el
  overlay real conviven).
- **Caída — decisión de etiquetas**: se optó por **A/B + caption** en vez
  de mantener `ROTAR`/`SOLTAR` como label principal, para no romper la
  uniformidad del panel (el diseño MK-II usa letra pixel grande, no texto
  largo) — `{ label: 'B', caption: 'ROTAR', ... }` /
  `{ label: 'A', caption: 'SOLTAR', ... }`, mismo orden/color que las demás
  (B=azul=secundaria, A=roja=principal). El caption es texto chico
  (`.touch-action-caption`, 7px) debajo del círculo; no altera tamaño ni
  posición del botón, solo agrega una etiqueta descriptiva para que un
  jugador nuevo no tenga que adivinar qué hace A/B en este juego en
  particular. Verificado por screenshot: cabe sin recortarse contra el
  divisor de la fila inferior.
- Media query de pantallas angostas (`@media (max-width: 380px)`, antes
  480px) reescrita con los offsets absolutos nuevos (antes usaba
  `grid-template-columns`, ya no aplica con posicionamiento absoluto).

### Estado

- **Corrida 1 (2026-07-22): descartada por feedback del usuario** ("se ve
  mal") — alineaba números pero dejaba que cada página armara su propia
  variante del layout (filas de stats exteriores en caida/serpentina).
- **Corrida 2 (2026-07-22): shell validado en dispositivo real por el
  usuario.** `TouchPlayerShell` (tamaños/posiciones) quedó fijo como base.
- **Corrida 3 (2026-07-22): gamepad MK-II implementado, pendiente de
  validación en dispositivo real.** CSS portado de
  `references/gamepad-assets/gamepad.html` a `.touch-gamepad`/`.touch-dpad*`
  /`.touch-action*`/`.touch-gamepad-footer` en `app/globals.css`, con
  colores desde variables de skin; panel único en los 4 juegos (bloque-buster
  incluido, decorativo + `dragOverlay`); Caída con A/B + caption. `npm run
build` verde; screenshots en `.playwright-screenshots/` a 360×740 y
  390×844. Si lo que se ve en el teléfono no coincide (tamaños de la
  cruceta/A-B, separación del divisor inferior, legibilidad del caption en
  Caída), ajustar los números de este bloque y re-correr el agente.

## Frogger — integración vía `/spec-impl-game` (2026-07-23, Fase D)

Quinto juego del catálogo (`id: frogger`, rama `spec-01-frogger-core`, PR #21),
integrado por la cadena `/spec-impl-game` (engine + componente + página +
skin `clasico`, ya commiteados en el PR). `@mobile-porter` corrió como **Fase
D**, con alcance explícitamente acotado a alinear el shell táctil de Frogger
contra Asteroids — **sin re-auditar** asteroids/caida/serpentina/bloque-buster
(ya alineados de corridas previas).

### Auditoría

`app/games/frogger/page.tsx` **ya llegó consumiendo `TouchPlayerShell`**
(construido por quien implementó la Fase C, copiando el patrón vigente de
Asteroids) — no fue necesario tocar ni la página ni ningún componente. Contra
el criterio unificado (ver más arriba):

| Punto                                       | Asteroids                                               | Frogger (como llegó)                                                                                                                                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell                                       | `TouchPlayerShell`                                      | `TouchPlayerShell` (idéntico)                                                                                                                                                                                                                         |
| `heightPx` en touch                         | `340`                                                   | `340`                                                                                                                                                                                                                                                 |
| `maxWidth` del `<canvas>` (propio, no fijo) | `800px` (su ancho nativo)                               | `640px` (`FROGGER_CANVAS_W`, su ancho nativo) — mismo criterio, no una desviación                                                                                                                                                                     |
| `dpad`                                      | 4 direcciones, `dpadMuted: ['down']` (no usa retroceso) | 4 direcciones, sin `dpadMuted` (salta en las 4 — correcto, confirmado contra `KEY_DIRECTIONS` del engine)                                                                                                                                             |
| `actions`                                   | B muted, A dispara (`Space`)                            | B muted, A muted (Frogger no tiene botón de acción, solo movimiento — correcto)                                                                                                                                                                       |
| Stats en touch                              | el canvas dibuja SCORE/NIVEL/vidas                      | el canvas dibuja SCORE/NIVEL/vidas (`drawHUD()`, línea ~574 de `lib/games/frogger/game.ts`) — sin overlay adicional, igual que la referencia                                                                                                          |
| `.crt-frogger { aspect-ratio: 640/560 }`    | n/a                                                     | solo se aplica en la rama desktop (`<div className="crt crt-frogger">`); en touch el shell monta `crt-800` sin esa clase, así que `.av-player-touch .crt-screen { aspect-ratio: auto }` gobierna sin conflicto — **confirmado, no hace falta ajuste** |

**Resultado: cero cambios de código.** Frogger ya cumplía el shell al 100% al
llegar a esta fase — el mapeo de botonera (4 direcciones activas, A/B muted)
que traía la página era el correcto y no requirió corrección.

### Verificación

El entorno de desarrollo de este repo **no** dispara `(pointer: coarse)` con
solo `browser_resize` del MCP de Playwright (confirmado: a 360×740 la página
siguió renderizando la rama desktop — HUD exterior, nav visible). Para una
verificación más fiel en este entorno, se lanzó un `chromium` standalone vía
un script Node ad-hoc (paquete `playwright` instalado solo en el scratchpad
de la sesión, apuntando al binario ya cacheado en
`%LOCALAPPDATA%\ms-playwright\chromium-1223`, nada de esto tocó el repo) con
`newContext({ hasTouch: true, isMobile: true })`, lo que sí fuerza
`pointer: coarse` y monta el shell táctil real. **Técnica reutilizable en
próximas corridas** si el MCP de Playwright no expone emulación táctil.

- Screenshots (`.playwright-screenshots/`, gitignored):
  `frogger-touch-360x740.png`, `frogger-touch-390x844.png` (shell real) y
  `asteroids-touch-360x740-ref.png` / `asteroids-touch-390x844-ref.png` como
  referencia lado a lado — misma caja, mismo panel, mismo wrap del bisel
  inferior; único cambio visible el contenido del canvas y el estado
  atenuado de A/B (ambos muted en Frogger vs. A activo en Asteroids, tal
  como se espera).
- `document.documentElement.scrollHeight === clientHeight` verificado por
  script en `/games/frogger` a 360×740 y 390×844, y en `/games/asteroids` a
  360×740 como control — **sin scroll vertical en ningún caso**.
- `frogger-desktop-check.png`: pasada rápida a 1280×900 sin emulación
  táctil — HUD exterior + `.crt.crt-frogger` intactos, sin relación con este
  cambio (no se tocó código desktop).
- `npm run build`: verde (sin cambios de código, corrida solo para
  confirmar la base antes de auditar).

### Pendiente

Como siempre, la validación definitiva es del usuario en su **teléfono
real** — este entorno solo permite una emulación de `pointer: coarse`
razonable, no idéntica a un dispositivo físico. Si en el teléfono se ve
algún desvío puntual de Frogger (p. ej. el `maxWidth: 640px` del canvas
dejando un margen dentro de la caja en un dispositivo ancho), reportarlo acá
para ajustar en una corrida futura.

## Relacionado

- `specs/11-controles-tactiles.md` — spec original de controles táctiles
  (gamepad/drag), ya implementado en los 4 juegos.
- `references/game-skins.md` — documento equivalente para `@skin-designer`.
