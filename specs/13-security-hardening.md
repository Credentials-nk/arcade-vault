# SPEC 13 — Hardening de seguridad

> **Estado:** Implementado · **Depende de:** 04-supabase-setup, 09-games-catalog-supabase, 12-autenticacion · **Fecha:** 2026-07-24
> **Objetivo:** Cerrar los warnings del Security Advisor de Supabase y los items de `references/Security/checklist.md` que se resuelven con código o migraciones, y documentar como prerrequisito manual los que solo se pueden tocar desde el dashboard de Supabase.

## Por qué existe este spec

Se creó `references/Security/checklist.md` con 5 items de seguridad más una tabla pegada del Security Advisor de Supabase (4 warnings reales del proyecto). Antes de tocar nada se investigó cada item contra el código y el esquema real: RLS ya estaba habilitado en ambas tablas; `scores` ya tiene CHECK constraints y FK que validan los datos independientemente de RLS; la función `rls_auto_enable()` es un helper de infraestructura sin relación con el código de la app; y 3 de los 5 items del checklist (min password length, leaked password protection, rate limit de signup) son toggles de dashboard de Supabase sin equivalente en código — mismo patrón que "Confirm email" en el spec 12.

## Scope

**In:**

- Migración que reemplaza la policy `public insert` de `scores` (hoy `WITH CHECK (true)`) por una versión explícita, acotada a los roles `anon`/`authenticated`, sin cambiar el comportamiento actual (el guardado de score sin sesión sigue funcionando).
- Migración que revoca `EXECUTE` sobre `public.rls_auto_enable()` de `PUBLIC`/`anon`/`authenticated`, cerrando el warning de función `SECURITY DEFINER` invocable como RPC público.
- Headers de seguridad en `next.config.ts` (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) aplicados a todas las rutas.
- Corrección de `minLength={6}` → `minLength={8}` en el input de contraseña de `app/auth/page.tsx`, para que el formulario quede alineado al mínimo objetivo de 8 caracteres.
- Actualización de `references/Security/checklist.md` marcando lo resuelto y documentando los 3 prerrequisitos de dashboard pendientes.

**Fuera de scope (para specs futuros):**

- Rate limiting de signup implementado en la app (tabla propia, contador in-memory, etc.). Decisión tomada: se resuelve con los Rate Limits nativos de Supabase (dashboard), sin infraestructura nueva.
- Configurar min password length, leaked password protection y signup rate limits en el dashboard de Supabase — son prerrequisitos manuales, no código; no se pueden aplicar desde acá.
- Content-Security-Policy u otros headers más allá de los 3 del checklist.
- Vincular `scores.user_id` a `auth.users` (ya fuera de scope del spec 12, sigue sin relación con este spec).

## Modelo de datos

No introduce estructuras nuevas. Ajusta una RLS policy existente y revoca un grant existente:

```sql
-- scores: policy "public insert" (antes: WITH CHECK (true) sobre el pseudo-rol "public")
create policy "public insert" on public.scores
  for insert
  to anon, authenticated
  with check (
    game_id is not null
    and player_name is not null
    and char_length(player_name) <= 10
    and score >= 0
  );

-- rls_auto_enable: función SECURITY DEFINER del event trigger "ensure_rls"
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
```

Las condiciones del `WITH CHECK` son redundantes con los CHECK constraints ya existentes de la tabla (`scores_player_name_check`, `scores_score_check`) y la FK `scores_game_id_fkey` — se agregan para que la policy sea explícita y documentada, no para cambiar qué datos se aceptan.

## Plan de implementación

1. Aplicar la migración `harden_scores_insert_policy` vía `mcp__supabase__apply_migration`. Verificar: `select * from pg_policies where tablename='scores'` muestra la nueva policy con `roles = {anon,authenticated}`.
2. Aplicar la migración `revoke_public_execute_rls_auto_enable` vía `mcp__supabase__apply_migration`. Verificar: crear una tabla de prueba, confirmar que `ensure_rls` le habilita RLS automáticamente, dropear la tabla.
3. Agregar `headers()` a `next.config.ts`. Verificar: `npm run build` sin errores; `curl -I` a `/` en dev muestra los 3 headers.
4. Cambiar `minLength` en `app/auth/page.tsx`. Verificar: `tsc --noEmit` sin errores.
5. Actualizar `references/Security/checklist.md` con el estado real de cada item. Verificar: lectura manual, ningún item ambiguo.
6. Correr `mcp__supabase__get_advisors` (security) y confirmar que los 3 warnings resueltos por SQL ya no aparecen (el de leaked password protection sigue apareciendo hasta que se configure el dashboard — esperado). Marcar este spec como `Implementado` y commitear.

