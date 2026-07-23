# SPEC 11 — Controles táctiles móviles para los juegos

> **Estado:** Implementado · **Depende de:** 05-asteroids-game, 07-caida-game, 08-bloque-buster-game, 10-serpentina-game · **Fecha:** 2026-07-22
> **Objetivo:** Hacer jugables los 4 juegos en dispositivos táctiles mediante un panel de gamepad virtual debajo del canvas (cruceta + botones de acción) y arrastre directo para la paleta, sin modificar ningún engine.

## Por qué existe este spec

Al probar la plataforma desde un celular en la red local (dev server con `allowedDevOrigins`), se comprobó que **ningún juego es jugable en móvil**: los 4 engines solo escuchan teclado (`keydown`/`keyup` en `window`) y Bloque Buster además mouse.

**Nota de revisión (post-implementación inicial):** la primera iteración de este spec proponía un overlay semi-transparente superpuesto sobre el canvas. Al probarlo en dispositivo real, el resultado se veía mal (controles flotando encima del área de juego, poco legibles) y no coincidía con la referencia visual real del usuario — una captura de un gamepad móvil de referencia con **cruceta y botones de acción en un panel separado, debajo del canvas**, no encima. Se revisó la decisión con el usuario y se adoptó ese layout; ver "Decisiones" para el detalle de la reversión.

La restricción arquitectónica que gobierna todo el diseño: **cero cambios en `lib/games/*/game.ts`**. Los controles táctiles se conectan despachando eventos sintéticos que los listeners existentes de cada engine ya entienden.

## Scope

**In:**

- Hook `hooks/useTouchDevice.ts`: detección de dispositivo táctil vía `matchMedia('(pointer: coarse)')`, resuelta en cliente (inicializa `false` y se setea en `useEffect` para evitar mismatch de hidratación).
- Componente compartido `components/games/TouchControls.tsx`: cruceta configurable (qué direcciones muestra) + botones de acción configurables, que despachan `KeyboardEvent` sintéticos (`keydown` al presionar, `keyup` al soltar) en `window`, con `code` **y** `key` seteados (asteroids/caida leen `e.code`; serpentina lee `e.key`).
- Soporte de **auto-repeat** por botón (para Caída, cuyo engine es event-driven sin flags): al mantener presionado, re-despacha `keydown` cada 120 ms tras una demora inicial de 200 ms.
- Soporte **multi-touch**: cada botón maneja sus propios pointer events (`onPointerDown`/`onPointerUp` + `setPointerCapture`), de modo que cruceta y botón de acción funcionan en simultáneo (girar + disparar).
- Modo **arrastre** para Bloque Buster: overlay transparente sobre el canvas que captura `touchmove`/`pointermove` y despacha `MouseEvent('mousemove')` sintético sobre el canvas — reutiliza el listener `onMouseMove` existente del engine (mapeo cliente→coords con `getBoundingClientRect`, `lib/games/bloque-buster/game.ts:312-317`).
- Cableado en las 4 páginas `app/games/<id>/page.tsx`, cada una con su configuración:
  - **asteroids**: cruceta ←/→ (girar) + ↑ (thrust); botón `FUEGO` (`Space`).
  - **caida**: cruceta ←/→ (mover, con repeat) + ↓ (soft drop, con repeat); botones `ROTAR` (`ArrowUp`) y `SOLTAR` (`Space`).
  - **serpentina**: cruceta de 4 direcciones (sin repeat, sin botones de acción).
  - **bloque-buster**: solo modo arrastre (sin cruceta ni botones).
