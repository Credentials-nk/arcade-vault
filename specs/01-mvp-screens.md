# SPEC 01 — MVP visual de Arcade Vault: pantallas y navegación

> **Estado:** Implementado  · **Depende de:** — · **Fecha:** 2026-06-22
> **Objetivo:** Implementar las 6 pantallas visuales del MVP (Biblioteca, Detalle, Reproductor, Auth, Salón de la Fama, Nav) en Next.js App Router con datos mock y auth simulada en localStorage, sin lógica de juego real.

## Scope

**In:**

- Componente `Nav` global con menú desktop y mobile, estado activo por ruta, contador de créditos y botón de auth.
- Pantalla `Biblioteca` (`/`): hero, barra de búsqueda, chips de categoría, grid de `GameCard` con efecto tilt.
- Pantalla `Detalle` (`/game/[id]`): cover, tags, stats, acciones y leaderboard lateral con datos mock.
- Pantalla `Reproductor` (`/game/[id]/play`): HUD (jugador, puntuación, vidas, nivel), canvas CRT visual estático, overlay de pausa y modal de Game Over con campo de iniciales.
- Pantalla `Auth` (`/auth`): tabs Login/Registro, campos de formulario, botones de acceso social (solo visual), opción de invitado.
- Pantalla `Salón de la Fama` (`/hall`): tabs por juego, podio top 3, tabla completa, fila destacada del usuario si está logueado.
- Datos mock en `lib/data.ts`: array `GAMES` y función `seededScores`, tipados en TypeScript.
- Auth simulada: guardar/leer usuario de `localStorage` (`av_user`), sin backend ni validación real.
- Estilos del template (`styles.css`) adaptados a Tailwind CSS 4 y CSS variables del tema existente.
- Footer global con texto de versión.

**Fuera de scope (para specs futuros):**

- Lógica de juego real (colisiones, inputs, game loop).
- Backend de autenticación (NextAuth, Clerk, Supabase, etc.).
- Persistencia de scores en base de datos.
- Modo multijugador.
- Versión mobile nativa.
- Animaciones de score en tiempo real en el Reproductor (el score permanece estático en el HUD).

## Modelo de datos

```ts
// lib/data.ts

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: string;
  cover: string;       // clase CSS para el fondo del cover
  color: string;       // "cyan" | "magenta" | "yellow"
  best: number;
  plays: string;
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;
}

export const CATS: string[] = ["TODOS", "ACCIÓN", "PUZZLE", "AVENTURA", "DEPORTES"];

export const GAMES: Game[] = [ /* ~6 entradas mock */ ];

export function seededScores(seed: number, count: number): ScoreRow[] { /* generador determinista */ }
```

```ts
// Estructura en localStorage
localStorage.getItem("av_user")   // JSON: { name: string } | null
localStorage.getItem("av_scores") // JSON: Array<{ game: string, score: number, name: string, at: number }>
```

Esta feature no introduce ninguna estructura de datos de servidor ni base de datos — todo es mock en memoria y localStorage.

## Plan de implementación

1. Crear rama `02-mvp-screens` desde `main`.

2. Copiar `references/templates/styles.css` a `app/globals.css` (reemplazando el contenido actual) y verificar que las CSS variables del tema existente no entren en conflicto.

3. Crear `lib/data.ts` con `Game`, `ScoreRow`, `CATS`, `GAMES` (6 entradas) y `seededScores`. Verificar: `tsc --noEmit` sin errores.

4. Crear `components/Nav.tsx` a partir de `nav.jsx`. Recibe props `user`, `onSignOut` y usa `usePathname` + `useRouter` de Next.js en lugar de hash routing. Verificar: la nav renderiza en el layout sin errores.

5. Actualizar `app/layout.tsx`: importar `Nav` y el footer global. Verificar: todas las rutas muestran nav y footer.

6. Crear `app/page.tsx` — pantalla `Biblioteca`: componente `GameCard` con efecto tilt y componente `Library` con búsqueda y chips de categoría. Los links de "JUGAR" y click en card navegan a `/game/[id]`.

7. Crear `app/game/[id]/page.tsx` — pantalla `Detalle`: cover, tags, stats, leaderboard lateral con `seededScores`. Botón "JUGAR AHORA" navega a `/game/[id]/play`, botón "VOLVER" navega a `/`.

8. Crear `app/game/[id]/play/page.tsx` — pantalla `Reproductor`: HUD estático (score = 0, vidas = 3, nivel = 01), canvas CRT visual, overlay de pausa (toggle), modal de Game Over (botón "FIN" lo activa). Sin lógica de score en tiempo real.

9. Crear `app/auth/page.tsx` — pantalla `Auth`: tabs Login/Registro, campos de formulario, botones sociales (solo visual). Al hacer submit guarda `{ name }` en `localStorage` y redirige a `/`.

