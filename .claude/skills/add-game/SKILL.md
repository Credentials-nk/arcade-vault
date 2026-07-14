---
name: add-game
description: Genera un spec de integración para incorporar un juego canvas (HTML5/JS) a la plataforma Arcade Vault, aplicando el método spec-driven de la skill /spec con el patrón de los specs 05 (juego + engine + saveScore) y 06 (leaderboard) pre-cargado. El juego puede venir de references/started-games o de una ruta/descripción. Produce el spec en specs/ (estado Borrador); NO escribe código de la app — eso lo hace /spec-impl.
disable-model-invocation: true
argument-hint: '<juego: nombre/número de un started-game (ej. 03-tetris), una ruta a un game.js, o una descripción>'
---

# /add-game — Agregar un juego a Arcade Vault

Este skill toma un juego arcade en canvas (un `game.js` single-file, con o sin dependencias)
y **genera el spec de integración él mismo**, aplicando el método spec-driven de la skill
`/spec` con el patrón de integración ya pre-cargado. No delega en `/spec` (esa skill no es
auto-invocable por el agente): incorpora su método y lo especializa para juegos. No escribe
código de la app — eso lo hace `/spec-impl` sobre el spec resultante. Una vez implementado,
el juego queda jugable dentro de Arcade Vault, guardando puntuaciones en Supabase y
apareciendo en el leaderboard.

## Contexto de sesión

Juegos disponibles en `references/started-games/`:
!`ls references/started-games/ 2>/dev/null || echo "No existe references/started-games/"`

Specs existentes (para saber el próximo número):
!`ls specs/ 2>/dev/null || echo "No existe la carpeta specs/"`

Juegos ya integrados en la plataforma:
!`ls app/games/ 2>/dev/null || echo "Todavía no hay juegos integrados en app/games/"`

---

## Principio rector: reutilizar el patrón ya validado

La plataforma **ya tiene una integración de referencia funcionando**: el juego Asteroids.
No inventes una arquitectura nueva. El spec que resulte debe calcar este patrón, usando
estos archivos del repo como **plantilla viva** (léelos antes de preparar el material):

- `lib/games/asteroids/game.ts` — engine canvas migrado a TypeScript strict, con el **bridge
  de callbacks** (`onScore`, `onLives`, `onLevel`, `onGameOver`) que notifica a React.
- `components/games/asteroids/AsteroidsGame.tsx` — componente cliente que monta el `<canvas>`,
  crea el engine con los callbacks y lo destruye al desmontar.
- `app/games/asteroids/page.tsx` — página `/games/<id>` con HUD exterior (jugador, puntuación,
  vidas, nivel), botón PAUSA, y **modal de game over** que captura el nombre (input máx 10,
  mayúsculas) y llama a `saveScore`.
- `app/actions/saveScore.ts` — server action que inserta en la tabla `scores`.
- `app/actions/getLeaderboard.ts` — lecturas del leaderboard (ya genéricas, ver abajo).
- `app/actions/getGames.ts` — `getGames()`/`getGame(id)`, lecturas de la tabla `games` en
  Supabase (spec 09). El catálogo **ya no vive** en un array hardcodeado: cada juego es una
  fila en esa tabla. La interfaz `Game` sigue en `lib/data.ts`, pero solo describe la forma de
  los datos — no los contiene.

### El leaderboard ya es genérico — no lo rehagas

El spec 06 dejó `getGameLeaderboard(gameId)` y `getGlobalLeaderboard()` funcionando para
**cualquier** `game_id`, y tanto la home como `/game/[id]` los consumen automáticamente.
Por lo tanto, **integrar un juego nuevo NO requiere tocar el leaderboard**. Basta con que:

1. El modal de game over guarde el score con `saveScore('<id-del-juego>', nombre, score)`.
2. El juego esté registrado en la tabla `games` de Supabase con ese mismo `id`.

Con esas dos cosas, el juego aparece solo en el leaderboard por juego y en el global.
El spec debe **verificar** esto en sus criterios de aceptación, no reimplementarlo.

---

## Flujo

Segui las fases en orden. Tus respuestas van en el idioma del proyecto (español).

### Fase 1 — Identificar el juego de entrada

El argumento recibido es: `$ARGUMENTS`

- Si está **vacío**: mostrá los juegos de `references/started-games/` (ya listados arriba) y
  pedí al usuario que indique cuál integrar, o que dé una ruta/descripción. Pará y esperá.
