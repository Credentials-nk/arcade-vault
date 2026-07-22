# SPEC 11 — Controles táctiles móviles para los juegos

> **Estado:** Approved · **Depende de:** 05-asteroids-game, 07-caida-game, 08-bloque-buster-game, 10-serpentina-game · **Fecha:** 2026-07-22
> **Objetivo:** Hacer jugables los 4 juegos en dispositivos táctiles mediante un gamepad virtual superpuesto (cruceta + botones de acción) y arrastre directo para la paleta, sin modificar ningún engine.

## Por qué existe este spec

Al probar la plataforma desde un celular en la red local (dev server con `allowedDevOrigins`), se comprobó que **ningún juego es jugable en móvil**: los 4 engines solo escuchan teclado (`keydown`/`keyup` en `window`) y Bloque Buster además mouse. Existe un mockup anotado del usuario — `references/idea-canvas-controls.png` (commiteado en la rama `skin-designer`) — que define la idea visual: **cruceta direccional abajo a la izquierda y botones de acción abajo a la derecha, superpuestos sobre el área del canvas**, estilo gamepad virtual clásico.

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
- Ajustes CSS mínimos en `app/globals.css`: estilos del gamepad (overlay semi-transparente, `touch-action: none`), y extensión del media query existente `@media (max-width: 720px)` (l.1662) para compactar `.player-hud`/`.crt` lo justo para que HUD + canvas + controles entren sin scroll en un viewport de celular. Incluye evitar el desborde del panel «SIGUIENTE» de Caída (canvas 120×120 fijo en flex lado a lado).

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

- [ ] En un dispositivo táctil, **asteroids** se juega completo (girar, thrust, disparar) sin teclado.
- [ ] En **caida**, mover/soft-drop/rotar/hard-drop funcionan por touch; mantener presionado ←/→ repite el movimiento (~120 ms tras demora inicial).
- [ ] En **serpentina**, la cruceta cambia la dirección en las 4 direcciones y la reversa de 180° sigue bloqueada.
- [ ] En **bloque-buster**, arrastrar el dedo sobre el canvas mueve la paleta con seguimiento directo.
- [ ] En desktop (`pointer: fine`) no se renderiza ningún control táctil en ninguna de las 4 páginas.
- [ ] Cruceta y botón de acción responden a toques **simultáneos** (girar + disparar en asteroids).
- [ ] Tocar los controles no produce scroll, zoom ni selección de texto del navegador durante la partida.
- [ ] Los controles no aparecen encima del modal de game over.
- [ ] En un viewport 360×740, HUD + canvas + controles entran sin scroll vertical en los 4 juegos.
- [ ] `git diff` no muestra ningún cambio en `lib/games/*/game.ts`.
- [ ] `npm run build` completa sin errores de TypeScript ni ESLint.

## Decisiones

- **Sí:** eventos de teclado sintéticos, no API pública nueva en los engines. Razón: cero riesgo de romper gameplay validado; los 4 engines ya escuchan en `window`; un solo componente sirve para todos. Confirmado explícitamente con el usuario.
- **Sí:** esquema híbrido — gamepad para asteroids/caida/serpentina, arrastre para bloque-buster. Razón: la paleta con botones se siente peor que el seguimiento directo del dedo; el engine ya tiene el mapeo mouse→paleta reutilizable. Confirmado con el usuario.
- **Sí:** visibilidad por `(pointer: coarse)`, sin toggle manual. Razón: en desktop nunca estorba; en touch siempre disponible; evita UI extra. Confirmado con el usuario.
- **Sí:** overlay semi-transparente **sobre** el canvas (cruceta abajo-izquierda, acciones abajo-derecha). Razón: es lo que dibuja el mockup `idea-canvas-controls.png`; una franja debajo del canvas alargaría la página y forzaría scroll.
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
