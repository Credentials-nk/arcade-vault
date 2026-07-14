# SPEC 09 — Catálogo de juegos en Supabase

> **Estado:** Implementado · **Depende de:** 04-supabase-setup, 05-asteroids-game, 06-leaderboard, 08-bloque-buster-game · **Fecha:** 2026-07-14
> **Objetivo:** Mover el catálogo de juegos (`GAMES`) de `lib/data.ts` a una tabla `games` en Supabase, con `scores.game_id` referenciando `games.id` mediante clave foránea, y actualizar los cinco puntos de consumo actuales para leerlo desde ahí.

## Por qué existe este spec

Al revisar Supabase, el usuario notó que solo existe la tabla `scores` — no hay ninguna tabla `games`. Esto no es un olvido de los specs anteriores: el spec 06 lo consideró explícitamente y decidió **no** crearla ("es un MVP didáctico; el catálogo en `lib/data.ts` alcanza"). Este spec revisita esa decisión a pedido del usuario: quiere el catálogo persistido en Supabase y `scores.game_id` con integridad referencial real contra él, no solo un string libre coincidente por convención.

## Scope

**In:**

- Tabla `games` en Supabase (catálogo completo: título, descripciones, categoría, cover, color, `best`, `plays`, `play_route`, orden de visualización).
- Migración que crea la tabla, la siembra con las 7 entradas actuales de `GAMES` (mismos valores, mismo orden visual) y agrega la FK `scores.game_id → games.id`.
- RLS de solo lectura pública en `games` (sin insert/update/delete para el rol anónimo — el catálogo se sigue gestionando por migración, no por la app).
- Server Actions `app/actions/getGames.ts`: `getGames()` (catálogo completo) y `getGame(id)` (una entrada).
- Refactor de los 5 consumidores actuales de `GAMES` para leer de Supabase: `app/page.tsx`, `app/library/page.tsx`, `app/game/[id]/page.tsx`, `app/game/[id]/play/page.tsx`, `app/hall/page.tsx`.
- Eliminar el array `GAMES` de `lib/data.ts` (la interfaz `Game` se mantiene, ahora describe las filas que devuelven las Server Actions).
- Actualizar `.claude/skills/add-game/SKILL.md`: las referencias a "registrar el juego en `GAMES` (`lib/data.ts`)" pasan a "insertar una fila en la tabla `games` vía migración".

**Fuera de scope (para specs futuros):**

- Calcular `best`/`plays` dinámicamente a partir de `scores` reales. Son datos de "flavor" ya desactualizados desde los specs 05/07 (p. ej. Bloque Buster muestra `28.450` estático mientras el leaderboard real tiene `70`); es un problema real pero distinto — este spec solo traslada el catálogo, no corrige esa métrica.
- UI de administración para crear/editar juegos desde la app. El catálogo se sigue gestionando por migración, igual que hoy.
- Mover `CATS` (categorías de filtro) a la base — son un enum fijo de la UI, no contenido.
- Autenticación para escribir en `games`.
- Arreglar los datos ficticios de las filas de puntuación del Salón de la Fama (`seededScores` sigue siendo fake) — solo las pestañas (lista de juegos) del Salón de la Fama pasan a ser reales; las filas de puntaje dentro de cada pestaña son un gap preexistente sin relación con este spec.

## Modelo de datos

Esquema real confirmado con `list_tables` antes de escribir este spec — hoy solo existe `scores` (sin FK a nada), un único migration `create_scores_table`:

```sql
create table games (
  id          text primary key,
  title       text not null,
  short       text not null,
  long        text not null,
  cat         text not null,
  cover       text not null,
  color       text not null check (color in ('cyan','magenta','yellow','green')),
  best        integer not null default 0,
  plays       text not null default '0',
  play_route  text,
  sort_order  integer not null,
  created_at  timestamptz not null default now()
);

alter table games enable row level security;
create policy "public select" on games for select using (true);
-- Sin políticas de insert/update/delete: el rol anónimo no puede escribir.

-- Ejemplo de una de las 7 filas sembradas (el resto usa los valores actuales de GAMES):
insert into games (id, title, short, long, cat, cover, color, best, plays, play_route, sort_order) values
  ('bloque-buster', 'BLOQUE BUSTER', 'Rebota la pelota y destruye muros de neón.', '…', 'ARCADE', 'cover-bricks', 'cyan', 28450, '12.4K', '/games/bloque-buster', 0);

alter table scores
  add constraint scores_game_id_fkey foreign key (game_id) references games(id);
```

