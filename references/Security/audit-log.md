# Security Auditor — memoria viva

> Memoria viva del subagente **`@security-auditor`**
> (`.claude/agents/security-auditor.md`). Mismo patrón que
> `references/game-skins.md` (`@skin-designer`),
> `references/mobile-porter-todo.md` (`@mobile-porter`) y
> `references/game-performance-booster-todo.md`
> (`@game-performance-booster`): el agente lee este documento al arrancar
> cada corrida y registra acá qué ítems de la checklist DB1–DB7 / AP1–AP5
> se revisaron, qué se encontró y qué se cerró, para no re-auditar a ciegas
> ni re-reportar como nuevo un riesgo ya aceptado.
>
> **Convive con `references/Security/checklist.md`, que este agente NO edita.**
> El checklist es el artefacto del spec 13: el estado **deseado** que fijó el
> humano (uno de sus criterios de aceptación es que ese archivo refleje ese
> estado). Este archivo es el estado **observado** corrida a corrida.
>
> **Regla dura:** acá nunca se escribe el valor de un secreto — solo el
> nombre de la variable de entorno.

## Checklist de referencia (fija, no se repite por corrida)

**Base de datos**

- **DB1** — RLS habilitado en toda tabla de `public` (`pg_class.relrowsecurity`).
- **DB2** — Cobertura de policies por comando y mínimo privilegio (`pg_policies`):
  sin `true` literal en INSERT/UPDATE/DELETE, roles explícitos.
- **DB3** — GRANTs de tabla vs. lo que las policies permiten
  (`role_table_grants`). Clave: **RLS no filtra `TRUNCATE`**.
- **DB4** — Funciones `SECURITY DEFINER` con `search_path` fijo y ACL mínima
  (`pg_proc`). Referencia correcta: `rls_auto_enable()`.
- **DB5** — Superficie del schema: extensiones fuera de `public`, vistas con
  `security_invoker`, sin `CREATE` para `anon`/`authenticated`.
- **DB6** — `get_advisors` security (accionable) + performance (informativo).
- **DB7** — Deriva entre el estado remoto (`list_migrations`) y lo documentado
  en el repo/specs. Incluye deriva **de rama**.

**Código de la app**

- **AP1** — Validación de entrada en Server Actions (toda función `'use
server'` exportada es un endpoint público; los tipos de TS no validan en
  runtime).
- **AP2** — Escapado de entrada en salidas que no son JSX (HTML de mails,
  subjects, URLs, redirects).
- **AP3** — Secretos y llaves: nada de server-only en el bundle del cliente,
  nada commiteado, nunca imprimir valores.
- **AP4** — Headers de respuesta: la baseline de 3 del spec 13, ni uno más.
- **AP5** — Fuga de info en errores devueltos al cliente (techo: Bajo).

**Anti-lista (nunca se reporta):** CSP · HSTS/Permissions-Policy · rate
limiting propio · auth obligatorio para `scores` · `npm audit`/deps ·
gating de rutas/OAuth (specs 12/14) · `relforcerowsecurity=false` ·
`postgres`/`service_role` bypasseando RLS · anon key pública por diseño ·
`using (true)` en SELECT de catálogo público · el trigger `ensure_rls` /
`rls_auto_enable()` (control correcto) · `auth.*`/`storage.*`.

**Severidad:** Crítico (explotable hoy, sin condiciones) · Alto (una
condición previa, o corrupción de datos) · Medio (defensa en profundidad, hoy
bloqueado por otra capa) · Bajo (higiene) · Informativo (postura,
dashboard-only, aceptado). La DB **nunca** se arregla, en ningún nivel: SQL
propuesto.

## Estado de los hallazgos

IDs `SEC-NNN` estables, monotónicos, nunca reusados. Estados: `abierto` ·
`arreglado` · `propuesto` (SQL entregado, pendiente de que lo aplique el
humano) · `dashboard-only` · `aceptado` · `falso positivo` · `cerrado`.

