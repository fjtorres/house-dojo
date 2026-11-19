# House Dojo

Juego de puntos para los niños: tareas que suman, comportamientos que restan y recompensas que se canjean.
React + Vite en el cliente, Supabase (Postgres + Auth + Realtime) como backend. La seguridad vive en las
políticas RLS de `supabase/migrations/`, no en el cliente.

## Desarrollo

Todo se ejecuta dentro del devcontainer (`.devcontainer/`): ábrelo con VS Code ("Reopen in Container")
o con `devcontainer up --workspace-folder .`. Trae Node 22, GitHub CLI y Docker (para Supabase local).

```bash
npx supabase start -x storage-api,imgproxy,studio,edge-runtime,logflare,vector,supavisor
cp .env.example .env.local   # con la URL y la publishable key que imprime el comando anterior
npm run dev                  # http://localhost:5173 (los emails de login llegan a http://localhost:54324)
npm test                     # tests pgTAP de supabase/tests/
npm run build
npm run types                # regenera src/lib/database.types.ts tras cambiar el esquema
```

Para solo los tests de base de datos basta `npm run db:start` en lugar de `supabase start`.

Cambios de esquema: `npx supabase migration new <nombre>`, nunca editar una migración ya aplicada.

## Despliegue

`.github/workflows/ci.yml`: en cada PR, lint + build + tests. En `main`, además aplica las migraciones
al proyecto de Supabase y publica la web en GitHub Pages.

Configuración del repo en GitHub:
- Secret: `SUPABASE_DB_URL` (Connect > Session pooler, con la contraseña de la BD)
- Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- Settings > Pages > Source: GitHub Actions

Configuración del proyecto en Supabase (panel):
- Authentication > Sign In / Providers: activar *anonymous sign-ins* (la tablet de los niños entra así y se une con el código).
- Authentication > URL Configuration: *Site URL* `https://fjtorres.github.io/house-dojo/` (y añadirla a *Redirect URLs*).

## Cómo funciona

- Los padres entran con un enlace por email; el primero crea la familia y ve su código en ⚙️ Padres.
- La tablet de los niños entra sin email («Dispositivo de los niños») y se une con el código: rol `child`.
- Quien se une con el código entra como `child`; un padre lo sube a `parent` desde ⚙️ Padres.
- Lo que marca un niño queda *por aprobar*; lo que marca un padre cuenta al momento y se puede anular.
