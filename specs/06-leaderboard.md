# SPEC 06 — Leaderboard conectado a Supabase

> **Estado:** Implementado · **Depende de:** 04-supabase-setup, 05-asteroids-game · **Fecha:** 2026-07-13
> **Objetivo:** Leer las puntuaciones reales de la tabla `scores` de Supabase para mostrar un leaderboard por juego y un ranking global, reemplazando los datos ficticios que hoy se muestran.

## Por qué existe este spec

El spec 05 dejó la **escritura** de puntuaciones funcionando: el modal de _game over_ de Asteroids captura el nombre del jugador y `saveScore()` inserta en la tabla `scores` de Supabase. Pero **nadie lee** esos datos: el panel de "MEJORES PUNTUACIONES" en `app/game/[id]/page.tsx` usa `seededScores()` (datos semilla ficticios) y el bloque "TOP JUGADORES · HOY" de la home usa `TOP_TODAY` (array hardcodeado). Este spec cierra el círculo: conecta la lectura.

## Scope

**In:**

- Server Actions de lectura en `app/actions/getLeaderboard.ts`:
  - `getGameLeaderboard(gameId, limit = 10)` → Top N de un juego (`scores` filtrado por `game_id`, ordenado por `score` desc).
  - `getGlobalLeaderboard(limit = 10)` → Top N global (todos los `game_id`, ordenado por `score` desc).
- Tipo `LeaderboardEntry` en `lib/data.ts`.
- Reemplazar `seededScores()` en `app/game/[id]/page.tsx` por el Top N real del juego.
- Reemplazar `TOP_TODAY` en `app/page.tsx` por el Top N global real.
- **Estado vacío**: cuando un juego (o el global) no tiene puntuaciones, mostrar un placeholder ("Sé el primero en puntuar") en vez de tabla vacía o error.

**Fuera de scope (para specs futuros):**

- Tabla `games` de catálogo en la BD. El catálogo sigue hardcodeado en `lib/data.ts` (alcanza para el MVP).
- Captura del nombre del jugador: **ya implementada** en el spec 05 (modal _game over_, input "TUS INICIALES", fallback `INVITADO`). No se toca.
- El _ticker_ de actividad reciente (`TICKER_ROWS`) de la home — es "últimas partidas", no leaderboard.
- Autenticación / cuentas de usuario reales.
- Realtime (que el leaderboard se actualice solo sin recargar).
- Paginación o scroll infinito del ranking.

## Modelo de datos

Reutiliza la tabla `scores` existente (creada implícitamente por el spec 05). **No se crea ninguna tabla nueva.** Columnas asumidas:

```
scores
  id           bigint / uuid  (PK)
  game_id      text
  player_name  text
  score        int
  created_at   timestamptz    (default now())
```

En el paso 1 se confirma el esquema real con `list_tables`. Si `created_at` no existe, una migración lo agrega con default `now()`.

Nuevo tipo para las filas ya normalizadas que consumen las páginas:

```ts
// lib/data.ts
export interface LeaderboardEntry {
  rank: number; // calculado en el server tras ordenar (1, 2, 3, …)
  playerName: string; // scores.player_name
  score: number; // scores.score
  date: string; // scores.created_at formateado dd/mm/yyyy
  gameId: string; // scores.game_id (útil en el ranking global)
}
```

## Plan de implementación

1. Crear rama `06-leaderboard` desde `main`. Confirmar el esquema real de `scores` con `list_tables`; si falta `created_at`, aplicar migración `add-scores-created-at` (columna `timestamptz` default `now()`).

2. Agregar el tipo `LeaderboardEntry` en `lib/data.ts`.
   Verificar: `tsc --noEmit` sin errores.

3. Crear `app/actions/getLeaderboard.ts` con `'use server'`:
   - `getGameLeaderboard(gameId, limit)`: `select` sobre `scores` con `.eq('game_id', gameId).order('score', { ascending: false }).limit(limit)`.
   - `getGlobalLeaderboard(limit)`: igual sin filtro de `game_id`.
   - Ambas mapean a `LeaderboardEntry[]`, asignando `rank` por posición y formateando `created_at` a `dd/mm/yyyy`.
     Verificar: type-check ok; probar la query en la fase de implementación contra Supabase.

