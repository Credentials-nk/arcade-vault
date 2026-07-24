# SPEC 12 — Autenticación (registro, login, OAuth)

> **Estado:** Aprobado · **Depende de:** 04-supabase-setup, 09-games-catalog-supabase · **Fecha:** 2026-07-24
> **Objetivo:** Reemplazar la auth mockeada de `localStorage` (`hooks/useUser.ts`) por Supabase Auth real — registro y login por email/contraseña, login OAuth con Google y GitHub, y logout — cableando la UI ya existente en `app/auth/page.tsx` sin tocar el sistema de scores.

## Por qué existe este spec

El spec 04 dejó la autenticación explícitamente fuera de scope ("Autenticación (registro, login, logout) — spec futuro") y dejó lista la plomería para cuando llegara: `proxy.ts` ya ejecuta `supabase.auth.getUser()` en cada request para refrescar la sesión, y los clientes de `lib/supabase/` ya usan el adaptador de cookies `getAll`/`setAll` que Supabase Auth necesita. Hoy, sin embargo, `hooks/useUser.ts` es un mock: guarda `{ name }` en `localStorage` bajo la clave `av_user`, y `login(name)` acepta **cualquier string** sin password ni validación. La página `/auth` ya tiene la UI completa (tabs "Iniciar sesión"/"Crear cuenta", campos usuario/email/contraseña, botones Google/GitHub) pero el submit ignora email y contraseña, y los botones sociales no tienen `onClick`. Este spec cablea esa UI contra Supabase Auth de verdad.

## Scope

**In:**

- Registro por email/contraseña (`supabase.auth.signUp`) guardando el nick elegido en `options.data.username`.
- Login por email/contraseña (`supabase.auth.signInWithPassword`).
- Login OAuth con **Google** y **GitHub** (`supabase.auth.signInWithOAuth`) usando los botones ya existentes en `app/auth/page.tsx`.
- Ruta de callback OAuth `app/auth/callback/route.ts` (flujo PKCE: intercambia el `code` por sesión y redirige).
- Logout real (`supabase.auth.signOut()`).
- Reescritura de `hooks/useUser.ts` para leer la sesión real de Supabase (`getUser()` + `onAuthStateChange`) en vez de `localStorage`, preservando la superficie `{ user, signOut }` que ya consumen `NavWrapper`, `app/auth/page.tsx` y `app/hall/page.tsx` (se agrega `isLoading`; se retira `login`, ver Decisiones).
- `components/Nav.tsx` reflejando el estado real (logueado / cargando / invitado) sin el "flash" de logout que hoy ocurre mientras hidrata.
- Modo invitado preservado: "JUGAR COMO INVITADO" sigue navegando a `/` sin sesión; los scores sin sesión siguen guardándose como `INVITADO`.
- Pre-carga del nick del usuario logueado como valor inicial del campo de nombre en el modal de game-over de los 5 juegos (`asteroids`, `caida`, `bloque-buster`, `serpentina`, `frogger`), sin tocar la llamada a `saveScore` en sí.
- Prerrequisito de configuración en el dashboard de Supabase (no código): desactivar "Confirm email", habilitar los providers Google/GitHub, y agregar `http://localhost:3000/auth/callback` a las Redirect URLs.

**Fuera de scope (para specs futuros):**

- Vincular `scores` a la identidad del usuario (`scores.user_id` + FK a `auth.users` + RLS de ownership). Este spec no toca la tabla `scores`; el nick sigue viajando como string libre en `saveScore(gameId, playerName, score)`, igual que hoy.
- Tabla `profiles` y edición de perfil después del registro.
- Recuperación / reset de contraseña.
- Verificación de email obligatoria (se auto-confirma, ver Decisiones).
- Rutas protegidas / gating de contenido por sesión — la app sigue siendo 100% jugable como invitado, igual que hoy.
- Arreglar los datos ficticios de las filas de puntuación del Salón de la Fama (`seededScores`); es un gap preexistente y no relacionado (ya señalado como fuera de scope en el spec 09).

## Modelo de datos

No se crean tablas nuevas. Se usa `auth.users`, administrada por Supabase Auth. El nick que hoy vive en `localStorage` pasa a `user_metadata.username` (poblado en el `signUp` por email/contraseña vía `options.data`).

```ts
// lib/auth.ts
export interface AuthUser {
  id: string;
  email: string | null;
  name: string; // igual que el `User.name` actual: max 10 chars, mayúsculas
}
```

OAuth (Google/GitHub) no pasa por el formulario de registro, así que no puebla `user_metadata.username`. `resolveDisplayName` resuelve el nick con fallback, en este orden: `user_metadata.username` → `user_metadata.full_name` / `user_metadata.name` (lo que setean Google/GitHub) → parte local del email (antes de `@`) → `"INVITADO"`. Siempre normalizado con `.toUpperCase().slice(0, 10)`, igual que el `login()` actual.