10. Crear `app/hall/page.tsx` — pantalla `Salón de la Fama`: tabs por juego, podio top 3, tabla completa. Lee `av_user` de `localStorage` para mostrar la fila destacada del usuario.

11. Crear `hooks/useUser.ts`: hook que lee/escribe `av_user` en `localStorage` y expone `user`, `login(name)` y `signOut()`. Conectar con `Nav`, `Auth` y `Salón de la Fama`.

12. Ejecutar `npm run build` y corregir errores de TypeScript o ESLint. Crear PR `02-mvp-screens` → `main`.

## Criterios de aceptación

- [ ] `npm run build` completa sin errores de TypeScript ni ESLint.
- [ ] La ruta `/` muestra el hero, la barra de búsqueda, los chips de categoría y el grid de GameCards.
- [ ] Filtrar por categoría en `/` oculta las cards que no corresponden.
- [ ] Buscar por nombre en `/` filtra las cards en tiempo real.
- [ ] Hacer click en una GameCard navega a `/game/[id]` con los datos del juego correcto.
- [ ] `/game/[id]` muestra cover, tags, stats, acciones y leaderboard lateral con 10 filas mock.
- [ ] El botón "JUGAR AHORA" en `/game/[id]` navega a `/game/[id]/play`.
- [ ] `/game/[id]/play` muestra el HUD con jugador, puntuación (0), vidas (3) y nivel (01).
- [ ] El botón "PAUSA" en `/game/[id]/play` muestra el overlay de pausa; "REANUDAR" lo oculta.
- [ ] El botón "FIN" en `/game/[id]/play` muestra el modal de Game Over con campo de iniciales.
- [ ] `/auth` muestra el tab "INICIAR SESIÓN" por defecto; cambiar a "CREAR CUENTA" muestra el campo de email.
- [ ] Hacer submit en `/auth` guarda `av_user` en `localStorage` y redirige a `/`.
- [ ] Tras login, la `Nav` muestra el nombre del usuario en lugar del botón "Iniciar Sesión".
- [ ] El botón del usuario en `Nav` ejecuta sign out: borra `av_user` y vuelve a mostrar "Iniciar Sesión".
- [ ] `/hall` muestra el podio top 3 y la tabla de 12 filas para el juego seleccionado.
- [ ] Cambiar de tab en `/hall` actualiza el podio y la tabla con datos del juego correspondiente.
- [ ] Si hay usuario logueado, `/hall` muestra una fila destacada con su nombre y puntuación.
- [ ] El menú hamburger en mobile abre el panel lateral; hacer click fuera lo cierra.
- [ ] La `Nav` marca como activo el link correcto según la ruta actual.

## Decisiones

- **Sí:** File-based routing de Next.js App Router (`/`, `/game/[id]`, `/game/[id]/play`, `/auth`, `/hall`) en lugar del hash routing del template original. Razón: es la convención de Next.js 16 y permite SSR/SSG en el futuro.
- **Sí:** Datos mock en `lib/data.ts` tipados en TypeScript. Razón: el MVP no necesita backend; tener los datos tipados facilita migrar a una API real en specs futuros.
- **Sí:** Auth simulada con `localStorage` (`av_user`). Razón: es suficiente para el MVP visual; un spec futuro puede reemplazarla con NextAuth o Clerk sin tocar las pantallas.
- **Sí:** Hook `useUser.ts` centraliza la lectura/escritura de `av_user`. Razón: evita duplicar lógica de localStorage en tres componentes distintos.
- **No:** Score en tiempo real en el Reproductor. Razón: requiere lógica de juego que está explícitamente fuera de scope.
- **No:** Botones de Google/GitHub funcionales en Auth. Razón: requieren un proveedor de OAuth; solo se implementa la UI.
- **No:** Animaciones CSS complejas del template convertidas a Tailwind utilities. Razón: las animaciones del template (flicker, blink, tilt, fade-in) se mantienen como CSS custom en `globals.css` para no perder fidelidad visual.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| CSS variables del template colisionan con las del tema existente de Arcade Vault | Auditar ambos archivos antes de fusionar; renombrar variables del template que choquen. |
| `localStorage` no disponible durante SSR en Next.js | Leer `localStorage` solo en `useEffect` o dentro del hook `useUser.ts` con guard `typeof window !== "undefined"`. |
| `usePathname` de Next.js no coincide exactamente con la lógica `isActive` del template | Reimplementar `isActive` con `startsWith` para las rutas anidadas (`/game/[id]` y `/game/[id]/play` ambas activan el link "Biblioteca"). |

## Qué **no** está en este spec

- Lógica de juego real (colisiones, inputs, game loop).
- Backend de autenticación.
- Persistencia de scores en base de datos.
- Botones de OAuth funcionales.
- Modo multijugador.

Cada uno de esos, si llega, va en su propio spec.
