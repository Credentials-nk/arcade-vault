# SPEC 03 — Pantalla About con formulario de contacto vía Resend

> **Estado:** Implementado · **Depende de:** 02-home-screen · **Fecha:** 2026-06-25
> **Objetivo:** Implementar la pantalla About en `/about` siguiendo el template de referencia, con formulario de contacto funcional que envía emails a nikolas090189@gmail.com usando Resend.

## Scope

**In:**

- Pantalla `About` (`/about`): sección hero con misión, highlights (3 cards), divider de píxeles animado y sección de contacto — fiel al template `references/home-about/about.jsx`.
- Formulario de contacto con campos nombre, email y mensaje; validación client-side (campos vacíos = shake del form).
- Estado de éxito: terminal animada con el mensaje "MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, [NOMBRE]." y botón "ENVIAR OTRO MENSAJE".
- Estado de error: mensaje inline bajo el botón si Resend devuelve un error.
- Server Action de Next.js (`app/about/actions.ts`) que llama a la API de Resend.
- Configuración de variable de entorno `RESEND_API_KEY` en `.env.local`.
- Estilos CSS de About ya presentes en `globals.css` (agregados en spec-02 desde `references/home-about/styles.css`).

**Fuera de scope:**

- Verificación de dominio propio en Resend (se usa `onboarding@resend.dev` como remitente).
- Rate limiting o anti-spam en el formulario.
- Guardar mensajes en base de datos.
- Notificación de confirmación al remitente (solo se notifica al destinatario).
- Tests automatizados del Server Action.

## Modelo de datos

No se introducen nuevas estructuras persistentes. El formulario opera con estado local de React y el Server Action no persiste nada en base de datos.

```ts
// Payload que recibe el Server Action
interface ContactPayload {
  name: string;
  email: string;
  msg: string;
}

// Respuesta del Server Action
type ContactResult =
  | { ok: true }
  | { ok: false; error: string };
```

Variable de entorno requerida en `.env.local`:
```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
```

## Plan de implementación

1. Crear rama `spec-03-about-contact` desde `main`.

2. Instalar Resend: `npm install resend`. Verificar: `package.json` incluye `resend`.

3. Crear `.env.local` con `RESEND_API_KEY=re_xxxxxxxxxxxxxxxx`.
   Verificar que `.env.local` está en `.gitignore` (ya debería estarlo).

4. Crear `app/about/actions.ts` — Server Action `sendContactEmail`:
   - Recibe `ContactPayload`, valida que ningún campo esté vacío.
   - Llama a `resend.emails.send({ from: "onboarding@resend.dev", to: "nikolas090189@gmail.com", subject: "...", html: "..." })`.
   - Devuelve `ContactResult`.
   Verificar: `tsc --noEmit` sin errores.

5. Crear `app/about/page.tsx` — pantalla About traduciendo `about.jsx` a TypeScript/Next.js:
   - `HighlightIcon`: íconos pixel SVG (HEART, BROWSER, PLANT), sin cambios.
   - Sección hero: kicker, título, misión, 3 highlight cards con `useReveal` (mismo hook que en Home, extraído a `hooks/useReveal.ts`).
   - Divider animado de píxeles.
   - Sección contacto: formulario con estados `form`, `sent`, `shake` y `error`.
   - Al submit: valida campos → si vacíos, activa `shake`; si válidos, llama al Server Action → si ok, muestra terminal de éxito; si error, muestra mensaje inline.
   Verificar: `/about` renderiza sin errores de TypeScript.

6. Extraer `useReveal` a `hooks/useReveal.ts` y actualizar `app/page.tsx` para importarlo desde ahí.
   Verificar: Home sigue funcionando correctamente.

7. Ejecutar `npm run build` y corregir errores de TypeScript o ESLint.
   Crear PR `spec-03-about-contact` → `main`.

## Criterios de aceptación

- [ ] `npm run build` completa sin errores de TypeScript ni ESLint.
- [ ] `/about` carga y muestra la sección hero con el título "ACERCA DE ARCADE VAULT" y el texto de misión.
- [ ] Las 3 highlight cards (HEART, BROWSER, PLANT) se muestran con sus íconos pixel y colores correctos.
- [ ] El divider animado de píxeles aparece entre las secciones.
- [ ] El formulario de contacto muestra los campos nombre, email y mensaje.
- [ ] Enviar el formulario con campos vacíos activa la animación shake y no llama al Server Action.
- [ ] Enviar el formulario con datos válidos muestra un estado de carga (botón deshabilitado).
- [ ] Tras envío exitoso, se muestra la terminal animada con el nombre del remitente en mayúsculas.
- [ ] El botón "ENVIAR OTRO MENSAJE" resetea el formulario al estado inicial.
- [ ] Si Resend devuelve un error, se muestra un mensaje de error inline bajo el botón.
- [ ] El email llega a nikolas090189@gmail.com con el asunto y cuerpo correctos.
- [ ] El link "Acerca de" en la Nav navega a `/about` y queda marcado como activo.
- [ ] Las secciones con `.reveal` aparecen con animación al hacer scroll.
- [ ] `useReveal` está extraído en `hooks/useReveal.ts` y tanto Home como About lo importan desde ahí.

## Decisiones

- **Sí:** Server Action de Next.js para llamar a Resend. Razón: evita exponer la API key
  en el cliente; es la forma idiomática en Next.js App Router para mutaciones de servidor.
- **Sí:** `onboarding@resend.dev` como remitente. Razón: dominio sandbox de Resend, no
  requiere verificación; suficiente para el MVP. Se puede cambiar a dominio propio en un spec futuro.
- **Sí:** Validación client-side + server-side. Razón: el shake de client-side da feedback
  inmediato; la validación en el Server Action es la barrera real de seguridad.
- **Sí:** Extraer `useReveal` a `hooks/useReveal.ts`. Razón: evita duplicar el hook en
  Home y About; si se agrega una tercera pantalla, ya está disponible.
- **No:** Rate limiting en este spec. Razón: requiere Redis o similar; fuera del alcance del MVP.
- **No:** Confirmación al remitente. Razón: complejidad extra sin valor inmediato para el MVP.
- **No:** Guardar mensajes en base de datos. Razón: no hay backend aún; el email es suficiente.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| `RESEND_API_KEY` no definida en producción | El Server Action devuelve `{ ok: false, error: "..." }` y el formulario muestra el mensaje de error inline. Documentar en el README que la variable es obligatoria. |
| Resend rechaza `onboarding@resend.dev` como `from` si la cuenta no está en modo sandbox | Verificar en el dashboard de Resend que la cuenta permite el dominio sandbox antes de implementar. |
| `useEffect` de `useReveal` ejecutándose en SSR | El hook ya usa `IntersectionObserver` dentro de `useEffect`, que solo corre en el cliente. No hay riesgo real. |
