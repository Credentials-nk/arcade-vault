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

| Variable                               | De dónde sale                                       |
| -------------------------------------- | --------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Project Settings → API (proyecto de producción)     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`        | Project Settings → API                              |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API                              |
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

## 5. Acceso de solo lectura (pooler)

Producción se consulta —nunca se escribe— con un rol Postgres dedicado, `arcade_ro`, a través de la
conexión **pooled (Supavisor)**. El pooler y no la conexión directa por dos razones: `db.<ref>.supabase.co`
exige el add-on de IPv4, y el pooler permite acotar el blast radius con `connection limit`.

Alcance deliberado: **SELECT sobre todo el esquema `public`** (lo que existe y lo que agreguen las
migraciones futuras). Nada de `auth`, `storage` ni `vault`: `auth.users` tiene emails y metadata de
providers y no hay razón operativa para exponerlos por una conexión externa.

### 5.1 Crear el rol

Se ejecuta **una sola vez**, a mano, en el **SQL Editor de producción** (corre como `postgres`).
**No** va a `supabase/migrations/`: el rol lleva password, es una credencial, no esquema versionable.

```sql
-- ============================================================
-- arcade_ro — rol de solo lectura para ArcadeVault-prod
-- Ejecutar en el SQL Editor de PRODUCCIÓN (rol postgres).
-- ============================================================

-- 1) El rol. Generar la password con un gestor y guardarla ahí; no reusar la DB password.
create role arcade_ro with
  login
  password 'REEMPLAZAR_POR_PASSWORD_FUERTE'
  nosuperuser nocreatedb nocreaterole noreplication nobypassrls
  connection limit 5;

-- 2) Defaults del rol: read-only + cortes para que una consulta boba no cuelgue producción
alter role arcade_ro set default_transaction_read_only = on;
alter role arcade_ro set statement_timeout = '30s';
alter role arcade_ro set idle_in_transaction_session_timeout = '60s';
alter role arcade_ro set search_path = public;

-- 3) Conexión y esquema
grant connect on database postgres to arcade_ro;
grant usage on schema public to arcade_ro;
revoke create on schema public from arcade_ro;

-- 4) Lectura de todo public: lo que existe hoy...
grant select on all tables in schema public to arcade_ro;
grant select on all sequences in schema public to arcade_ro;

-- ...y lo que cree postgres mañana (las migraciones de `supabase db push` corren como postgres)
alter default privileges for role postgres in schema public
  grant select on tables to arcade_ro;
alter default privileges for role postgres in schema public
  grant select on sequences to arcade_ro;
```

**Qué garantiza qué.** La garantía dura son los GRANTs: `arcade_ro` solo tiene `SELECT`, así que
`insert`/`update`/`delete`/`truncate` fallan por privilegios. `default_transaction_read_only` es una
segunda red **blanda** —el propio rol puede apagarla con `set default_transaction_read_only = off`—:
sirve para que un cliente distraído falle temprano, no como control de seguridad.

**RLS sigue aplicando.** `arcade_ro` no es dueño de las tablas y no tiene `BYPASSRLS`, así que lee a
través de las policies existentes (`public select` en `games` y `scores`, ambas `using (true)` → ve
todo). Si mañana se agrega una tabla con RLS y sin policy de SELECT, `arcade_ro` la verá vacía: es lo
correcto, no un bug del rol.

**Lo que no ve.** Un rol nuevo no hereda nada de `anon`/`authenticated`/`service_role`, y sin `USAGE`
sobre `auth`/`storage`/`vault` no hay lectura posible de esos esquemas.

### 5.2 Verificar el rol

```sql
select rolname, rolsuper, rolbypassrls, rolcanlogin, rolconnlimit
from pg_roles where rolname = 'arcade_ro';
-- arcade_ro | f | f | t | 5

select has_table_privilege('arcade_ro', 'public.scores', 'select') as lee,
       has_table_privilege('arcade_ro', 'public.scores', 'insert') as escribe,
       has_schema_privilege('arcade_ro', 'auth',    'usage')       as ve_auth,
       has_schema_privilege('arcade_ro', 'storage', 'usage')       as ve_storage;