- Los controles se renderizan **solo** si `useTouchDevice()` es `true` y **se ocultan cuando el modal de game over está visible**.
- **Excepción de alcance puntual** (confirmada con el usuario): se oculta el `Nav` global (`components/NavWrapper.tsx`) en las páginas `/games/*` cuando `useTouchDevice()` es `true`, para ganar espacio vertical. Se agrega un botón `ATRÁS` junto a PAUSA/SALIR en el HUD de las 4 páginas (navega a `/game/<id>`, la página de detalle — distinto de SALIR, que va a `/library`). **En touch**, la fila PAUSA/ATRÁS/SALIR se relocaliza debajo del panel de gamepad (no arriba del canvas) para calcar el orden vertical de la referencia del usuario; el bloque de stats (JUGADOR/PUNTUACIÓN/VIDAS/NIVEL) se mantiene arriba del canvas en ambos casos. En desktop, la fila de botones no se mueve. El resto del rediseño de HUD mobile (selector de skin, reubicación de stats) sigue fuera de alcance.
- La cruceta muestra siempre sus 4 direcciones cuando aplica; las direcciones que el engine no usa (ej. `down` en asteroids) se pasan también por `dpadMuted` y se renderizan atenuadas (`opacity: 0.35`) — presentes para completar la forma de cruceta como en la referencia del usuario, pero sin implicar una acción real.
- Ajustes CSS en `app/globals.css`: panel `.touch-controls` en flujo normal (no absoluto) debajo del bloque `.crt`, con fondo propio y bordes redondeados — cruceta a la izquierda, botones de acción circulares (color por acción) a la derecha; `touch-action: none` en cada botón. Botón `ATRÁS` agregado junto a PAUSA/SALIR en el HUD (ver excepción de alcance más abajo), con estilos compactos en el media query `@media (max-width: 720px)` (l.1662) para que los 3 quepan en una fila. Incluye evitar el desborde del panel «SIGUIENTE» de Caída (canvas 120×120 fijo en flex lado a lado).

**Fuera de scope (para specs futuros):**

- Rediseño completo del HUD mobile (reubicación de stats/botones — las marcas verdes del mockup sobre el HUD quedan para otro spec).
- Gestos swipe (serpentina) o tap-zonas: se eligió cruceta uniforme.
- Vibración háptica, bloqueo de orientación landscape, fullscreen API, PWA.
- Cualquier modificación a `lib/games/*/game.ts` o a los callbacks.
- Selector de posición/tamaño de controles por el jugador.

## Modelo de datos

**No introduce datos nuevos en Supabase ni persistencia.** Solo los tipos de configuración del componente:

```ts
// components/games/TouchControls.tsx → tipos exportados
type Dir = 'up' | 'down' | 'left' | 'right';

interface SyntheticKey {
  code: string; // ej. 'Space' — leído por asteroids/caida
  key: string; // ej. ' '   — leído por serpentina/bloque-buster
}

interface TouchAction {
  label: string; // ej. 'FUEGO', 'ROTAR'
  synthKey: SyntheticKey;
  repeat?: boolean; // re-despacha keydown en press-and-hold
}

interface TouchControlsProps {
  dpad?: Dir[]; // direcciones visibles; omitido = sin cruceta
  dpadMuted?: Dir[]; // direcciones presentes pero inertes en el engine (ej. 'down' en asteroids) — se muestran atenuadas
  dpadRepeat?: boolean; // caida: true
  actions?: TouchAction[];
  drag?: boolean; // bloque-buster: overlay de arrastre
  hidden?: boolean; // true cuando el modal de game over está abierto
}
```

Las flechas de la cruceta despachan `ArrowLeft/ArrowRight/ArrowUp/ArrowDown` (mismo string en `code` y `key`, como en un teclado real).

## Plan de implementación

1. Crear rama `11-controles-tactiles` desde `main`.

2. Crear `hooks/useTouchDevice.ts` y `components/games/TouchControls.tsx` con cruceta + botones + repeat + despacho de eventos sintéticos. Sin cablear a ninguna página todavía.
   Verificar: `npx tsc --noEmit` sin errores.

