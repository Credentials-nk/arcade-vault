# SPEC 02 — Pantalla Home (landing page) de Arcade Vault

> **Estado:** Implemented · **Depende de:** 01-mvp-screens · **Fecha:** 2026-06-24
> **Objetivo:** Implementar la pantalla Home en `/` como landing page visual estática, reubicar la Biblioteca a `/library`, y actualizar la Nav para incluir los links "Inicio" y "Acerca de".

## Scope

**In:**

- Pantalla `Home` (`/`): hero con siluetas flotantes, sección "¿Por qué Arcade Vault?", mini-rail de juegos, stats, actividad en vivo (ticker + top jugadores), pricing/FAQ y CTA final. Todo visual estático.
- Reubicar `Biblioteca` de `/` a `/library` y actualizar todos los links internos que apuntaban a `/`.
- Actualizar `Nav` para incluir "Inicio" (→ `/`) y "Acerca de" (→ `/about`, link presente pero sin página destino aún).
- Mover datos hardcodeados de actividad en vivo (ticker y top jugadores) a `lib/data.ts` como constantes tipadas.
- Mini-rail de juegos usa el array `GAMES` existente en `lib/data.ts`.

**Fuera de scope:**

- Pantalla `About` (`/about`): se define en un spec futuro.
- Animaciones en tiempo real del ticker (el ticker es visual estático, sin polling ni websockets).
- Lógica de créditos real (el contador "CRÉDITOS · 03" permanece hardcodeado).
- Cualquier cambio a las pantallas Detalle, Reproductor, Auth o Salón de la Fama.

## Modelo de datos

Nuevas constantes en `lib/data.ts`:

```ts
export interface TickerRow {
  player: string;
  game: string;
  score: number;
  ago: string;
  color: "cyan" | "magenta" | "yellow" | "green";
}

export interface TopRow {
  rank: number;
  player: string;
  score: number;
}

export const TICKER_ROWS: TickerRow[] = [ /* 7 entradas mock, datos del template */ ];

export const TOP_TODAY: TopRow[] = [ /* 5 entradas mock, datos del template */ ];
```

No se introduce ninguna estructura de servidor ni base de datos. Todo es mock en memoria.

## Plan de implementación

1. Crear rama `02-home-screen` desde `main`.

2. Mover `app/page.tsx` (Biblioteca) a `app/library/page.tsx`. Actualizar todos los links internos
   que apuntaban a `/` para que apunten a `/library` (Nav, botones de Home, Detalle).
   Verificar: `/library` carga sin errores, los links de Nav funcionan.

3. Agregar `TICKER_ROWS` y `TOP_TODAY` a `lib/data.ts` con sus interfaces tipadas.
   Verificar: `tsc --noEmit` sin errores.

4. Crear `app/page.tsx` — pantalla `Home`: traducir `home.jsx` a TypeScript/Next.js.
   - `FloatingSilhouettes`: SVG decorativos, sin cambios.
   - `FeatureIcon`: íconos pixel SVG, sin cambios.
   - `MiniCard`: usa `Game` de `lib/data.ts`; el click navega a `/library` con `useRouter`.
   - Sección "Actividad en vivo": consume `TICKER_ROWS` y `TOP_TODAY` de `lib/data.ts`.
   - Animaciones reveal (IntersectionObserver) implementadas con `useEffect` en un hook
     local `useReveal`.
   - Botones CTA navegan con `useRouter`: "EXPLORAR JUEGOS" → `/library`,
     "CREAR CUENTA" → `/auth`, "VER SALÓN" → `/hall`.
   Verificar: `/` renderiza todas las secciones sin errores de TypeScript.

5. Actualizar `components/Nav.tsx`: agregar links "Inicio" (→ `/`) y "Acerca de"
   (→ `/about`). Actualizar `isActive` para que "Inicio" se active solo en `/` y
   "Biblioteca" se active en `/library`, `/game/[id]` y `/game/[id]/play`.
   Verificar: los 5 links aparecen en desktop y mobile; el estado activo es correcto
   en cada ruta.

6. Ejecutar `npm run build` y corregir errores de TypeScript o ESLint.
   Crear PR `02-home-screen` → `main`.

## Criterios de aceptación

- [ ] `npm run build` completa sin errores de TypeScript ni ESLint.
- [ ] `/` muestra el hero con las siluetas flotantes y los dos CTAs ("EXPLORAR JUEGOS" y "CREAR CUENTA").
- [ ] "EXPLORAR JUEGOS" navega a `/library`; "CREAR CUENTA" navega a `/auth`.
- [ ] La sección "¿Por qué Arcade Vault?" muestra las 4 feature cards con sus íconos pixel.
- [ ] La mini-rail muestra las primeras 6 cards de `GAMES`; hacer click en una navega a `/game/[id]`.
- [ ] "VER TODOS LOS JUEGOS →" navega a `/library`.
- [ ] La sección de stats muestra los 3 bloques (12+, MILES, GLOBAL).
- [ ] La sección "Actividad en vivo" muestra el ticker con 7 filas y el top con 5 jugadores.
- [ ] "VER SALÓN →" navega a `/hall`.
- [ ] La sección Pricing muestra la price card y las 3 preguntas del FAQ.
- [ ] "EMPEZAR GRATIS →" en Pricing navega a `/auth`.
- [ ] La sección final CTA muestra "INSERTAR MONEDA →" y navega a `/library`.
- [ ] Las secciones con clase `.reveal` aparecen con animación al hacer scroll.
- [ ] `/library` carga correctamente en su nueva ruta; los links que apuntaban a `/` funcionan.
- [ ] La Nav muestra 5 links: Inicio, Biblioteca, Salón de la Fama, Acerca de + botón auth.
- [ ] El link "Inicio" en Nav está activo solo en `/`.
- [ ] El link "Biblioteca" en Nav está activo en `/library`, `/game/[id]` y `/game/[id]/play`.
- [ ] El link "Acerca de" en Nav es clickeable (sin romper la app aunque `/about` no exista aún).
- [ ] El menú mobile incluye los 5 links con el estado activo correcto.

## Decisiones

- **Sí:** Home en `/`, Biblioteca se mueve a `/library`. Razón: la landing page es el punto
  de entrada natural de la app; es la convención estándar para un sitio con marketing page.
- **Sí:** Link "Acerca de" presente en Nav desde este spec aunque `/about` no exista aún.
  Razón: la Nav debe reflejar la estructura final de navegación; navegar a una ruta sin página
  muestra el 404 de Next.js, lo cual es aceptable en desarrollo.
- **Sí:** Datos de actividad en vivo (`TICKER_ROWS`, `TOP_TODAY`) movidos a `lib/data.ts`
  como constantes tipadas. Razón: mantiene el componente limpio y facilita reemplazarlos
  por una API real en un spec futuro.
- **Sí:** Mini-rail consume `GAMES` existente de `lib/data.ts`. Razón: evita duplicar datos
  mock ya definidos en el spec-01.
- **No:** Animación de ticker en tiempo real. Razón: requiere lógica de polling o websockets,
  fuera del alcance de este MVP visual.
- **No:** Pantalla About en este spec. Razón: se define en su propio spec para mantener
  el scope acotado.