-- true | false | false | false
```

### 5.3 Connection string del pooler

El host sale de **Dashboard de producción → Connect**. Lo único que cambia respecto de lo que muestra
el dashboard es el usuario: **Supavisor exige `<rol>.<project_ref>`**, no `<rol>` a secas — y el ref de
producción es `njakqaqfvjrpolerteck` (el de dev, `hnvjfqwpsjyscgtnjbhj`, no va acá).

```
# Transaction mode (el recomendado, 6543)
postgresql://arcade_ro.njakqaqfvjrpolerteck:<PASSWORD>@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=no-verify

# Session mode (5432) — mismo host, para clientes que necesiten prepared statements o SET persistente
postgresql://arcade_ro.njakqaqfvjrpolerteck:<PASSWORD>@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=no-verify
```

- **`sslmode=no-verify`, no `require`.** El pooler presenta una cadena que el trust store de Node no
  reconoce, y `require` la valida: con `require` el cliente muere con `self-signed certificate in
certificate chain`. `no-verify` mantiene el tráfico cifrado y solo saltea la validación de la cadena.
  Si hace falta validación completa, se baja el CA de Connect → _Download certificate_ y se usa
  `?sslmode=verify-full&sslrootcert=<ruta al .crt>`.
- La password se **URL-encodea** si contiene `@ : / ? # &`.
- Transaction mode no soporta `LISTEN/NOTIFY` ni sesiones con estado; para lectura ad-hoc da igual.

### 5.4 MCP `prod-ro` (lectura de producción desde el agente)

Servidor MCP de Postgres apuntando a ese string. Cada consulta va envuelta en
`BEGIN TRANSACTION READ ONLY`, encima de un rol que ya solo tiene `SELECT`.

Se registra con scope **local** para que el string con password **nunca toque el repo** — `.mcp.json`
está versionado:

```bash
claude mcp add prod-ro --scope local -- npx -y @modelcontextprotocol/server-postgres "postgresql://arcade_ro.njakqaqfvjrpolerteck:<PASSWORD>@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=no-verify"
```

- En Windows, si `npx` no levanta como comando de MCP, la forma que funciona es
  `-- cmd /c npx -y @modelcontextprotocol/server-postgres "<url>"`.
- `@modelcontextprotocol/server-postgres` está archivado en el repo de servidores de referencia. Si da
  problemas, la alternativa es `crystaldba/postgres-mcp` (`uvx postgres-mcp --access-mode=restricted`),
  que requiere Python/uvx.
- El nombre `prod-ro` es a propósito distinto del MCP `supabase` (que es **dev**): en la lista de
  herramientas tiene que ser imposible confundir el entorno.
- Los MCP se cargan al arrancar: después de registrarlo hay que **reiniciar Claude Code** y confirmar
  con `/mcp` que `prod-ro` figura _connected_. Para cambiar el string (rotación de password, ajuste de
  SSL) es `claude mcp remove prod-ro -s local` y volver a agregarlo.

**Regla de uso:** `prod-ro` sirve para _diagnosticar_ (contar filas, comparar el catálogo, ver policies,
detectar deriva). El _arreglo_ nunca sale de ahí: sigue siendo una migración en `supabase/migrations/`
aplicada con `supabase db push`.

Prueba negativa que hay que correr una vez, porque es la que importa: un `insert into public.scores ...`
por el MCP debe fallar con `permission denied for table scores`, y `select * from auth.users` con
`permission denied for schema auth`.

### 5.5 Rotar y dar de baja

```sql
-- rotar password
alter role arcade_ro with password 'NUEVA_PASSWORD';

-- baja definitiva
alter default privileges for role postgres in schema public revoke select on tables from arcade_ro;
alter default privileges for role postgres in schema public revoke select on sequences from arcade_ro;
revoke all on all tables in schema public from arcade_ro;
revoke all on all sequences in schema public from arcade_ro;
revoke usage on schema public from arcade_ro;
revoke connect on database postgres from arcade_ro;
drop owned by arcade_ro;
drop role arcade_ro;
```

- [ ] Rol `arcade_ro` creado y verificado en producción
- [ ] MCP `prod-ro` registrado, conectado y con la prueba negativa corrida

## Asumido

- **Sin backups automáticos**: el plan Free no los incluye. Si producción pasa a tener datos
  que importen, es la primera razón para subir a Pro.
- **Sin CI/CD contra Supabase**: los `db push` se corren a mano. Automatizarlos requiere
  conectar el repo de GitHub al proyecto, que es también el prerrequisito de branching.