`sort_order` preserva el orden visual actual (0–6, el mismo orden en que hoy aparecen en el array `GAMES`); sin él, el orden de lectura de Postgres no está garantizado.

Tipo `Game` en `lib/data.ts` **no cambia de forma** — sigue siendo la interfaz que ya existe (`id, title, short, long, cat, cover, color, best, plays, playRoute?`). Lo que cambia es su origen: antes un array estático, ahora el resultado mapeado (`play_route` → `playRoute`) de `getGames()`/`getGame()`, igual al mapeo `player_name` → `playerName` que ya existe en `getLeaderboard.ts`.

## Plan de implementación

1. Crear rama `09-games-catalog-supabase` desde `main`.

2. Migración `create_games_table`: crear la tabla `games` con su policy de solo lectura, sembrar las 7 filas actuales de `GAMES` (mismos valores y orden que hoy tiene `lib/data.ts`) y agregar la FK `scores.game_id → games.id`.
   Verificar: `list_tables` (verbose) muestra `games` con la FK; `select * from games order by sort_order` devuelve las 7 filas en el orden visual actual.

3. Crear `app/actions/getGames.ts` con `'use server'`: `getGames(): Promise<Game[]>` (`order by sort_order asc`) y `getGame(id: string): Promise<Game | null>` (`.eq('id', id).maybeSingle()`), mapeando `play_route` → `playRoute`.
   Verificar: `tsc --noEmit` sin errores.

4. Refactor `app/game/[id]/page.tsx` (ya es Server Component async): reemplazar `GAMES.find((g) => g.id === id)` por `await getGame(id)`.
   Verificar: `/game/bloque-buster`, `/game/asteroids`, `/game/caida` y los 4 juegos sin `playRoute` siguen mostrando su ficha correctamente.

5. Refactor `app/game/[id]/play/page.tsx` (Client Component): agregar `useEffect` que llama `getGame(id)` a un `useState<Game | null>`, con estado de carga antes de decidir "juego no encontrado" vs. renderizar.
   Verificar: los 4 juegos sin engine propio (serpentina, glotón, invasores, rocas) siguen abriendo el placeholder `/game/[id]/play`.

6. Refactor `app/page.tsx` (home, Client Component): agregar `useState<Game[]>([])` + `useEffect` que llama `getGames()`, reemplazando `GAMES.slice(0, 6)` por `games.slice(0, 6)`. Mismo patrón ya usado en este archivo para `getGlobalLeaderboard` (spec 06).
   Verificar: la mini-rail de la home muestra las mismas 6 primeras cards que hoy.

7. Refactor `app/library/page.tsx` (Client Component): agregar `useState<Game[]>([])` + `useEffect` con `getGames()`; el `useMemo` de filtrado pasa a operar sobre ese estado en vez del array estático.
   Verificar: la búsqueda y los chips de categoría siguen filtrando igual.

8. Refactor `app/hall/page.tsx` (Client Component): agregar `useState<Game[]>([])` + `useEffect` con `getGames()`; el `tab` inicial pasa de `GAMES[0].id` a `''`, con un segundo `useEffect` que lo setea a `games[0]?.id` una vez cargan; guard de carga antes de las líneas que asumen `GAMES.find(...)!`.
   Verificar: las pestañas del Salón de la Fama muestran los mismos 7 títulos que hoy.

9. Eliminar el array `GAMES` de `lib/data.ts`. Mantener sin cambios: interfaz `Game`, `CATS`, `PLAYERS`, `TICKER_ROWS`, `seededScores`, `ScoreRow`, `LeaderboardEntry`.
   Verificar: ningún archivo importa `GAMES` de `lib/data.ts` (`grep -rn "GAMES" app/ lib/`).

10. Actualizar `.claude/skills/add-game/SKILL.md`: la sección "Contexto de sesión" deja de listar juegos hardcodeados (se consulta con `execute_sql`/`list_tables` en el momento), y el paso "Registrar el juego en `GAMES` (`lib/data.ts`) con `playRoute: '/games/<id>'`" pasa a "Insertar una fila en la tabla `games` vía migración, con `play_route = '/games/<id>'`".
    Verificar: el archivo no menciona editar `lib/data.ts` para registrar juegos nuevos.

11. Ejecutar `npm run build` y corregir errores de TypeScript o ESLint. Marcar este spec como `Implementado` y crear PR `09-games-catalog-supabase` → `main`.

