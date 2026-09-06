# Puesta a punto del proyecto de producción (Supabase)

Checklist de lo que **no** se resuelve con migraciones. `supabase db push` deja el esquema,
las policies y el catálogo; todo lo de abajo es configuración de dashboard y hay que hacerlo
a mano, una sola vez, en el proyecto de **producción**.

Contexto: la org `NexoraDev` tiene dos proyectos — `ArcadeVault-dev` (`hnvjfqwpsjyscgtnjbhj`,
el que usa el MCP y `.env.local`) y `ArcadeVault-prod`. El MCP apunta **solo a dev**, a
propósito: producción no se toca desde el agente.

## 1. Aplicar el esquema

```bash
supabase login                            # una vez por máquina
supabase link --project-ref <PROD_REF>    # pide la DB password de producción
supabase migration list                   # Remote vacío, Local con las 9
supabase db push
```

- [ ] Esquema aplicado en producción (9 migraciones)

Antes del push, confirmar en el SQL Editor de producción que existe la función de
plataforma que la última migración necesita:

```sql
select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'rls_auto_enable';
```

Si no devuelve fila, `20260724220420_revoke_public_execute_rls_auto_enable.sql` falla y hay
que envolver el `revoke` en un bloque condicional. La crea Supabase en todo proyecto nuevo
junto al event trigger `ensure_rls`, así que lo esperable es que esté.

## 2. Authentication

Referencias: `specs/12-autenticacion.md` (OAuth) y `specs/13-security-hardening.md` (los tres
toggles que quedaron pendientes de dashboard, ver también `checklist.md`).

- [ ] **Providers** — Authentication → Providers: habilitar **Google** y **GitHub**.
      Usar **apps OAuth nuevas**, no las de desarrollo: el callback URL es distinto por
      entorno y compartir el client secret mezcla los dos.
- [ ] **URL Configuration** — Authentication → URL Configuration:
      Site URL = dominio de producción; Redirect URLs incluye `<dominio>/auth/callback`
      (es la ruta que implementa `app/auth/callback/route.ts`).
- [ ] **Confirm email** — Authentication → Sign In / Providers: **desactivado**, igual que
      en desarrollo. Decisión tomada al planificar la migración.
- [ ] **Minimum password length = 8** — Authentication → Settings → Password.
      `app/auth/page.tsx` ya exige 8 en el navegador; esto lo hace valer del lado del servidor.
- [ ] **Leaked password protection** — Authentication → Settings → Password.
      Cierra el warning `auth_leaked_password_protection` del Security Advisor.
- [ ] **Rate limit de signup** — Authentication → Rate Limits.
      Decisión del spec 13: se resuelve con el rate limiting nativo, sin código propio.

## 3. Variables de entorno del hosting

Las de producción **no van al repo**. Se cargan en el hosting:

| Variable                               | De dónde sale                                    |
| -------------------------------------- | ------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | Project Settings → API (proyecto de producción) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`        | Project Settings → API                          |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API                          |
| `RESEND_API_KEY`                       | Resend (formulario de contacto, `about/actions.ts`) |

`SUPABASE_DB_PASSWORD` es solo para la CLI en local; la app no la usa y no va al hosting.

- [ ] Variables cargadas en el hosting

## 4. Verificación post-deploy

```sql
select count(*) from public.games;   -- 5
select count(*) from public.scores;  -- 4
select tablename, policyname, cmd from pg_policies where schemaname = 'public';
-- games: public select (SELECT) · scores: public select (SELECT) + public insert (INSERT)
select relname, relrowsecurity from pg_class
where relname in ('games', 'scores');  -- ambas true
```

- [ ] `/library` lista los 5 juegos
- [ ] `/games/frogger` carga (es el que faltaba en las migraciones originales)
- [ ] Guardar un score escribe en producción y aparece en el leaderboard
- [ ] Login con Google y con GitHub vuelven logueados vía `/auth/callback`

## Asumido

- **Sin backups automáticos**: el plan Free no los incluye. Si producción pasa a tener datos
  que importen, es la primera razón para subir a Pro.
- **Sin CI/CD contra Supabase**: los `db push` se corren a mano. Automatizarlos requiere
  conectar el repo de GitHub al proyecto, que es también el prerrequisito de branching.
