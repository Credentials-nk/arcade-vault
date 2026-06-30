# SPEC 05 — Integración del juego Asteroids

> **Estado:** Implementado · **Depende de:** 01-mvp-screens, 04-supabase-setup · **Fecha:** 2026-06-30
> **Objetivo:** Adaptar el juego Asteroids (HTML5 Canvas, ~420 líneas JS) como página `/games/asteroids` en Next.js, con HUD de plataforma sincronizado con el estado interno del canvas, canvas responsivo y guardado de puntuaciones anónimas en Supabase.

## Scope

**In:**

- Migración de `references/started-games/02-asteroids/game.js` a TypeScript (`lib/games/asteroids/game.ts`).
- Componente cliente `components/games/asteroids/AsteroidsGame.tsx` con:
  - Canvas responsivo (escala visual CSS manteniendo aspect ratio 4:3 del original 800×600).
  - HUD interior del canvas (score/vidas renderizados por el propio engine, sin cambios).
  - Bridge de estado: el engine llama callbacks `onScore`, `onLives`, `onLevel`, `onGameOver` para notificar a React.
- Página `app/games/asteroids/page.tsx` con:
  - HUD exterior de plataforma (jugador, puntuación, vidas, nivel) sobre el canvas, siguiendo el diseño de `references/templates/reproductor.jsx`.
  - Botones PAUSA y SALIR fuera del canvas.
  - Modal Game Over con input de nombre/iniciales (máx. 10 chars) y botón "Guardar puntuación".
- Migración Supabase: tabla `scores (id, game_id, player_name, score, created_at)`.
- Server Action `app/actions/saveScore.ts` para insertar una fila en `scores` sin auth requerida.
- Tarjeta de Asteroids en la home screen: nueva entrada en `GAMES` (`lib/data.ts`) con campo `playRoute` que apunta a `/games/asteroids`.

**Fuera de scope:**

- Autenticación — spec futuro; en este spec el nombre es texto libre.
- Leaderboard / Salón de la Fama — spec futuro.
- Controles táctiles / mobile — spec futuro.
- Otros juegos (Tetris, Arkanoid) — specs futuros.
- Niveles de dificultad progresiva o power-ups — spec futuro.
- Guardar estado de partida en curso para continuar después.
- localStorage como fallback si Supabase falla.

## Modelo de datos

### Tabla Supabase — `scores`

```sql
create table scores (
  id          uuid        primary key default gen_random_uuid(),
  game_id     text        not null,
  player_name text        not null check (char_length(player_name) <= 10),
  score       integer     not null check (score >= 0 and score < 9999999),
  created_at  timestamptz not null default now()
);

-- Política RLS para inserts anónimos
alter table scores enable row level security;
create policy "public insert" on scores for insert with check (true);
create policy "public select" on scores for select using (true);
```

### Interfaz `Game` — extensión en `lib/data.ts`

```ts
export interface Game {
  // campos existentes sin cambios
  id: string;
  title: string;
  cat: string;
  cover: string;
  long: string;
  plays: number;
  best: number;
  playRoute?: string; // nuevo — si está presente, la mini-card navega aquí en vez de /game/[id]
}
```

Nueva entrada en el array `GAMES`:

```ts
{
  id: "asteroids",
  title: "ASTEROIDS",
  cat: "SHOOTER",
  cover: "cover-asteroids",
  long: "Destruye los asteroides antes de que te destruyan. Los grandes se parten en medianos, los medianos en pequeños.",
  plays: 0,
  best: 0,
  playRoute: "/games/asteroids",
}
```

### Bridge de estado canvas → React