| ID      | Título                                                                                                                                    | Ítem | Severidad | Estado    | Detectado  | Últ. visto | Cierre / decisión                                                                      |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---- | --------- | --------- | ---------- | ---------- | -------------------------------------------------------------------------------------- |
| SEC-001 | Inyección de HTML sin escapar en el mail de contacto (`name`/`email`/`msg`)                                                               | AP2  | Alto      | arreglado | 2026-07-24 | 2026-07-24 | `escapeHtml()` en `app/about/actions.ts`, aplicado antes del `\n → <br/>`.             |
| SEC-002 | `saveScore` sin validación de tipo/rango/longitud (`gameId`/`playerName`/`score`)                                                         | AP1  | Medio     | arreglado | 2026-07-24 | 2026-07-24 | Guard clauses en `app/actions/saveScore.ts`, espejan CHECK/FK ya vigentes en `scores`. |
| SEC-003 | GRANTs de `TRUNCATE`/`UPDATE`/`DELETE`/`REFERENCES`/`TRIGGER` a `anon`/`authenticated` en `games` y `scores`, sin policy que los habilite | DB3  | Medio     | propuesto | 2026-07-24 | 2026-07-24 | SQL propuesto entregado en esta corrida. Pendiente de que el humano lo aplique.        |
| SEC-004 | 7 migraciones aplicadas en el remoto sin contraparte en `supabase/migrations/` del repo                                                   | DB7  | Bajo      | abierto   | 2026-07-24 | 2026-07-24 | Solo reporte — decide el humano si se versiona el historial de migraciones.            |
| SEC-005 | `error.message` crudo del proveedor devuelto/lanzado al cliente en los 5 archivos `'use server'`                                          | AP5  | Bajo      | abierto   | 2026-07-24 | 2026-07-24 | Techo Bajo por definición del ítem; no se arregla salvo pedido explícito del humano.   |

## Riesgos aceptados (no se re-reportan como hallazgos nuevos)

Cada uno con **condición de reapertura**: qué tendría que cambiar para que
vuelva a ser hallazgo.

- **SEC-A01 — `saveScore` no exige sesión ni tiene rate limit propio** ·
  ámbito app · **aceptado** en `specs/05-asteroids-game.md` (riesgo aceptado)
  y reafirmado en `specs/12-autenticacion.md` (modo invitado in-scope).
  Razón: exigir sesión rompería el modo invitado. **Reapertura:** si el
  leaderboard adquiere valor real (premios, moderación) o si aparece abuso
  concreto.
  **⚠️ Ojo — lo aceptado es NO exigir sesión.** La **falta de validación de
  tipo/rango/longitud** en `saveScore` (ítem AP1) **no** estaba aceptada — se
  cerró como **SEC-002** en la corrida 2026-07-24.
- **SEC-A02 — Sin Content-Security-Policy** · AP4 · **aceptado** en
  `specs/13-security-hardening.md` ("Decisiones" → No CSP). **Reapertura:**
  solo vía un spec dedicado que lo calibre.
- **SEC-A03 — Sin rate limiting propio en la app** · ámbito app ·
  **aceptado** en `specs/13-security-hardening.md`: se resuelve con los Rate
  Limits nativos de Supabase (dashboard). **Reapertura:** si Supabase deja de
  cubrirlo o aparece abuso medido.
- **SEC-A04 — Min password length 8 / leaked password protection / max
  signup rate por IP** · `dashboard-only` · documentados en
  `references/Security/checklist.md`. No tienen equivalente en código; se
  listan como Informativo, **no** como hallazgo. Incluye el advisor
  `auth_leaked_password_protection`.

## Tabla de corridas