4. Refactorizar `app/game/[id]/page.tsx` a **Server Component** async:
   - Recibir `params`, hacer `await getGameLeaderboard(id, 10)`, eliminar `"use client"`, `useParams` y `seededScores`.
   - Renderizar el placeholder de estado vacío cuando no hay filas.
     Verificar: `/game/asteroids` muestra puntuaciones reales o el placeholder.

5. Conectar la home `app/page.tsx` (sigue siendo Client Component): `useState` + `useEffect` que llama `getGlobalLeaderboard(10)` al montar, reemplazando `TOP_TODAY.map(...)`. Placeholder si el ranking está vacío.
   Verificar: el bloque "TOP JUGADORES · HOY" muestra datos reales.

6. Eliminar de `lib/data.ts` `seededScores()` y `TOP_TODAY` si quedan sin uso (verificar que ningún otro archivo los importe).
   Verificar: `npm run build` sin errores.

7. Ejecutar `npm run build` y corregir errores de TypeScript o ESLint. Marcar este spec como `Implementado` y crear PR `06-leaderboard` → `main`.

## Criterios de aceptación

- [ ] `/game/asteroids` muestra las puntuaciones realmente guardadas en Supabase, ordenadas de mayor a menor.
- [ ] Guardar una partida nueva y recargar `/game/asteroids` hace aparecer esa puntuación en la tabla.
- [ ] La home ("TOP JUGADORES · HOY") muestra las mejores puntuaciones reales cruzando todos los juegos.
- [ ] Un juego sin puntuaciones muestra el placeholder de estado vacío, no una tabla vacía ni un error.
- [ ] Ningún dato visible del leaderboard proviene de `seededScores()` ni de `TOP_TODAY` hardcodeado.
- [ ] El rank mostrado (#01, #02, …) es consecutivo y coherente con el orden por `score`.
- [ ] `npm run build` completa sin errores de TypeScript ni ESLint.

## Decisiones

- **Sí:** reutilizar la tabla `scores` existente; **no** crear tabla `games` de catálogo. Razón: es un MVP didáctico; el catálogo en `lib/data.ts` alcanza y reduce superficie.
- **Sí:** Server Actions en `app/actions/getLeaderboard.ts` para la lectura. Razón: reutilizan el server client ya existente y se pueden invocar tanto desde Server Components (`game/[id]`) como desde Client Components (home) sin duplicar lógica.
- **Sí:** `app/game/[id]/page.tsx` pasa a Server Component. Razón: solo contenía `Link`s, sin estado local; el fetch server-side es más simple y evita el _flash_ de contenido.
- **Sí:** la home usa `useEffect` + `useState`. Razón: es un Client Component grande con animaciones (`useReveal`, `useRouter`); envolverlo en un Server Component sería un refactor mayor sin valor para el MVP.
- **No:** captura de nombre en este spec. Razón: ya está implementada en el spec 05.
- **No:** Realtime, paginación ni índice dedicado en `scores`. Razón: volumen trivial en el MVP; cada uno tendría su propio spec si el proyecto escala.
- **Definición rápida sin clarificación exhaustiva.** El usuario delegó las decisiones de forma explícita por tratarse de un MVP para practicar el flujo Spec Driven Design. Los defaults (Top N = 10, fallback `INVITADO`) quedan documentados aquí.

## Riesgos

| Riesgo                                                                 | Mitigación                                                                                   |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| La tabla `scores` no tiene `created_at` → la fecha no se puede mostrar | Verificar el esquema en el paso 1; migración agrega la columna con default `now()`.          |
| Server Action llamada desde `useEffect` hace un POST en cada montaje   | Aceptable para el MVP; a futuro se puede mover a Server Component o cachear (spec propio).   |
| `game_id` sin catálogo en el ranking global (muestra el id crudo)      | Mapear opcionalmente `gameId` → título usando `GAMES`; si no está, mostrar el `id` tal cual. |

## Lo que **no** está en este spec

- Tabla `games` de catálogo en la base de datos.
- Autenticación / cuentas de usuario reales.
- Realtime en el leaderboard.
- Paginación del ranking.
- El _ticker_ de actividad reciente de la home.

Cada uno de esos, si llega, va en su propio spec.