```ts
export interface AsteroidsCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

El constructor del engine acepta `(canvas: HTMLCanvasElement, cb: AsteroidsCallbacks)`.

## Plan de implementación

1. **Crear rama** `05-asteroids-game` desde `main`.

2. **Migración Supabase** — crear tabla `scores`:
   Aplicar la sentencia SQL del modelo de datos vía `mcp__supabase__apply_migration`.
   Verificar: `mcp__supabase__list_tables` muestra `scores`.

3. **Server Action** — `app/actions/saveScore.ts`:

   ```ts
   'use server';
   export async function saveScore(gameId: string, playerName: string, score: number) { ... }
   ```

   Usa el server client de `lib/supabase/server.ts` para insertar en `scores`.
   Verificar: `tsc --noEmit` sin errores.

4. **Migrar engine** — `lib/games/asteroids/game.ts`:
   - Copiar `references/started-games/02-asteroids/game.js` y convertir a TypeScript estricto.
   - Tipar todas las clases (`Bullet`, `Asteroid`, `Ship`, `Particle`) y los globales de estado.
   - Añadir `AsteroidsCallbacks` al constructor; llamar cada callback en los puntos exactos donde el engine original muta `score`, `lives`, `level` y entra en estado `'gameover'`.
   - El canvas se recibe como `HTMLCanvasElement` (no busca por ID en el DOM).
   - Añadir método `destroy()` que cancela el `requestAnimationFrame` y elimina los listeners de teclado.
   - Añadir método `setPaused(paused: boolean)` que detiene/reanuda el loop.
     Verificar: `tsc --noEmit` sin errores.

5. **Componente canvas** — `components/games/asteroids/AsteroidsGame.tsx`:
   - Directiva `'use client'`.
   - `useRef<HTMLCanvasElement>` para el elemento canvas.
   - `useEffect` instancia el engine con el ref y los callbacks; retorna `() => engine.destroy()`.
   - Canvas con atributos `width={800} height={600}` y estilos `width: 100%; height: auto; max-width: 800px` para escalar sin tocar la lógica de colisiones.
     Verificar: el juego arranca y los callbacks disparan cambios de estado visibles.

6. **Página del juego** — `app/games/asteroids/page.tsx`:
   - HUD exterior (sobre el canvas) con jugador ("INVITADO"), puntuación, vidas (♥), nivel — siguiendo el diseño de `references/templates/reproductor.jsx`.
   - Botón PAUSA: alterna estado `paused` en React y llama `engine.setPaused(paused)`.
   - Botón SALIR: `router.push('/library')` — el `useEffect` cleanup destruye el engine.
   - `AsteroidsGame` recibe los callbacks que actualizan el estado React del HUD.
   - Modal Game Over (visible cuando `onGameOver` dispara):
     - Puntuación final.
     - Input de nombre/iniciales (máx. 10 chars, forzado a mayúsculas).
     - Botón "GUARDAR PUNTUACIÓN" → llama `saveScore`, muestra confirmación.
     - Botón "JUGAR DE NUEVO" → reinicia el engine (nueva instancia).
     - Botón "VOLVER AL VAULT" → `router.push('/library')`.
       Verificar: el HUD React refleja el estado interno del canvas en tiempo real.

7. **Home screen** — `lib/data.ts` y `app/page.tsx`:
   - Añadir campo `playRoute?: string` a la interfaz `Game` en `lib/data.ts`.
   - Añadir la entrada `asteroids` al array `GAMES`.
   - En `MiniCard` (`app/page.tsx`), actualizar el `onClick` para usar `game.playRoute ?? \`/game/${game.id}\``.
   - Añadir clase CSS `cover-asteroids` en la hoja de estilos global (fondo negro con estética espacial).
     Verificar: la mini-card "ASTEROIDS" aparece en la home y navega a `/games/asteroids`.

8. **Build y PR**:
   Ejecutar `npm run build` y corregir errores de TypeScript o ESLint.
   Marcar spec como `Implementado` y crear PR `05-asteroids-game` → `main`.

## Criterios de aceptación