## Criterios de aceptación

- [x] `list_tables` (verbose) muestra `games` con clave foránea `scores.game_id → games.id`.
- [x] `select * from games order by sort_order` devuelve las 7 entradas actuales en el mismo orden visual de hoy.
- [x] La home muestra las mismas 6 primeras mini-cards que hoy, ahora leídas desde Supabase.
- [x] `/library` busca y filtra por categoría igual que hoy, con datos desde Supabase.
- [x] `/game/[id]` y `/game/[id]/play` siguen funcionando para los 7 juegos del catálogo (los 3 jugables y los 4 placeholder). _(Verificado con `bloque-buster` y `serpentina`; el resto comparte el mismo código de página, sin ramas por id.)_
- [x] `/hall` muestra las mismas 7 pestañas (títulos) que tenía `GAMES`, ahora desde Supabase.
- [x] Intentar insertar en `scores` un `game_id` que no existe en `games` falla por la restricción de clave foránea.
- [x] `lib/data.ts` ya no exporta `GAMES`; ningún archivo lo importa.
- [x] `.claude/skills/add-game/SKILL.md` ya no instruye editar `lib/data.ts` para registrar un juego nuevo.
- [x] `npm run build` completa sin errores de TypeScript ni ESLint.

## Decisiones

- **Sí:** FK real `scores.game_id → games.id`. Razón: es el pedido explícito del usuario — cierra el gap de integridad que notó al revisar Supabase.
- **Sí:** RLS de solo lectura pública en `games`, sin políticas de escritura para el rol anónimo. Razón: el catálogo se gestiona por migración/admin, no por usuarios finales; ninguna funcionalidad actual necesita escribir ahí.
- **Sí:** columna `sort_order` explícita. Razón: preserva el orden visual actual sin depender de un orden de lectura que Postgres no garantiza sin `ORDER BY` sobre una columna dedicada.
- **Sí:** actualizar `.claude/skills/add-game/SKILL.md`. Razón: sin este cambio, el próximo spec que genere ese skill seguiría instruyendo "editar `lib/data.ts`", quedando desactualizado y rompiendo el flujo spec-driven para juegos futuros.
- **No:** calcular `best`/`plays` dinámicamente desde `scores` reales. Razón: es una mejora real pero distinta — corrige un dato ya desactualizado desde los specs 05/07, no algo que este spec rompa o deba resolver. Spec futuro si se decide abordarlo.
- **No:** mover `CATS` a la base de datos. Razón: son categorías de filtro fijas de la UI, no contenido versionable; no gana nada persistiéndolas.
- **No:** UI de administración del catálogo. Razón: fuera de scope del MVP; se sigue gestionando por migración como hasta ahora.
- **No:** arreglar `seededScores` en el Salón de la Fama. Razón: es un gap preexistente y no relacionado — este spec solo hace reales las _pestañas_ (lista de juegos), no las filas de puntaje dentro de cada una.

## Riesgos

| Riesgo                                                                                         | Mitigación                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La FK falla al aplicarse porque algún `scores.game_id` existente no coincide con `games.id`    | Verificar antes con `select distinct game_id from scores`; hoy la tabla tiene una sola fila (`game_id = 'bloque-buster'`), ya cubierta por el seed en el mismo paso. |
| Los Client Components (home, library, hall) muestran un parpadeo vacío mientras cargan `games` | Aceptable para el MVP; mismo patrón ya usado para el leaderboard en el spec 06. Podría resolverse a futuro convirtiéndolos a Server Components (spec propio).        |
| `hall/page.tsx` asume `GAMES[0]` de forma síncrona para el tab inicial                         | Se reescribe con estado inicial vacío (`tab = ''`) y un segundo `useEffect` que lo setea a `games[0]?.id` una vez resuelve la carga.                                 |
| Migrar `.claude/skills/add-game/SKILL.md` queda incompleto y deja instrucciones mixtas         | Revisar el archivo completo (no solo grep) antes de dar el paso 10 por cerrado; buscar todas las menciones a `lib/data.ts` en ese archivo, no solo la principal.     |

## Lo que **no** está en este spec

- `best`/`plays` calculados dinámicamente desde `scores` reales.
- UI de administración del catálogo.
- Autenticación para escribir en `games`.
- Mover `CATS` a la base de datos.
- Arreglar los datos ficticios de las filas de puntuación del Salón de la Fama (`seededScores`).

Cada uno, si llega, va en su propio spec.