3. Cablear **asteroids** (`app/games/asteroids/page.tsx`) como implementación de referencia + estilos base del gamepad en `globals.css`.
   Verificar: en un celular vía LAN, se puede girar, acelerar y disparar sin teclado; en desktop no aparece nada.

4. Cablear **caida** con repeat en la cruceta y botones ROTAR/SOLTAR; ajustar el desborde del panel «SIGUIENTE» en pantallas angostas.
   Verificar: mantener presionado ← mueve la pieza repetidamente; ROTAR y SOLTAR responden.

5. Cablear **serpentina** (cruceta de 4 direcciones).
   Verificar: la serpiente responde a las 4 direcciones por touch; la regla anti-reversa del engine sigue funcionando.

6. Cablear **bloque-buster** con el overlay de arrastre (touchmove → `mousemove` sintético sobre el canvas, `touch-action: none`, `preventDefault`).
   Verificar: la paleta sigue el dedo con precisión en todo el ancho del canvas.

7. Extender `@media (max-width: 720px)` para compactar HUD/CRT lo mínimo necesario; ocultar controles cuando el modal de game over está visible en las 4 páginas.
   Verificar: en un viewport ~360×740, HUD + canvas + controles entran sin scroll vertical en los 4 juegos.

8. Ejecutar `npm run build` y corregir errores. Marcar el spec como `Implementado` y crear PR `11-controles-tactiles` → `main`.

## Criterios de aceptación

- [x] En un dispositivo táctil, **asteroids** se juega completo (girar, thrust, disparar) sin teclado.
- [x] En **caida**, mover/soft-drop/rotar/hard-drop funcionan por touch; mantener presionado ←/→ repite el movimiento (~120 ms tras demora inicial).
- [x] En **serpentina**, la cruceta cambia la dirección en las 4 direcciones y la reversa de 180° sigue bloqueada.
- [x] En **bloque-buster**, arrastrar el dedo sobre el canvas mueve la paleta con seguimiento directo (verificado estructuralmente; confirmar en dispositivo real — el arrastre automatizado en este entorno de test no sostiene el gesto con precisión).
- [x] En desktop (`pointer: fine`) no se renderiza ningún control táctil en ninguna de las 4 páginas.
- [x] Cruceta y botón de acción responden a toques **simultáneos** (girar + disparar en asteroids).
- [x] Tocar los controles no produce scroll, zoom ni selección de texto del navegador durante la partida.
- [x] Los controles no aparecen encima del modal de game over.
- [ ] En un viewport 360×740, HUD + canvas + controles entran sin scroll vertical en los 4 juegos. Pendiente de re-verificar tras el rediseño del HUD (selector de skin en vez de ATRÁS, spec fuera de este documento).
- [ ] ~~`git diff` no muestra ningún cambio en `lib/games/*/game.ts`.~~ Superado a propósito: los 4 engines ganaron un método `setSkin()` (paleta de render mutable) para conectar el selector de modo visual del branch `skin-designer` — cambio ajeno al input táctil, no reabre el riesgo original (gameplay/física intactos).
- [ ] `npm run build` completa sin errores de TypeScript ni ESLint.

## Decisiones