- Si tiene valor, resolvé el origen:
  - **Un started-game**: el usuario puede escribir el nombre completo (`03-tetris`), solo el
    número (`03`) o solo el slug (`tetris`). Buscá la carpeta correspondiente en
    `references/started-games/`.
  - **Una ruta**: a un `game.js` o carpeta de juego en cualquier lugar del repo.
  - **Una descripción**: si no hay código todavía, anotalo — el spec describirá también la
    creación del engine desde cero (caso menos común).
- Si no encontrás el juego, mostrá las opciones disponibles y pedí que corrija.

### Fase 2 — Analizar el engine

Leé el código del juego de entrada (`game.js`, y si existen `README.md`, `CLAUDE.md`,
`index.html`, `style.css`, `levels.js`, `assets/`). Necesitás entender, para poder tipar el
engine y cablear los callbacks:

- **Estado que expone**: ¿tiene `score`? ¿`lives`? ¿`level`/niveles? ¿un estado de
  `gameover`? Anotá los nombres exactos de las variables globales y **dónde se mutan** (esos
  son los puntos donde el engine deberá llamar a los callbacks).
- **Clases / entidades**: enumeralas (p. ej. `Ship`, `Asteroid`, `Bullet`, `Particle`) — se
  tiparán en la migración a TS.
- **Loop y `dt`**, tamaño de canvas (Asteroids es 800×600), y wrapping/colisiones si aplican.
- **Controles**: teclas usadas (para el HUD y la ficha del juego).
- **Assets** (sprites, sonidos): si el juego los usa, el spec debe contemplar copiarlos a
  `public/` y referenciarlos con rutas absolutas.

Si el juego **no** tiene alguno de score/lives/level (p. ej. un puzzle sin vidas), no lo
inventes: el spec debe omitir ese callback y adaptar el HUD. Documentá la decisión.

### Fase 3 — Clarificar los metadatos de plataforma

Antes de delegar en `/spec`, necesitás los datos con los que el juego se registra en la tabla
`games` de Supabase (mirá la interfaz `Game` en `lib/data.ts` y consultá las filas existentes
con `execute_sql` o `list_tables`). Preguntá al usuario **solo lo que no puedas inferir con
criterio**, en un único bloque conciso, proponiendo un valor por defecto para cada uno:

1. **`id`** (slug de la ruta, p. ej. `tetris`) → define `/games/<id>` y el `game_id` de los scores.
2. **`title`** (p. ej. `CAÍDA` o `TETRIS`).
3. **`cat`** (categoría: `ARCADE`, `PUZZLE`, `SHOOTER`, `VERSUS`…).
4. **`color`** (`cyan` | `magenta` | `yellow` | `green`).
5. **`cover`** (clase CSS de portada; si no hay una específica, proponé reutilizar una existente o crear una nueva en `globals.css` como paso del plan).
6. **`short`** / **`long`** (descripciones; podés redactarlas vos a partir del README y confirmarlas).

Recordá al usuario que el `id` elegido es el que amarra juego ↔ scores ↔ leaderboard: debe
ser consistente en la tabla `games`, en la ruta y en la llamada a `saveScore`.

### Fase 4 — Generar el spec (aplicando el método de `/spec`)

Este skill **incorpora el método de la skill `/spec`** y lo aplica directamente. No invoca a
`/spec` (tiene `disable-model-invocation`: no es auto-invocable por el agente); en su lugar
hace el mismo trabajo que haría `/spec`, con la ventaja de que el patrón de integración ya
está pre-cargado y el análisis del juego ya está hecho. Ahí está el valor de `add-game`: es un
generador de specs autónomo y especializado en juegos, no un intermediario.

1. Leé `.claude/skills/spec/template.md` para la estructura de secciones (y el `SKILL.md` de
   `/spec` si necesitás refrescar el método spec-driven).
2. Resolvé las preguntas de clarificación que **queden** — las de dominio ya las hiciste en la
   Fase 3; preguntá solo lo que falte de verdad.
3. Redactá el spec siguiendo el template, usando como insumo el análisis del engine (Fase 2),
   los metadatos (Fase 3) y las particularidades del patrón (abajo). Podés construirlo sección
   por sección con confirmación (fiel a `/spec`) o, si el usuario pide velocidad, presentarlo
   completo de una (y registrarlo como "definición rápida" en Decisiones).
4. Numerá con el correlativo de `specs/` y elegí un slug claro (p. ej. `07-caida-game`).
5. Guardá el archivo en `specs/NN-slug.md` en estado **Borrador**.

Las particularidades del patrón (abajo) son el insumo pre-cargado que `/spec` normalmente
tendría que descubrir preguntando; incorporalas en las secciones correspondientes.

