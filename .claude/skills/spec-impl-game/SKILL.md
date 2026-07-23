---
name: spec-impl-game
description: >-
  Implementa un spec de JUEGO aprobado reusando el método de /spec-impl (valida
  Aprobado, crea rama, implementa paso a paso, verifica criterios, marca
  Implementado + commit) y, al terminar, encadena EN SECUENCIA (nunca en
  paralelo) a @skin-designer, luego @game-performance-booster y luego
  @mobile-porter, enfocados SOLO en el juego nuevo. El skin y la optimización
  de rendimiento van en el mismo PR que el juego; el diff táctil de
  @mobile-porter queda sin commitear para validar en teléfono real.
disable-model-invocation: true
argument-hint: <NN-spec-name del juego (ej. 12-vikingos-runa)>
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(gh pr:*), Bash(npm run build:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-game — Implementer de specs de juego + cadena de agentes de acabado

## Session context

Current repository state:
!`git status --short`

Current branch:
!`git branch --show-current`

Specs available in this folder:
!`ls specs/ 2>/dev/null || echo "The specs/ folder does not exist"`

---

## Qué es esto

`/spec-impl-game` es una **especialización de `/spec-impl` para specs de juego**. No duplica su
lógica: reusa exactamente sus cuatro fases (identificar spec → validar Aprobado → crear rama →
implementar paso a paso) y, únicamente cuando esa implementación termina con éxito, agrega **tres**
fases nuevas que encadenan `@skin-designer`, `@game-performance-booster` y `@mobile-porter` **en
secuencia, nunca en paralelo**, enfocados **solo en el juego recién implementado** (nunca
re-auditando los otros del catálogo).

Pipeline completo:

```
Fase A (= /spec-impl)  →  Fase B (@skin-designer)  →  Fase C (@game-performance-booster)  →  Fase D (PR)  →  Fase E (@mobile-porter)  →  Fase F (cierre)
   juego + commit           skin + commit               perf (rAF/GC) + commit                juego+skin+perf   layout táctil, SIN            reporte
                                                         (cero cambio de comportamiento)                        commitear
```

---

## Instrucciones

Seguí estas fases en orden estricto. **No avances a la siguiente si la anterior no terminó
correctamente.**

---

### Fase A — Implementar el spec (= las 4 fases de `/spec-impl`)

Ejecutá el procedimiento **completo y sin modificaciones** definido en
`.claude/skills/spec-impl/SKILL.md` para `$ARGUMENTS`:

1. **Identificar el spec** — si `$ARGUMENTS` está vacío, listá `specs/` y esperá que el usuario
   indique cuál. Si tiene valor, resolvé el archivo aceptando nombre completo, solo número o solo
   slug.
2. **Validar el estado** — leé el spec y confirmá que el estado significa **Aprobado** (en
   cualquier idioma: `Approved`, `Aprobado`, `Aprovado`, `Approuvé`, …). Cualquier otro valor
   (Borrador, En revisión, **Implementado**, Obsoleto, o no reconocido) → **detenete** y mostrá el
   mensaje de error estándar de `/spec-impl`. **No sigas a las fases de agentes bajo ninguna
   circunstancia si esta validación no pasa.**
3. **Crear la rama** — `spec-NN-slug` a partir del nombre del archivo; `git checkout -b` si no
   existe, o avisar que se retoma trabajo previo si ya existe. Mostrar el resumen del spec
   (objetivo, alcance, plan de implementación, criterios de aceptación) antes de empezar a
   codear.
4. **Implementar paso a paso** — seguí el plan exactamente, pausando después de cada paso para
   revisión de diff, con el mismo ritmo y las mismas reglas de `/spec-impl` (ambigüedad → parar y
   presentar opciones; pedido fuera de alcance → recordar que no corresponde a este spec).

Esto sigue siendo **interactivo**: heredá las pausas de confirmación por paso tal cual las define
`/spec-impl`.

**Nota específica de juego** (spec producido por `/add-game`, patrón validado en Asteroids):
esperá encontrar en el plan la anatomía completa — engine TS estricto en `lib/games/<id>/game.ts`
con el puente de callbacks (`onScore`/`onLives`/`onLevel`/`onGameOver`, omitiendo los que no
apliquen), componente `components/games/<id>/<Nombre>Game.tsx`, página
`app/games/<id>/page.tsx` con HUD sincronizado, pausa y modal de game-over que llama a
`saveScore('<id>', nombre || 'INVITADO', score)`, y una migración que agrega la fila en la tabla
`games` de Supabase con `play_route = '/games/<id>'`. **Capturá el `id`** usado en la ruta y en
`saveScore` (el mismo en los tres lugares, por el patrón) — lo vas a necesitar en las Fases B, C y
E.

**Al completar el último paso del plan** (extensión respecto a `/spec-impl`, que solo lo sugiere
en texto):

1. Verificá los criterios de aceptación del spec uno por uno.
2. Si todos pasan, actualizá el **Estado del spec a "Implementado"** (o el equivalente en el
   idioma del repo — este proyecto usa `Implementado`).
3. Hacé el **commit** de la implementación del juego (incluyendo el cambio de Estado del spec).
4. **No abras el PR todavía.** Los commits del skin (Fase B) y de rendimiento (Fase C) van a
   sumarse, y los tres se publican juntos en la Fase D.

Si algún criterio de aceptación no pasa, **detenete ahí**: no continúes a la Fase B con
criterios pendientes.

---

### Fase B — `@skin-designer` (primero, secuencial)

Lanzá el subagente `skin-designer` (Agent tool, `subagent_type: skin-designer`) con un prompt que
le dé el contexto de esta cadena y le indique explícitamente:

- Que se enfoque **únicamente en el juego `<id>`** recién implementado (no re-auditar ni tocar
  los demás juegos del catálogo, aunque su comportamiento por defecto sea recorrerlo entero).
- Que audite ese juego contra los 3 skins canónicos (`neon`, `clasico`, `retro`), le asigne e
  implemente **un skin fijo**, actualizando `lib/skins.ts` (entrada en `GAME_SKINS`) y
  `references/game-skins.md` con la asignación y su razón.
- Que respete sus reglas duras habituales: no tocar gameplay/callbacks/tamaño de canvas, mantener
  `npm run build` verde, TypeScript strict, dark-only.

Esperá a que el agente termine por completo antes de continuar (no arranques la Fase C ni la
Fase E en paralelo — la cadena es estrictamente secuencial).

Al terminar:

1. Corré `npm run build` para confirmar que sigue verde.
2. El agente **no commitea por diseño** — hacé vos el `git add` + `git commit` del diff del skin
   (mensaje describiendo la skin asignada al juego `<id>`).

---

### Fase C — `@game-performance-booster` (segundo, secuencial)

Solo una vez que la Fase B terminó y su diff de skin quedó commiteado, lanzá el subagente
`game-performance-booster` (Agent tool, `subagent_type: game-performance-booster`) con un prompt
que le indique:

- Que se enfoque **únicamente en el engine del juego `<id>`** recién implementado
  (`lib/games/<id>/game.ts`); no tocar componentes, páginas, CSS, el sistema de skins ni ningún
  otro engine del catálogo. (Este agente ya es single-game por diseño, pero pasale el `id` igual,
  explícito.)
- Que aplique su checklist P1–P5 (rAF de dueño único, compactación in-place, caché de strings
  `rgba(...)`/estilos por frame, caché de contenido estático, pool de alocación por evento) **solo
  donde de verdad aparezca y valga la pena**, y que respete su lista anti-sobreingeniería (sin
  particionado espacial, sin dirty-rect, sin cap de crecimiento).
- Que su promesa por encima de todo es **cero cambio de comportamiento observable** (mismos
  callbacks, misma física/colisiones/timing, mismos píxeles) y que registre cada cambio con su
  frase de equivalencia en `references/game-performance-booster-todo.md`.
- Que mantenga `npm run build` verde y verifique con el smoke de Playwright (navegar a
  `/games/<id>`, cero errores nuevos de consola, teclas que siguen respondiendo).

Esperá a que el agente termine por completo antes de continuar (no dispares la Fase E en
paralelo: corre después de este agente y del PR).

Al terminar:

1. Corré `npm run build` para confirmar que sigue verde.
2. Corré el smoke rápido (navegá a `/games/<id>`, confirmá que carga sin errores de consola). A
   diferencia de `@mobile-porter`, este agente **no** tiene brecha de dispositivo real: su
   refactor es puro código de canvas verificable en este entorno.
3. El agente **no commitea por diseño** — hacé vos el `git add` + `git commit` del diff de
   rendimiento (mensaje describiendo los patrones aplicados al engine de `<id>`), para que entre
   en el mismo PR que el juego y el skin.

---

### Fase D — Abrir el PR (juego + skin + rendimiento)

Con los commits del juego (Fase A), del skin (Fase B) y de rendimiento (Fase C) ya en la rama:

1. `git push` de la rama `spec-NN-slug`.
2. `gh pr create` con un PR que incluya los tres commits (implementación del juego + skin
   asignado + optimización del engine). Sin trailer `Co-Authored-By` ni ninguna variante de
   atribución a IA (regla global del usuario).

El PR queda abierto y mergeable en este punto — el layout táctil de la Fase E es intencionalmente
un cambio aparte, no bloqueante.

---

### Fase E — `@mobile-porter` (después, secuencial)

Solo una vez que la Fase C (rendimiento) terminó y el PR de la Fase D está creado, lanzá el
subagente `mobile-porter` (Agent tool, `subagent_type: mobile-porter`) con un prompt que le
indique:

- Que se enfoque **únicamente en el juego `<id>`** (no re-auditar los otros, aunque su
  comportamiento por defecto sea recorrer todo el catálogo).
- Que alinee su shell táctil al de **Asteroids** (única referencia), usando el componente
  compartido existente, sin tocar el engine ni el layout desktop del juego.
- Que documente el resultado en `references/mobile-porter-todo.md` como de costumbre.

Esperá a que termine. **No lo dispares junto con las Fases B/C** — el orden es siempre
skin-designer → game-performance-booster → (PR) → mobile-porter.

Al terminar:

- **No commitees su diff.** Es el contrato del agente: deja el working tree para que el humano lo
  valide **en un teléfono real** antes de commitear (el emulador de Playwright que usa el agente
  no es fiel). Confirmá que `npm run build` sigue verde y dejalo así, sin `git add`/`git commit`.

---

### Fase F — Reporte de cierre

Resumí para el usuario:

- Link del PR abierto en la Fase D (juego + skin + rendimiento).
- Qué skin se le asignó al juego nuevo.
- Qué **optimizaciones de rendimiento** se aplicaron al engine (patrones P1–P5) y que van
  **commiteadas dentro del mismo PR**, verificadas con build verde + smoke, sin cambio de
  comportamiento observable.
- Que `@mobile-porter` dejó un **diff sin commitear** en el working tree, pendiente de validación
  en teléfono real antes de commitear aparte.
- Que los agentes corrieron **en secuencia** (skin-designer → game-performance-booster completos
  antes de que arrancara mobile-porter) y **solo sobre el juego `<id>`**, sin tocar los demás del
  catálogo.

---

## Guardas (no negociables)

- **Stop duro heredado de `/spec-impl`**: si el estado del spec no significa Aprobado, la cadena
  termina en la Fase A — nunca se llega a los agentes.
- **Nunca en paralelo**: el orden es estrictamente `@skin-designer` → `@game-performance-booster`
  → (PR) → `@mobile-porter`. `@game-performance-booster` no arranca hasta que el diff de
  `@skin-designer` quedó commiteado; `@mobile-porter` no arranca hasta que el diff de rendimiento
  quedó commiteado y el PR existe.
- **Alcance por juego**: cada invocación de agente debe indicar explícitamente el `id` del juego
  nuevo. `@skin-designer` y `@mobile-porter` auditan todo el catálogo por defecto (hay que
  acotarlos); `@game-performance-booster` ya es single-game por diseño, pero igual se le pasa el
  `id` explícito.
- **`@game-performance-booster` nunca cambia comportamiento observable** — sus commits son
  refactors mecánicos (mismos callbacks, misma física, mismos píxeles), verificados con build
  verde + smoke.
- **`@game-performance-booster` SÍ se commitea** dentro de la cadena (a diferencia de
  `@mobile-porter`): no hay brecha de dispositivo real que lo bloquee. Su diff entra en el PR de
  la Fase D.
- **`@mobile-porter` nunca se commitea** dentro de esta cadena — el contrato del agente exige
  validación en dispositivo real primero.
- **Nunca commit directo a `main`** — todo ocurre sobre la rama `spec-NN-slug` creada en la Fase A.
- **Sin trailer `Co-Authored-By`** ni variantes de atribución a IA en ningún commit (regla global).