| Fecha      | Rama                        | HEAD      | Ámbito       | Nuevos | Arreglados | SQL propuesto | Sin cambios                         | Build |
| ---------- | --------------------------- | --------- | ------------ | ------ | ---------- | ------------- | ----------------------------------- | ----- |
| 2026-07-24 | `15-security-auditor-agent` | `e66cda9` | DB1–7, AP1–5 | 5      | 2          | 1 (SEC-003)   | DB1,DB2,DB4,DB5,DB6,AP3,AP4 limpios | verde |

## Detalle por corrida

### Corrida 2026-07-24 (rama `15-security-auditor-agent`, HEAD `e66cda9`)

Primera corrida real. `checklist.md` y `specs/13-security-hardening.md` viven
en la rama actual (`e66cda9` es el merge de la PR #27 del spec 13 a `main`,
esta rama nace de ahí) — sin deriva de rama para esos dos artefactos.

- **Árbol al empezar:** sucio → `CLAUDE.md` modificado y
  `.claude/agents/security-auditor.md` + `references/Security/audit-log.md`
  sin trackear (preexistentes, ninguno tocado salvo `audit-log.md`, que es
  esta misma memoria).
- **Cobertura:** DB1–DB7 ✓ · AP1–AP5 ✓.

**Hallazgos DB:**

