# SPEC 14 — Protección de rutas por sesión

> **Estado:** Implementado · **Depende de:** 12-autenticacion · **Fecha:** 2026-07-24
> **Objetivo:** Requerir sesión iniciada para jugar (`/games/<id>`, `/game/[id]/play`) y para `/account` (página nueva de perfil), usando `proxy.ts` como gate único, y redirigir `/auth` a `/` cuando ya hay sesión.

## Por qué existe este spec

El spec 12 dejó explícitamente afuera "rutas protegidas / gating de contenido por sesión" para preservar el catálogo 100% jugable sin cuenta. Este spec revierte esa decisión a pedido del usuario: ahora **jugar requiere cuenta**. Navegar el catálogo (biblioteca, detalle de juego, Salón de la Fama, home) sigue siendo público — solo el acto de jugar y la nueva página de cuenta quedan atrás del login.

## Scope

**In:**

- `proxy.ts` redirige a `/auth` cualquier request sin sesión a `/games/*`, `/game/[id]/play` o `/account`.
- `proxy.ts` redirige `/auth` a `/` cuando ya hay sesión (evita mostrar el formulario de login a alguien ya logueado).
- Página nueva `/account` (`app/account/page.tsx`): perfil simple (avatar, nombre, email) + botón "Cerrar sesión". Es la única ruta protegida nueva; el resto de las protegidas ya existían.
- Se elimina el botón "JUGAR COMO INVITADO" y su lógica (`asGuest`) de `app/auth/page.tsx` — queda contradictorio una vez que jugar requiere cuenta.
- Link "MI CUENTA" en el dropdown de cuenta del Nav (desktop) y en el panel móvil, apuntando a `/account`.

**Fuera de scope (para specs futuros):**

- Redirigir de vuelta a la página originalmente pedida después del login (`?next=`). Hoy, tras loguearse, siempre se aterriza en `/`.
- Editar el perfil (renombrar nick, cambiar avatar) desde `/account` — por ahora es de solo lectura + logout.
- Historial de scores propios en `/account`.
- Migrar o limpiar los scores históricos guardados como `INVITADO` — quedan como están, son datos históricos válidos.

## Modelo de datos

No introduce estructuras nuevas. No toca `games` ni `scores`.

## Plan de implementación

1. Agregar a `proxy.ts` la función `isProtectedPath(pathname)` (`/games/`, `/account`, regex `^/game/[^/]+/play$`) y la lógica de redirect: sin sesión + ruta protegida → `/auth`; con sesión + `/auth` → `/` (copiando las cookies de `supabaseResponse` a la response de redirect, porque `getUser()` pudo haber rotado el token). Verificar: sin sesión, `/games/asteroids` redirige a `/auth`; con sesión, `/auth` redirige a `/`.
2. Crear `app/account/page.tsx` (client component, reusa `useUser()`), con fallback de redirect a `/auth` si por alguna razón se renderiza sin sesión. Verificar: logueado, `/account` muestra avatar/nombre/email y el botón de logout funciona.
3. Quitar `asGuest`/`JUGAR COMO INVITADO` de `app/auth/page.tsx` (y el import/uso ahora innecesario de `useUser`). Verificar: `tsc --noEmit` sin errores.
4. Agregar el link "MI CUENTA" al dropdown del Nav y al panel móvil. Verificar visual en el navegador.
5. `npm run build` y marcar el spec como Implementado.

## Criterios de aceptación

- [x] Sin sesión, navegar a `/games/asteroids` redirige a `/auth`.
- [x] Sin sesión, navegar a `/game/asteroids/play` redirige a `/auth`.
- [x] Sin sesión, navegar a `/account` redirige a `/auth`.
- [x] Sin sesión, `/library` y `/game/asteroids` (detalle) siguen siendo accesibles sin redirect.
- [x] Con sesión, navegar a `/auth` redirige a `/`.
- [x] Con sesión, `/account` muestra avatar (si el provider lo da), nombre y email de la cuenta, y "Cerrar sesión" funciona.
- [x] El botón "JUGAR COMO INVITADO" ya no existe en `/auth`.
- [x] El dropdown de cuenta del Nav y el panel móvil tienen un link a "MI CUENTA".
- [x] `npm run build` completa sin errores de TypeScript ni ESLint.

## Decisiones

- **Sí:** proteger por prefijo (`/games/`, regex de `/play`) en vez de listar cada juego. Razón: cualquier juego nuevo agregado vía `/add-game` queda protegido automáticamente, sin tocar `proxy.ts` de nuevo.
- **Sí:** dejar `/game/[id]` (detalle) y `/library`/`/hall`/`/about`/`/` públicos. Razón: el pedido fue proteger "jugar", no navegar el catálogo; browsear sin cuenta sigue siendo parte de la propuesta de valor.
- **Sí:** eliminar "JUGAR COMO INVITADO" en vez de dejarlo apuntando a la biblioteca. Razón: decisión explícita del usuario — simplifica la pantalla de auth y evita un botón que ya no cumple su función original.
- **No:** implementar `?next=` para volver a la página pedida tras el login. Razón: no se pidió; agregarlo implica tocar `proxy.ts`, `app/auth/page.tsx` y `app/auth/callback/route.ts` para algo que hoy es solo una molestia menor (un click extra), no un bloqueo.
- **No:** copiar cookies en el branch de redirect sin sesión. Razón: si `getUser()` devuelve `user: null` no hay token que rotar, por lo que un `NextResponse.redirect()` directo no pierde nada (mismo patrón que la plantilla oficial de `@supabase/ssr`).

## Riesgos

| Riesgo                                                                      | Mitigación                                                                                                                               |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Perder la rotación de cookies de sesión al redirigir `/auth` → `/`          | Se copian explícitamente las cookies de `supabaseResponse` a la response de redirect (ver paso 1).                                       |
| Un juego nuevo agregado vía `/add-game` queda sin proteger por olvido       | La protección es por prefijo `/games/`, no por id — cualquier ruta nueva bajo ese prefijo queda protegida sola.                          |
| `scores` con `player_name = 'INVITADO'` quedan "huérfanos" del flujo actual | No requieren migración: son datos históricos válidos, el fallback en el código de los juegos queda como guarda defensiva sin uso normal. |

## Lo que **no** está en este spec

- `?next=` para volver a la página original tras loguearse.
- Edición de perfil en `/account`.
- Historial de scores propios.
- Limpieza de scores `INVITADO` históricos.

Cada uno, si llega, va en su propio spec.