`scores` no cambia de forma: sigue siendo `game_id, player_name, score, created_at`, sin `user_id`.

## Plan de implementación

1. Crear rama `12-autenticacion` desde `main`.

2. Prerrequisito de configuración en el dashboard de Supabase (sin commit propio, se hace antes de probar los pasos siguientes):
   - Authentication → Settings: desactivar "Confirm email".
   - Authentication → Providers: habilitar Google y GitHub con su client ID/secret.
   - Authentication → URL Configuration → Redirect URLs: agregar `http://localhost:3000/auth/callback`.
     Verificar: en el dashboard, ambos providers aparecen "Enabled" y la redirect URL está en la lista.

3. Crear `lib/auth.ts` con el tipo `AuthUser` y la función `resolveDisplayName(user: User)` (recibe el `User` de `@supabase/supabase-js`, aplica el fallback de la sección anterior).
   Verificar: `tsc --noEmit` sin errores.

4. Crear `app/auth/actions.ts` (`'use server'`) con tres Server Actions: `signInWithEmail(email, password)`, `signUpWithEmail(email, password, username)` (pasa `options: { data: { username } }` a `signUp`) y `signOutAction()`. Las tres usan `createClient()` de `lib/supabase/server.ts`, devuelven `{ error: string } | { error: null }` en vez de lanzar excepción (para que el formulario pueda mostrar el mensaje sin un error boundary), y en éxito hacen `redirect('/')`.
   Verificar: `tsc --noEmit` sin errores; probar manualmente `signUpWithEmail` con un email nuevo crea el usuario en `auth.users` (confirmable con `execute_sql` o el dashboard).

5. Crear `app/auth/callback/route.ts` (Route Handler `GET`): toma `code` de `searchParams`, llama `supabase.auth.exchangeCodeForSession(code)` con el cliente server, y redirige a `/` (o al `next` si viene en el query string).
   Verificar: iniciar el flujo OAuth manualmente y confirmar que vuelve logueado a `/`.

6. Reescribir `hooks/useUser.ts`: usa el browser client (`lib/supabase/client.ts`), llama `supabase.auth.getUser()` en el mount y se suscribe a `supabase.auth.onAuthStateChange` para mantener el estado sincronizado (incluye el retorno de OAuth). Expone `{ user: AuthUser | null, isLoading: boolean, signOut }`; `signOut` llama a la Server Action `signOutAction()` (o `supabase.auth.signOut()` desde el cliente, lo que evite un round-trip extra) y limpia el estado local. Se retira `login` (ver Decisiones) — ya no aplica, el login pasa por las Server Actions del paso 4.
   Verificar: `tsc --noEmit` sin errores; los 3 consumidores actuales (`NavWrapper`, `app/auth/page.tsx`, `app/hall/page.tsx`) se ajustan a la nueva firma.

7. Actualizar `components/Nav.tsx` y `components/NavWrapper.tsx`: el tipo `User` local de `Nav.tsx` pasa a importar `AuthUser`; se agrega el estado `isLoading` (mientras carga, no mostrar ni "Iniciar Sesión" ni el nombre, para eliminar el flash); el botón de logout llama al nuevo `signOut`.
   Verificar: recargar cualquier página logueado no muestra un parpadeo de "Iniciar Sesión" antes del nombre.

8. Reescribir el `submit` de `app/auth/page.tsx`: por tab, llama a `signInWithEmail` o `signUpWithEmail` (pasando el campo "Usuario" como `username`), muestra el `error` devuelto en el formulario en vez de ignorarlo. Cablear los botones GOOGLE/GITHUB con `onClick` → `supabase.auth.signInWithOAuth({ provider: 'google' | 'github', options: { redirectTo: `${origin}/auth/callback` } })` desde el browser client. "JUGAR COMO INVITADO" sigue llamando a `signOut()` (o simplemente navegando a `/` sin loguear) y no cambia de comportamiento.
   Verificar manual: registrarse con email/contraseña nuevos entra logueado sin confirmar email; loguearse con credenciales inválidas muestra un error y no navega; Google y GitHub redirigen y vuelven logueados.

9. En los 5 game pages (`app/games/{asteroids,caida,bloque-buster,serpentina,frogger}/page.tsx`), inicializar el estado `playerName` del modal de game-over con `user?.name ?? ''` cuando `useUser()` devuelve sesión, conservando el fallback existente (`av_player_name` en frogger, `''`/`INVITADO` en el resto) cuando no hay sesión. No se toca la firma de `saveScore`.
   Verificar: logueado, abrir cualquiera de los 5 juegos y llegar a game-over muestra el nick de la cuenta pre-cargado en el input.

10. Ejecutar `npm run build` y corregir errores de TypeScript o ESLint. Marcar este spec como `Implementado` y crear PR `12-autenticacion` → `main`.

## Criterios de aceptación