## Criterios de aceptación

- [x] `select rowsecurity from pg_tables where tablename in ('games','scores')` da `true` para ambas (ya era así, se re-verifica).
- [x] La policy `public insert` de `scores` tiene `roles = {anon,authenticated}` y un `with_check` explícito (no `true` literal).
- [x] Guardar un score sin sesión iniciada (modo invitado) sigue funcionando igual que antes de la migración. _(Verificado con `set role anon; insert ...` — inserta correctamente.)_
- [x] `anon` y `authenticated` ya no pueden ejecutar `rls_auto_enable()` vía `/rest/v1/rpc/rls_auto_enable` (permission denied), y crear una tabla nueva le sigue habilitando RLS automáticamente. _(Smoke test: tabla `_rls_smoke_test` quedó con `rowsecurity = true` automáticamente.)_
- [x] `mcp__supabase__get_advisors` (security) ya no lista `rls_policy_always_true`, `anon_security_definer_function_executable` ni `authenticated_security_definer_function_executable`. _(Solo queda `auth_leaked_password_protection`, esperado — dashboard-only.)_
- [x] `curl -I http://localhost:3000/` (dev) incluye `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` y `Referrer-Policy: strict-origin-when-cross-origin`.
- [x] El input de contraseña en `/auth` exige mínimo 8 caracteres en el navegador.
- [x] `references/Security/checklist.md` refleja el estado real: 3 items resueltos, 3 items marcados como pendiente de dashboard con instrucciones concretas.
- [x] `npm run build` completa sin errores de TypeScript ni ESLint.

## Decisiones

- **Sí:** tocar la policy de `scores` en vez de dejarla `WITH CHECK (true)`. Razón: cierra el warning del advisor sin requerir auth para guardar score (modo invitado se preserva, decisión ya tomada en el spec 12).
- **No:** requerir sesión para insertar en `scores`. Razón: rompería el modo invitado, explícitamente fuera de scope desde el spec 12.
- **Sí:** revocar `EXECUTE` de `rls_auto_enable()` en vez de dropear la función/trigger. Razón: es el remedio que la propia documentación de Supabase enlazada en el advisor recomienda; mantiene el auto-enable de RLS en tablas futuras como red de seguridad.
- **Sí:** resolver el rate limit de signup solo con el dashboard nativo de Supabase. Razón (decisión del usuario): evita agregar una tabla o dependencia nueva (Redis/Upstash) para algo que la plataforma ya cubre; coincide con el criterio de simplicidad ya usado en los specs 09 y 12.
- **No:** Content-Security-Policy completo. Razón: no estaba en el checklist original y agregar un CSP mal calibrado puede romper estilos/scripts inline existentes; queda para un spec dedicado si se decide perseguirlo.

## Riesgos

| Riesgo                                                                   | Mitigación                                                                                                             |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Revocar `EXECUTE` de `rls_auto_enable()` podría desactivar el auto-RLS   | Se verifica con una tabla de prueba real antes de dar el paso por bueno (paso 2 del plan).                             |
| La nueva policy de `scores` rompe el guardado de score sin sesión        | El `with_check` es deliberadamente equivalente a los CHECK constraints ya vigentes; se re-prueba el flujo de invitado. |
| Los 3 prerrequisitos de dashboard quedan sin hacer si nadie los recuerda | Se documentan explícitamente en `references/Security/checklist.md`, mismo patrón que "Confirm email" en el spec 12.    |

## Lo que **no** está en este spec

- Rate limiting de signup en código de la app.
- Configuración de los toggles de dashboard de Supabase (password mínimo, leaked password protection, rate limits) — son manuales, quedan documentados pero no ejecutados por este spec.
- Content-Security-Policy u otros headers adicionales.
- `scores.user_id` / RLS de ownership sobre `scores`.

Cada uno, si llega, va en su propio spec.
