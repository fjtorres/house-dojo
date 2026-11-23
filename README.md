# House Dojo

Juego de puntos para los niños: tareas que suman, comportamientos que restan y recompensas que se canjean.
React + Vite en el cliente, Supabase (Postgres + Auth + Realtime) como backend. La seguridad vive en las
políticas RLS de `supabase/migrations/`, no en el cliente.

## Desarrollo

Todo se ejecuta dentro del devcontainer (`.devcontainer/`): ábrelo con VS Code ("Reopen in Container")
o con `devcontainer up --workspace-folder .`. Trae Node 22, GitHub CLI y Docker (para Supabase local).

```bash
npm run supabase:start       # Supabase local sin los servicios que no usamos
cp .env.example .env.local   # con la URL y la publishable key que imprime el comando anterior
npm run dev                  # http://localhost:5173 (los emails de login llegan a http://localhost:54324)
npm test                     # tests pgTAP de supabase/tests/
npm run test:e2e             # Playwright en e2e/: padre y tablet en dos navegadores (arranca Vite solo)
npm run build
npm run types                # regenera src/lib/database.types.ts tras cambiar el esquema
```

Para solo los tests de base de datos basta `npm run db:start` en lugar de `npm run supabase:start`.

Cada cambio lleva su test: los de seguridad y datos en pgTAP (`supabase/tests/`), los de pantallas
en la spec de Playwright (`e2e/`). Si falla en CI, la traza queda como artefact `playwright-traces`
del job: `npx playwright show-trace <zip>`.

Cambios de esquema: `npx supabase migration new <nombre>`, nunca editar una migración ya aplicada.

## Despliegue

`.github/workflows/ci.yml`: en cada PR, lint + build + tests pgTAP (job `test`) y Playwright (job `e2e`). En `main`, además aplica las migraciones
al proyecto de Supabase y publica la web en GitHub Pages.

Configuración del repo en GitHub:
- Secret: `SUPABASE_DB_URL` (Connect > Session pooler, con la contraseña de la BD)
- Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- Settings > Pages > Source: GitHub Actions

Configuración del proyecto en Supabase (panel):
- Authentication > Sign In / Providers: activar *anonymous sign-ins* (la tablet de los niños entra así y se une con el código).
- Authentication > URL Configuration: *Site URL* `https://fjtorres.github.io/house-dojo/` (y añadirla a *Redirect URLs*).

## Administración

Las familias nuevas quedan *pendientes* hasta que un administrador las aprueba en `#/admin`
(🛡️ en la cabecera). Hasta entonces no se pueden usar ni unirse a ellas, y cada usuario solo puede
tener una solicitud pendiente. Desde ahí también se rechazan solicitudes y se borran familias completas.

El rol se da a mano en Supabase (SQL Editor), a un usuario que ya haya entrado alguna vez:

```sql
insert into public.admins (user_id) select id from auth.users where email = 'tu@email';
```

Las familias de un administrador se aprueban solas, así que la primera familia no necesita a nadie más.
Para quitar el rol: `delete from public.admins where user_id = '<uuid>';`

## Cómo funciona

- Los padres entran con un enlace por email; el primero pide la familia y, cuando un administrador la aprueba, ve su código en ⚙️ Padres.
- La tablet de los niños entra sin email («Dispositivo de los niños») y se une con el código: rol `child`.
- Quien se une con el código entra como `child`; un padre lo sube a `parent` desde ⚙️ Padres.
- Lo que marca un niño queda *por aprobar*; lo que marca un padre cuenta al momento y se puede anular.
- Cada movimiento guarda quién lo propuso, aprobó, rechazó o anuló y cuándo (`transaction_events`, escrito
  solo por un trigger). Se ve pulsando el movimiento en el historial; los niños ven «papá o mamá» en vez del email.

## Idiomas

La app está en español e inglés. Usa el idioma del navegador (si no lo tiene, español) y recuerda el que se
elija en el selector 🌐 (pantalla de entrada o menú). Los textos están en `src/i18n/`; para añadir un idioma,
copia `en.tsx`, tradúcelo (TypeScript avisa de cualquier texto que falte) y añádelo a `languages` en
`src/i18n/index.ts`.