- [ ] Registrarse con email + contraseña + usuario crea la cuenta en `auth.users`, con `user_metadata.username` seteado, y deja sesión activa sin necesidad de confirmar el email.
- [ ] Loguearse con email/contraseña válidos entra y redirige a `/`; con credenciales inválidas muestra un mensaje de error y no navega.
- [ ] Los botones GOOGLE y GITHUB inician el flujo OAuth y, tras autorizar, vuelven a la app logueados vía `/auth/callback`.
- [ ] `components/Nav.tsx` muestra `user.name ▾` cuando hay sesión e "Iniciar Sesión" cuando no, sin parpadeo intermedio al recargar.
- [ ] Cerrar sesión limpia la sesión de Supabase (cookies) y el Nav vuelve a mostrar "Iniciar Sesión".
- [ ] "JUGAR COMO INVITADO" navega a `/` sin crear sesión; guardar un score sin sesión sigue usando `INVITADO` como fallback.
- [ ] Logueado, el input de nombre del modal de game-over de los 5 juegos aparece pre-cargado con el nick de la cuenta (máx. 10 caracteres, mayúsculas).
- [ ] `saveScore` y la tabla `scores` no cambian de forma respecto a hoy.
- [ ] `hooks/useUser.ts` ya no lee ni escribe `localStorage` (`av_user`).
- [ ] `npm run build` completa sin errores de TypeScript ni ESLint.

## Decisiones

- **Sí:** OAuth Google/GitHub en este mismo spec. Razón: los botones ya existen en la UI (`app/auth/page.tsx:92-95`), solo faltaba el `onClick`; dejarlo fuera hubiera significado tocar la misma página dos veces.
- **Sí:** auto-confirmar el email (desactivar "Confirm email" en el dashboard). Razón: es un arcade, no una app con datos sensibles; pedir verificación por email agrega fricción y un flujo entero (estado "pendiente de confirmación", reenvío) sin beneficio real para el MVP.
- **Sí:** guardar el nick en `user_metadata.username` en vez de una tabla `profiles`. Razón: alcanza para el MVP, sin migración ni trigger; el precedente (spec 09) ya mostró que este proyecto prefiere el camino más simple cuando no hay necesidad concreta de una tabla nueva.
- **Sí:** retirar `login(name: string)` de `useUser` en vez de mantenerlo en paralelo. Razón: su contrato (loguear con solo un nombre, sin password) es exactamente el mock que este spec reemplaza; mantenerlo sería dejar una puerta trasera a la auth falsa.
- **No:** vincular `scores.user_id` a `auth.users`. Razón: es un cambio de schema + RLS + tocar los 5 game pages y `saveScore`; se prefiere un spec propio (13) una vez que la auth esté validada en producción, no como parte del spec que la introduce.
- **No:** tabla `profiles` con trigger. Razón: patrón canónico de Supabase pero más infraestructura de la que este MVP necesita hoy; se reconsidera si el registro de nick por `user_metadata` queda corto (p. ej. si se quiere permitir renombrarse).
- **No:** recuperación de contraseña. Razón: no bloquea el flujo principal (registro/login/logout); es un caso de borde que puede resolverse en un spec chico aparte.
- **No:** proteger rutas por sesión. Razón: rompería el principio actual del catálogo (todo jugable sin cuenta); no hay pedido de negocio para restringir nada todavía.

## Riesgos

| Riesgo                                                                                             | Mitigación                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| OAuth requiere configuración fuera del código (client ID/secret de Google y GitHub, redirect URLs) | Paso 2 del plan lo deja explícito como prerrequisito verificable antes de tocar código; validar primero el flujo email/contraseña, que no depende de esto. |
| El nick no viene poblado en `user_metadata.username` para logins OAuth                             | `resolveDisplayName` en `lib/auth.ts` cae a `full_name`/`name` del provider y, si tampoco existe, al prefijo del email — nunca deja el nombre vacío.       |
| Flash de estado "deslogueado" mientras `useUser` resuelve la sesión al hidratar                    | Se agrega `isLoading` a `useUser`; `Nav.tsx` no renderiza ni el botón de cuenta ni "Iniciar Sesión" hasta que resuelve.                                    |
| `exchangeCodeForSession` falla o el `code` es inválido/expirado                                    | `app/auth/callback/route.ts` redirige a `/auth` con un query param de error en vez de dejar la request colgada o crashear.                                 |
| Server Actions que lanzan en vez de devolver error rompen la UX del formulario                     | Las tres Server Actions del paso 4 devuelven `{ error: string                                                                                              | null }`explícito; el formulario nunca depende de un`try/catch` para mostrar el mensaje. |

## Lo que **no** está en este spec

- `scores.user_id` / FK a `auth.users` / RLS de ownership sobre `scores`.
- Tabla `profiles` o edición de perfil.
- Recuperación / reset de contraseña.
- Verificación de email obligatoria.
- Rutas protegidas por sesión.
- Arreglar los datos ficticios del Salón de la Fama (`seededScores`).

Cada uno, si llega, va en su propio spec.