- **DB1** limpio: `games` y `scores` con `relrowsecurity = true`.
  `relforcerowsecurity = false` en ambas — default, no es hallazgo (anti-lista
  #7).
- **DB2** limpio: `games` tiene solo `public select` (`qual = true`, catálogo
  deliberadamente público, anti-lista #10); `scores` tiene `public select`
  (mismo motivo) y `public insert` con `with_check` explícito
  (`game_id IS NOT NULL AND player_name IS NOT NULL AND char_length(player_name) <= 10 AND score >= 0`),
  ya endurecida por la migración `harden_scores_insert_policy` del spec 13.
  Sin políticas de UPDATE/DELETE en ninguna tabla — correcto, deny-by-default.
- **DB3 → SEC-003** (nuevo, Medio): `anon` y `authenticated` tienen
  `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` de tabla en
  `games` y en `scores`, pero las policies solo habilitan `SELECT` en ambas
  y además `INSERT` en `scores`. `UPDATE`/`DELETE` ya están bloqueados por
  deny-by-default; el caso relevante es `TRUNCATE`, que RLS no filtra.
  Evidencia: `information_schema.role_table_grants`. Severidad Medio y no
  Alto porque PostgREST no expone `TRUNCATE` por REST hoy — no hay vía de
  invocación concreta desde internet. SQL propuesto abajo, no ejecutado.
- **DB4** limpio: única función `SECURITY DEFINER` en `public` es
  `rls_auto_enable()`, con `proconfig = {search_path=pg_catalog}` y
  `acl = {postgres=X/postgres, service_role=X/postgres}` (sin `anon`/
  `authenticated`) — ya cerrado por la migración `revoke_public_execute_rls_auto_enable`
  del spec 13. Coincide con la referencia canónica, no se re-reporta.
- **DB5** limpio: extensiones instaladas (`pg_stat_statements`, `pgcrypto`,
  `uuid-ossp`, `plpgsql`, `supabase_vault`) todas fuera de `public`
  (`extensions`/`pg_catalog`/`vault`); cero vistas en `public`; `anon` y
  `authenticated` sin `CREATE` sobre `public`.
- **DB6** — security: único WARN es `auth_leaked_password_protection`, ya
  registrado como `SEC-A04` (`dashboard-only`) — sin cambios, no se
  re-reporta. Performance: `unindexed_foreign_keys` en
  `scores.scores_game_id_fkey` (INFO) — informativo, no se arregla (es
  cambio de DB y no es de seguridad).
- **DB7 → SEC-004** (nuevo, Bajo): `list_migrations` devuelve 7 migraciones
  aplicadas en el remoto (`create_scores_table`, `create_games_table`,
  `add_serpentina_play_route`, `remove_unimplemented_placeholder_games`,
  `add_lime_to_games_color_check`, `harden_scores_insert_policy`,
  `revoke_public_execute_rls_auto_enable`) pero el repo **no tiene**
  `supabase/migrations/` — cero contraparte versionada. Solo reporte, sin SQL
  (no es un `revoke`, es una decisión de versionado). No se crea el
  directorio por cuenta propia.

**Hallazgos de código de la app** (superficie: los 5 archivos `'use server'` —
`app/auth/actions.ts`, `app/actions/getGames.ts`, `app/actions/getLeaderboard.ts`,
`app/actions/saveScore.ts`, `app/about/actions.ts`):

- **AP1 → SEC-002** (nuevo, Medio, **arreglado**): `saveScore(gameId, playerName, score)`
  no validaba nada antes de insertar — dependía enteramente de que Postgres
  rechazara con un `CHECK`/`FK`. Evidencia: `app/actions/saveScore.ts:saveScore`
  (antes del arreglo). Ya estaba nombrado en la memoria (`SEC-A01`, nota de
  "ojo") como pendiente. Medio y no Alto porque el `CHECK` de la tabla
  (`char_length(player_name) <= 10`, `score >= 0 AND score < 9999999`) y el
  `with_check` de la policy ya bloqueaban la escritura ilegítima — la falta
  de guard no permitía corromper datos, solo dependía de una sola capa real
  (la app) para dar un error limpio en vez de uno crudo de Postgres.
  **Arreglado:** guard clauses agregadas en `saveScore` que espejan
  exactamente esas restricciones (`typeof gameId === 'string'`,
  `typeof playerName === 'string' && playerName.length <= 10`,
  `Number.isInteger(score) && score >= 0 && score < 9999999`).
  **Frase de no-regresión:** la entrada legítima de los 5 juegos
  (`'INVITADO'` u 8 caracteres uppercase de máx. 10, `finalScore` entero
  ≥ 0) sigue pasando los tres guards sin cambios; solo se corta antes del
  insert lo que ya iba a rebotar en el `CHECK`/`FK` de la DB, evitando el
  viaje redundante y el error crudo de Postgres.
- **AP1** — resto de archivos: `getGames`/`getGame`/`getGameLeaderboard`/
  `getGlobalLeaderboard` son lecturas (`SELECT`), sin `CHECK`/`with_check`
  que mirar — N/A. `signInWithEmail`/`signUpWithEmail` delegan la validación
  real (formato de email, política de password) a la propia API de Supabase
  Auth, que ya la aplica del lado servidor — sin restricción propia del repo
  que espejar, no se inventa un tope de negocio — N/A.
- **AP2 → SEC-001** (nuevo, Alto, **arreglado**): `sendContactEmail` en
  `app/about/actions.ts` interpolaba `name`, `email` y `msg` sin escapar
  dentro de un `html:` de Resend (`<p>${msg.replace(/\n/g, "<br/>")}</p>`
  incluso invertía el orden: reemplazaba saltos de línea antes de escapar,
  y no escapaba nada). Un `msg`/`name`/`email` con `<`/`>`/`&`/comillas se
  renderiza como HTML/markup en el cliente de correo de quien lo recibe.
  Coincide con el ejemplo de Alto de la propia escala del agente
  ("inyección de HTML en el mail que recibe una persona"). Evidencia:
  `app/about/actions.ts:sendContactEmail` (antes del arreglo). **Arreglado:**
  helper local `escapeHtml()` (`& < > " '`) aplicado a `name`, `email` y
  `msg` **antes** de interpolar, con el `\n → <br/>` de `msg` corrido
  **después** del escape. **Frase de no-regresión:** un mensaje de texto
  plano legítimo (sin esos 5 metacaracteres) se renderiza exactamente igual
  que antes — el guard solo neutraliza HTML/markup embebido, no cambia el
  contenido de texto normal ni pierde los saltos de línea.
- **AP3** limpio: los únicos `process.env` fuera de `NEXT_PUBLIC_SUPABASE_URL`/
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (públicos por diseño, anti-lista #9) son
  `RESEND_API_KEY` en `app/about/actions.ts`, que es `'use server'` — nunca
  llega al bundle del cliente. `git ls-files | grep '.env'` vacío. El
  `git grep` de patrones de secreto solo encontró: el nombre de la variable
  documentado en specs/`CLAUDE.md`/este mismo archivo, un placeholder
  (`re_xxxxxxxxxxxxxxxx` en `specs/03-about-contact.md`), la palabra
  `service_role` como texto descriptivo (no un valor), y una coincidencia
  dentro de un blob base64 comprimido de
  `references/home-about/arcade-vault-standalone.html` (mockup estático de
  diseño, no código de la app, no un secreto real) — sin valores de secretos
  reales commiteados.
- **AP4** limpio: `next.config.ts` tiene exactamente los 3 headers de la
  baseline del spec 13 (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`) sobre `source: '/(.*)'`, ni uno más. No había dev server
  levantado, no se levantó uno solo para esto (regla del agente).
- **AP5 → SEC-005** (nuevo, Bajo, **no arreglado** — techo del ítem):
  `error.message` crudo devuelto/lanzado al cliente en los 5 archivos
  `'use server'` (`app/auth/actions.ts:signInWithEmail/signUpWithEmail`,
  `app/actions/getGames.ts:getGames/getGame`,
  `app/actions/getLeaderboard.ts:getGameLeaderboard/getGlobalLeaderboard`,
  `app/actions/saveScore.ts:saveScore`, `app/about/actions.ts:sendContactEmail`).
  Techo Bajo por definición del ítem — ninguno de estos mensajes contiene un
  secreto, solo texto de error de Supabase/Resend. Se deja nombrado, no se
  toca.

**Nota fuera de checklist (no hallazgo, solo observación):** al grepear
`redirect(` aparecieron `proxy.ts` y `app/auth/callback/route.ts` — ambos
son, respectivamente, el gating de rutas y el callback OAuth, territorio
explícito de los specs 12/14 que este agente no audita (y AP2 limita su
verificación a archivos `'use server'`, que ninguno de los dos es). No se
evaluaron ni se tocaron.

**SQL propuesto entregado** (SEC-003 — no ejecutado, ver "El principio
rector"):

```sql
-- Revoca privilegios de tabla que ninguna policy de `games`/`scores` habilita.
-- RLS ya bloquea UPDATE/DELETE por deny-by-default; el caso relevante es
-- TRUNCATE, que RLS no filtra.
revoke truncate, references, trigger, update, delete on public.games from anon, authenticated;
revoke truncate, references, trigger, update, delete on public.scores from anon, authenticated;
```

Verificación post-aplicación:

```sql
select grantee, table_name,
       string_agg(privilege_type, ', ' order by privilege_type) as privs
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon','authenticated')
group by 1,2
order by 1,2;
-- Esperado: "games" → SELECT ; "scores" → INSERT, SELECT (para anon y authenticated).
```

Reversión:

```sql
grant truncate, references, trigger, update, delete on public.games to anon, authenticated;
grant truncate, references, trigger, update, delete on public.scores to anon, authenticated;
```

- **Archivos que se tocaron:** `app/about/actions.ts` (SEC-001),
  `app/actions/saveScore.ts` (SEC-002), `references/Security/audit-log.md`
  (esta memoria). No se tocó `CLAUDE.md` ni `.claude/agents/security-auditor.md`
  (ya venían modificado/sin trackear antes de esta corrida).
- **Build:** verde (`npm run build`, una corrida después de cada edición).

## Relacionado

- `references/Security/checklist.md` — el checklist del spec 13 (estado
  deseado). **Este agente no lo edita.**
- `specs/13-security-hardening.md` — las decisiones cerradas que alimentan
  la anti-lista.
- `references/game-skins.md`, `references/mobile-porter-todo.md`,
  `references/game-performance-booster-todo.md` — memorias equivalentes de
  los otros subagentes.
