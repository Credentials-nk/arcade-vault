## Arcade Vault

Es una plataforma para jugar online y competir por la mayor cantidad de puntos.

## Usa Spec Driven Design

Basado en /spec y /spec-impl

Siguiendo las buenas practicas recomendadas aquí:
https://github.com/Klerith/fernando-skills

## Skills usadas

```bash
npx skills@latest add Klerith/fernando-skills
```

## Entornos y base de datos

Dos proyectos de Supabase en la org `NexoraDev`:

| Entorno     | Proyecto           | Quién lo usa                                       |
| ----------- | ------------------ | -------------------------------------------------- |
| Desarrollo  | `ArcadeVault-dev`  | `.env.local` y el servidor MCP (`.mcp.json`)       |
| Producción  | `ArcadeVault-prod` | El deploy. **Sin MCP**, se opera solo con la CLI   |

### Las migraciones son la fuente de verdad

El esquema vive en `supabase/migrations/`, versionado en el repo. No se hacen cambios de
esquema desde el dashboard ni desde el MCP: se escribe una migración y se aplica.

```bash
supabase login                             # una vez por máquina
supabase link --project-ref <REF>          # elegí a qué proyecto apuntás
supabase migration list                    # compara Local vs Remote
supabase db push                           # aplica lo que falte
```

`supabase link` es persistente: verificá contra cuál estás linkeado antes de cada `push`.

Para producción hay además configuración que no es código (providers OAuth, redirect URLs,
políticas de password, rate limits). Está en `references/Security/prod-setup.md`.

### Variables de entorno

`.env.local` (no se commitea) apunta a desarrollo:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_DB_PASSWORD     # solo para la CLI, la app no la usa
RESEND_API_KEY
```

Las de producción se cargan en el hosting, nunca en el repo.