- [ ] `npm run build` completa sin errores de TypeScript ni ESLint.
- [ ] La tabla `scores` existe en Supabase con los campos `id`, `game_id`, `player_name`, `score`, `created_at`.
- [ ] Navegar a `/games/asteroids` muestra la página con el HUD exterior y el canvas.
- [ ] El juego arranca automáticamente al cargar la página sin click adicional.
- [ ] El HUD exterior muestra jugador, puntuación, vidas y nivel actualizados en tiempo real conforme el engine cambia su estado interno.
- [ ] El canvas se escala para no desbordar el viewport en pantallas pequeñas manteniendo proporción 4:3; en pantallas grandes se muestra a 800×600 máximo.
- [ ] El botón PAUSA detiene el juego; pulsarlo de nuevo lo reanuda.
- [ ] El botón SALIR navega a `/library` y destruye el engine (sin loops en background).
- [ ] Al perder las 3 vidas aparece el modal Game Over con la puntuación final.
- [ ] El input de nombre en el modal acepta máximo 10 caracteres y los convierte a mayúsculas.
- [ ] Pulsar "GUARDAR PUNTUACIÓN" inserta una fila en `scores` y muestra confirmación sin requerir autenticación.
- [ ] Pulsar "JUGAR DE NUEVO" cierra el modal y reinicia el juego desde cero.
- [ ] Pulsar "VOLVER AL VAULT" navega a `/library`.
- [ ] La mini-card "ASTEROIDS" aparece en la sección "JUEGOS DISPONIBLES AHORA" de la home.
- [ ] Hacer click en la mini-card navega a `/games/asteroids`.
- [ ] La lógica de colisiones del engine no se ve afectada por el escalado visual del canvas.

## Decisiones

- **Sí:** Migrar `game.js` a TypeScript estricto. Razón: coherencia con el stack; el linter rechazaría un `.js` con implícitos en un proyecto strict.
- **Sí:** Bridge de callbacks (`onScore` / `onLives` / `onLevel` / `onGameOver`) en lugar de un store global. Razón: mínima superficie de acoplamiento entre el engine canvas y React; evita dependencias externas para un estado local de partida.
- **Sí:** Escalado visual vía CSS (`width: 100%; max-width: 800px`), sin cambiar la resolución interna del canvas. Razón: la lógica de colisiones usa coordenadas absolutas 800×600; cambiarlas requeriría refactorizar todos los `RADII`, `SPEEDS` y el `wrap()`.
- **Sí:** Scores guardados sin auth (nombre libre, máx. 10 chars). Razón: auth es spec futuro; bloquear el guardado hasta tener auth excluiría a todos los usuarios en esta iteración.
- **Sí:** Campo `playRoute?: string` en la interfaz `Game`. Razón: los juegos futuros (Tetris, Arkanoid) seguirán el mismo patrón `/games/[slug]`; un campo opcional es menos disruptivo que cambiar la ruta genérica `/game/[id]` existente.
- **Sí:** Método `engine.destroy()` al desmontar el componente. Razón: sin él, el `requestAnimationFrame` loop y los listeners de teclado quedan activos al navegar, causando leaks y bugs de input en otras páginas.
- **No:** Pausa automática al cambiar de pestaña (Page Visibility API). Razón: el engine ya capea el drift con el tope de 50ms en `dt`; la complejidad no justifica el beneficio en este spec.
- **No:** localStorage como fallback si Supabase falla. Razón: añade lógica de sincronización fuera del scope; si el insert falla, la UI muestra el error y el usuario puede reintentar.

## Riesgos

| Riesgo                                                                                                                                           | Mitigación                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript strict en el engine: el `game.js` original usa mutación de globales e implícitos — la migración puede ser más extensa de lo esperado. | Tipar primero las clases (`Ship`, `Asteroid`, etc.) y los callbacks; dejar los globales de estado como último paso. Usar `as unknown as T` con comentario solo si un tipo es genuinamente irresoluble; nunca desactivar strict globalmente. |
| El método `setPaused()` no existe en la referencia original.                                                                                     | Añadir un flag `paused` al game loop en el paso 4; el loop ya detiene la lógica al no llamar `update()` cuando está pausado.                                                                                                                |
| `saveScore` sin auth permite spam de puntuaciones falsas.                                                                                        | Aceptable en este spec; la validación se diseña en el spec de auth y leaderboard. El constraint `score < 9_999_999` en la migración actúa como guardia mínima.                                                                              |
| RLS en Supabase puede bloquear inserts anónimos si no se configura correctamente.                                                                | La migración incluye explícitamente `create policy "public insert" on scores for insert with check (true)`.                                                                                                                                 |

## Lo que NO está en este spec

- Autenticación de usuarios.
- Leaderboard o Salón de la Fama.
- Controles táctiles para mobile.
- Otros juegos (Tetris, Arkanoid, Snake).
- Guardado de partida en curso para continuar después.

Cada uno de esos, si llega, va en su propio spec.
