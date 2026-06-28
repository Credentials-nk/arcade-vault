# SPEC 04 — Integración base de Supabase

> **Estado:** Approved · **Depende de:** 03-about-contact · **Fecha:** 2026-06-28
> **Objetivo:** Configurar Supabase en Next.js con clientes browser y server, variables de entorno y middleware de sesión, como fundación para specs futuros de auth, realtime y edge functions.

## Scope

**In:**

- Instalación de `@supabase/supabase-js` y `@supabase/ssr`.
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `.env.local`.
- Browser client en `lib/supabase/client.ts` (para Componentes Cliente y realtime futuro).
- Server client en `lib/supabase/server.ts` (para Server Actions y Route Handlers).
- `proxy.ts` en la raíz del proyecto para refresh automático de tokens de sesión (convención de Next.js 16.x, reemplaza el deprecado `middleware.ts`).

**Fuera de scope:**

- Autenticación (registro, login, logout) — spec futuro.
- Tablas en base de datos — spec futuro.
- Realtime subscriptions — spec futuro.
- Edge Functions — spec futuro.
- Guardar mensajes de contacto en Supabase — spec futuro.
- Cualquier UI visible para el usuario final.

## Plan de implementación

1. Crear rama `04-supabase-setup` desde `main`.

2. Instalar dependencias:

   ```bash
   npm install @supabase/supabase-js @supabase/ssr
   ```

   Verificar: `package.json` incluye ambos paquetes.

3. Crear `.env.local` con las variables de entorno de Supabase:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
   ```

   Verificar: `.env.local` está en `.gitignore` (ya cubierto).

4. Crear `lib/supabase/client.ts` — browser client:

   ```ts
   import { createBrowserClient } from '@supabase/ssr';

   export function createClient() {
     return createBrowserClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
     );
   }
   ```

   Verificar: `tsc --noEmit` sin errores.

5. Crear `lib/supabase/server.ts` — server client:

   ```ts
   import { createServerClient } from '@supabase/ssr';
   import { cookies } from 'next/headers';

   export async function createClient() {
     const cookieStore = await cookies();
     return createServerClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
       {
         cookies: {
           getAll() {
             return cookieStore.getAll();
           },
           setAll(cookiesToSet) {
             cookiesToSet.forEach(({ name, value, options }) =>
               cookieStore.set(name, value, options)
             );
           },
         },
       }
     );
   }
   ```

   Verificar: `tsc --noEmit` sin errores.

6. Crear `middleware.ts` en la raíz del proyecto para refresh automático de tokens:

   ```ts
   import { createServerClient } from '@supabase/ssr';
   import { NextResponse, type NextRequest } from 'next/server';

   export async function middleware(request: NextRequest) {
     let supabaseResponse = NextResponse.next({ request });

     const supabase = createServerClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
       {
         cookies: {
           getAll() {
             return request.cookies.getAll();
           },
           setAll(cookiesToSet) {
             cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
             supabaseResponse = NextResponse.next({ request });
             cookiesToSet.forEach(({ name, value, options }) =>
               supabaseResponse.cookies.set(name, value, options)
             );
           },
         },
       }
     );

     await supabase.auth.getUser();
     return supabaseResponse;
   }

   export const config = {
     matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
   };
   ```

   Verificar: `tsc --noEmit` sin errores; `npm run dev` arranca sin errores en consola.

7. Ejecutar `npm run build` y corregir errores de TypeScript o ESLint.
   Crear PR `04-supabase-setup` → `main`.

## Criterios de aceptación

- [ ] `npm run build` completa sin errores de TypeScript ni ESLint.
- [ ] `package.json` incluye `@supabase/supabase-js` y `@supabase/ssr`.
- [ ] `.env.local` contiene `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] `lib/supabase/client.ts` exporta `createClient` usando `createBrowserClient`.
- [ ] `lib/supabase/server.ts` exporta `createClient` async usando `createServerClient` con cookies.
- [ ] `middleware.ts` existe en la raíz y aplica el matcher correcto.
- [ ] `npm run dev` arranca sin errores en consola relacionados con Supabase o el middleware.
- [ ] Ninguna variable de entorno está hardcodeada en el código fuente.

## Decisiones

- **Sí:** `@supabase/ssr` junto con `@supabase/supabase-js`. Razón: es el paquete oficial
  para Next.js App Router; maneja cookies automáticamente, lo que es obligatorio para auth
  futuro. Evita refactorizar cuando llegue ese spec.
- **Sí:** Dos clientes separados (browser y server). Razón: Next.js App Router requiere
  instancias distintas según el contexto de ejecución; compartir una sola instancia causaría
  errores en Server Actions y Componentes Servidor.
- **Sí:** `middleware.ts` en este spec. Razón: sin él, los tokens de sesión no se refrescan
  automáticamente y auth futuro tendría bugs silenciosos de expiración.
- **Sí:** Estructura `lib/supabase/`. Razón: consistente con `lib/data.ts` ya existente en
  el proyecto.
- **No:** Tablas, auth ni realtime en este spec. Razón: scope acotado a la capa de
  configuración; cada funcionalidad tendrá su propio spec.

## Riesgos

| Riesgo                                                        | Mitigación                                                                                                                                                                                   |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Variables de entorno ausentes en producción                   | El middleware y los clientes lanzarán errores en runtime. Documentar en el README que `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` son obligatorias en el entorno de deploy. |
| Middleware matcher demasiado amplio ralentiza rutas estáticas | El matcher excluye `_next/static`, `_next/image` y `favicon.ico`; es el patrón oficial recomendado por Supabase y Next.js.                                                                   |
| `cookies()` de Next.js requiere `await` en Next.js 15+        | Ya contemplado en el server client con `async function createClient()`.                                                                                                                      |
