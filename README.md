# House Dojo

Juego de puntos para los niños: tareas que suman, comportamientos que restan y recompensas que se canjean.
React + Vite en el cliente, Supabase (Postgres + Auth + Realtime) como backend. La seguridad vive en las
políticas RLS de `supabase/migrations/`, no en el cliente.

## Desarrollo

Todo se ejecuta dentro del devcontainer (`.devcontainer/`): ábrelo con VS Code ("Reopen in Container")
o con `devcontainer up --workspace-folder .`. Trae Node 22, GitHub CLI y Docker (para Supabase local).

```bash
cp .env.example .env.local   # valores del proyecto en Supabase
npm run dev                  # http://localhost:5173
npm run db:start             # Postgres de Supabase local con las migraciones
npm test                     # tests pgTAP de supabase/tests/
npm run build
```

Cambios de esquema: `npx supabase migration new <nombre>`, nunca editar una migración ya aplicada.

## Despliegue

`.github/workflows/ci.yml`: en cada PR, lint + build + tests. En `main`, además aplica las migraciones
al proyecto de Supabase y publica la web en GitHub Pages.

Configuración del repo en GitHub:
- Secret: `SUPABASE_DB_URL` (Connect > Session pooler, con la contraseña de la BD)
- Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- Settings > Pages > Source: GitHub Actions