#### Particularidades del patrón a reflejar en el spec

- **Objetivo** (una sola oración): integrar el juego `<X>` como página `/games/<id>` con HUD
  sincronizado, guardado de puntuaciones en Supabase y presencia automática en el leaderboard.
- **Depende de:** 04-supabase-setup, 05-asteroids-game, 06-leaderboard (el patrón y el
  leaderboard genérico ya existen).
- **Scope · In:** engine TS con callbacks; componente `<...Game>`; página `/games/<id>` con
  HUD + pausa + modal game over con captura de nombre y `saveScore('<id>', ...)`; una fila
  nueva en la tabla `games` de Supabase (vía migración, con `play_route`); copia de assets a
  `public/` si aplica.
- **Scope · Fuera:** modificar el leaderboard (ya es genérico); auth; realtime; cualquier
  juego adicional. Sé explícito.
- **Modelo de datos:** normalmente **no** introduce datos nuevos — reutiliza la tabla `scores`
  y el `saveScore` existentes. Decilo explícitamente. (Excepción: assets nuevos.)
- **Plan de implementación** (pasos commiteables, cada uno deja el sistema funcional), calcado
  del spec 05:
  1. Rama + copiar el `game.js` a `lib/games/<id>/` y assets a `public/` si los hay.
  2. Migrar el engine a `lib/games/<id>/game.ts` en TS strict: tipar clases primero, dejar los
     globales de estado para el final; añadir la interfaz de callbacks y llamarlos en los
     puntos exactos donde se mutan `score`/`lives`/`level` y se entra en `gameover`.
  3. Crear `components/games/<id>/<Nombre>Game.tsx` (montar canvas, crear/destruir engine).
  4. Crear `app/games/<id>/page.tsx` con HUD, pausa y modal game over (input nombre máx 10,
     mayúsculas, `saveScore('<id>', nombre || 'INVITADO', finalScore)`).
  5. Insertar una fila para el juego en la tabla `games` de Supabase vía migración (o
     actualizar la existente si ya está en el catálogo sin `play_route`), con
     `play_route = '/games/<id>'` y el siguiente `sort_order` disponible.
  6. `npm run build`; corregir TS/ESLint.
- **Criterios de aceptación** (booleanos y verificables), incluyendo obligatoriamente:
  - El juego carga en `/games/<id>` y es jugable con los controles documentados.
  - El HUD refleja en tiempo real el estado interno del engine.
  - Al game over, guardar con nombre inserta una fila en `scores` con `game_id = '<id>'`.
  - La puntuación guardada aparece en el leaderboard por juego (`/game/<id>`) y, si es alta, en
    el global de la home — **sin** haber tocado el leaderboard.
  - `npm run build` sin errores de TypeScript ni ESLint.
- **Decisiones:** registrar las tomadas (id elegido, callbacks omitidos si el juego no tiene
  vidas/niveles, assets, etc.) con su razón.
- **Riesgos:** el clásico es "migrar globals mutables a TS strict es más extenso de lo
  esperado" → mitigación: tipar clases primero, globals de estado al final; nunca desactivar
  strict globalmente. Añadir los propios del juego (assets, sonidos, input táctil…).

### Cierre

Tras guardar el spec en `specs/NN-slug.md` (estado **Borrador**), confirmá al usuario:

- La ruta del archivo creado.
- Que el spec está en **Borrador**: debe releerlo y pasarlo a **Aprobado** cuando esté listo.
- Que el siguiente paso es `/spec-impl NN-slug` para implementarlo.

**No escribas el código de la app ni propongas implementarlo en esta corrida:** eso es trabajo
de `/spec-impl`, sobre el spec generado.

---

## Reglas duras

- **Nunca escribas código de la aplicación en este skill.**
- **Redactá el spec vos mismo aplicando el método de `/spec`.** Esa skill no es auto-invocable
  por el agente; `add-game` incorpora su método y genera el spec directamente, especializado
  para juegos. El resultado se guarda en **Borrador**: el humano lo aprueba, no el agente.
- **No rehagas el leaderboard.** Ya es genérico; el spec solo lo aprovecha y lo verifica.
- **Calcá el patrón de Asteroids.** Leé los archivos de referencia antes de preparar el
  material; no inventes una arquitectura distinta.
- **No asumas metadatos que el usuario no confirmó** (id, categoría, color…). Si faltan, preguntá.
- **id consistente** entre la tabla `games`, la ruta `/games/<id>` y `saveScore` — es lo que
  amarra el juego al leaderboard.