- **Sí:** eventos de teclado sintéticos, no API pública nueva en los engines. Razón: cero riesgo de romper gameplay validado; los 4 engines ya escuchan en `window`; un solo componente sirve para todos. Confirmado explícitamente con el usuario.
- **Sí:** esquema híbrido — gamepad para asteroids/caida/serpentina, arrastre para bloque-buster. Razón: la paleta con botones se siente peor que el seguimiento directo del dedo; el engine ya tiene el mapeo mouse→paleta reutilizable. Confirmado con el usuario.
- **Sí:** visibilidad por `(pointer: coarse)`, sin toggle manual. Razón: en desktop nunca estorba; en touch siempre disponible; evita UI extra. Confirmado con el usuario.
- **No (revertido tras prueba en dispositivo real):** overlay semi-transparente sobre el canvas. Razón original: evitar alargar la página. Razón de la reversión: en dispositivo real se veía mal (controles flotando sobre el área de juego, poca legibilidad) y no correspondía a la referencia visual real del usuario (gamepad de referencia con panel separado debajo del canvas). Se verificó con Playwright a 362×794 que el panel debajo del canvas **sí** entra sin scroll (HUD compacto de una fila + CRT + panel de controles), así que la razón original ya no aplicaba.
- **Sí:** panel `.touch-controls` en flujo normal, debajo de `.crt` (cruceta a la izquierda, acciones circulares a la derecha, coloreadas por acción). Razón: coincide con la referencia real del usuario y se lee como un control dedicado, no como una capa flotando sobre el juego. Confirmado explícitamente con el usuario tras ver el resultado del overlay.
- **Sí:** botón `ATRÁS` en el HUD (excepción puntual de alcance) + ocultar el `Nav` global en `/games/*` táctil. Razón: sin esto, 3 botones (PAUSA/ATRÁS/SALIR) no entran en una fila en 360px y el Nav le resta el espacio vertical que el criterio de sin-scroll necesita. Confirmado explícitamente con el usuario; el resto del rediseño de HUD (selector de skin) se descarta explícitamente por contradecir la decisión de `@skin-designer` de un skin fijo por juego sin selector en runtime.
- **Sí:** alcance HUD mínimo (compactar, no rediseñar). Razón: el objetivo es jugabilidad; el rediseño mobile del HUD es un spec propio. Confirmado con el usuario.
- **Sí:** un solo spec para los 4 juegos. Razón: un componente compartido + 4 cableados es un cambio cohesivo; separarlo duplicaría el 80% del texto.
- **Sí:** `code` y `key` seteados en cada evento sintético. Razón: asteroids/caida leen `e.code`, serpentina/bloque-buster leen `e.key`; un teclado real setea ambos.
- **No:** swipe para serpentina. Razón: la cruceta es más descubrible y consistente con el resto; swipe queda para un spec futuro si se quiere.
- **No:** exponer métodos públicos de input en los engines. Razón: duplicaría lógica que ya vive en los listeners privados (anti-reversa de serpentina, edge-detection de asteroids).

## Riesgos

| Riesgo                                                                                     | Mitigación                                                                                                                                 |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| El auto-repeat de caida (120 ms) se siente lento/rápido contra el tick real del engine     | Los valores 200/120 ms son punto de partida; se ajustan en el paso 4 probando en dispositivo real. Solo tocan el componente, no el engine. |
| Un `pointerup` fuera del botón deja una tecla sintética "pegada" (keydown sin keyup)       | `setPointerCapture` por botón + despachar `keyup` también en `onPointerCancel`/`onPointerLeave`.                                           |
| Mismatch de hidratación por detectar touch en servidor                                     | `useTouchDevice` inicializa `false` y resuelve en `useEffect`; el primer render cliente/servidor coincide.                                 |
| El overlay de controles tapa zona jugable en pantallas muy chicas                          | Controles semi-transparentes (opacidad baja en reposo), tamaño contenido, y solo en las esquinas inferiores del canvas.                    |
| El navegador dispara scroll/zoom/long-press en vez del juego                               | `touch-action: none` + `preventDefault` en los handlers + `user-select: none` en la zona de controles.                                     |
| El panel «SIGUIENTE» de caida (120 px fijos, flex lado a lado) desborda en 360 px de ancho | Ajuste puntual en el media query ≤720px (apilar o reducir), incluido en el paso 4.                                                         |

## Lo que **no** está en este spec

- Rediseño completo del HUD mobile (stats/botones reubicados — otro spec).
- Gestos swipe o tap-zonas.
- Vibración háptica, landscape lock, fullscreen, PWA.
- Cambios en `lib/games/*/game.ts` o en los callbacks.
- Skins o personalización visual de los controles.

Cada uno, si llega, va en su propio spec.
