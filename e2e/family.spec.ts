import { execSync } from 'node:child_process'
import { expect, test, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const APP = 'http://127.0.0.1:5173/'
const MAILPIT = 'http://127.0.0.1:54324/api/v1' // local Supabase stack's mail catcher

async function magicLink(email: string) {
  let link: string | undefined
  await expect.poll(async () => {
    const { messages } = await (await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:${email}`)}`)).json() as { messages: { ID: string }[] }
    if (!messages.length) return undefined
    const message = await (await fetch(`${MAILPIT}/message/${messages[0].ID}`)).json() as { Text: string }
    link = message.Text.match(/https?:\/\/\S+verify\S+/)?.[0]
    return link
  }, { message: 'magic link email arrives', timeout: 15_000 }).toBeTruthy()
  return link!
}

async function logIn(page: Page, email: string) {
  await page.goto(APP)
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Enviarme un enlace' }).click()
  await expect(page.getByText('Te hemos enviado')).toBeVisible()
  await page.goto(await magicLink(email))
}

// Admins are granted by hand in the database; the test does it with the local stack's service key.
async function grantAdmin(email: string) {
  const env = Object.fromEntries([...execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).matchAll(/^(\w+)="(.*)"$/gm)].map((m) => [m[1], m[2]]))
  const service = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 })
  const user = data.users.find((u) => u.email === email)!
  const { error } = await service.from('admins').insert({ user_id: user.id })
  expect(error).toBeNull()
}

function collectErrors(page: Page, who: string, errors: string[]) {
  page.on('pageerror', (e) => errors.push(`${who}: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${who}: ${m.text()}`) })
}

test('admin approves a family, parent sets it up, kid earns points and redeems a reward', async ({ browser }) => {
  const run = Date.now()
  const family = `Los Test ${run}`
  const parentEmail = `parent${run}@example.com`
  const parent = await (await browser.newContext({ viewport: { width: 1024, height: 900 } })).newPage()
  const kid = await (await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true })).newPage()
  const admin = await (await browser.newContext({ viewport: { width: 1024, height: 900 } })).newPage()
  const errors: string[] = []
  collectErrors(parent, 'parent', errors)
  collectErrors(kid, 'kid', errors)
  collectErrors(admin, 'admin', errors)

  await test.step('parent logs in with a magic link and requests a family, which waits for approval', async () => {
    await logIn(parent, parentEmail)
    await parent.getByLabel('Nombre de la familia').fill(family)
    await parent.getByRole('button', { name: 'Crear' }).click()
    await expect(parent.getByRole('heading', { name: `«${family}» está pendiente de aprobación` })).toBeVisible()
  })

  await test.step('admin sees the request with the email and approves it; the parent screen unlocks live', async () => {
    const adminEmail = `admin${run}@example.com`
    await logIn(admin, adminEmail)
    await expect(admin.getByRole('heading', { name: 'Crear una familia' })).toBeVisible()
    await expect(admin.getByRole('link', { name: /Administración/ }), 'not admin yet').toHaveCount(0)
    await grantAdmin(adminEmail)
    await admin.reload()
    await admin.getByRole('link', { name: /Administración/ }).click()
    const request = admin.locator('.rows li', { hasText: family })
    await expect(request).toContainText(parentEmail)
    await request.getByRole('button', { name: /Aprobar/ }).click()
    await expect(admin.locator('.card', { hasText: 'Familias aprobadas' }).locator('.rows li', { hasText: family })).toBeVisible()
    await expect(parent.getByRole('link', { name: '⚙️ Padres' })).toBeVisible({ timeout: 10_000 })
  })

  await test.step('a rejected request shows a notice and lets the user ask again', async () => {
    const other = await (await browser.newContext()).newPage()
    collectErrors(other, 'other', errors)
    await logIn(other, `other${run}@example.com`)
    await other.getByLabel('Nombre de la familia').fill(`Rechazada ${run}`)
    await other.getByRole('button', { name: 'Crear' }).click()
    await expect(other.getByText('pendiente de aprobación')).toBeVisible()
    await admin.reload()
    await admin.locator('.rows li', { hasText: `Rechazada ${run}` }).getByRole('button', { name: /Rechazar/ }).click()
    await expect(admin.locator('.card', { hasText: 'Rechazadas' }).locator('.rows li', { hasText: `Rechazada ${run}` })).toBeVisible()
    await expect(other.getByRole('heading', { name: `No se aceptó «Rechazada ${run}»` })).toBeVisible({ timeout: 10_000 })
    await expect(other.getByRole('button', { name: 'Crear' }), 'can ask again').toBeVisible()
    await other.context().close()
  })

  await test.step('parent adds a child from its own page', async () => {
    await parent.getByRole('link', { name: '⚙️ Padres' }).click()
    await expect(parent.locator('form'), 'no form until + is pressed').toHaveCount(0)
    await parent.getByRole('link', { name: 'Añadir niño' }).click()
    const form = parent.locator('form')
    await form.getByRole('radio', { name: '🦊' }).click()
    await form.getByLabel('Nombre').fill('Ana')
    await form.getByRole('button', { name: 'Añadir' }).click()
    await expect(parent.locator('.rows li', { hasText: 'Ana' })).toBeVisible()
    await expect(parent).toHaveURL(/#\/parents\/children$/)
  })

  await test.step('parent adds tasks, penalties and rewards', async () => {
    await parent.getByRole('link', { name: '📋 Tareas' }).click()
    const items = [
      ['earn', '📚', 'Hacer los deberes', 10], ['earn', '🧹', 'Recoger la habitación', 5],
      ['penalty', '😠', 'Gritar', 5], ['reward', '📺', 'Ver la TV', 15], ['reward', '🎬', 'Ir al cine', 50],
    ] as const
    for (const [kind, icon, name, points] of items) {
      await parent.getByRole('link', { name: 'Añadir tarea' }).click()
      const form = parent.locator('form')
      await form.getByLabel('Tipo').selectOption(kind)
      await form.getByRole('radio', { name: icon }).click()
      await form.getByLabel('Nombre').fill(name)
      await form.getByLabel('Puntos').fill(String(points))
      await form.getByRole('button', { name: 'Añadir' }).click()
      await expect(parent.locator('.rows li', { hasText: name })).toBeVisible()
    }
  })

  await test.step('parent edits an item; the form starts with its current values', async () => {
    await parent.locator('.rows li', { hasText: 'Gritar' }).getByRole('link', { name: 'Editar' }).click()
    const form = parent.locator('form')
    await expect(form.getByLabel('Tipo')).toHaveValue('penalty')
    await expect(form.getByRole('radio', { name: '😠' })).toHaveAttribute('aria-checked', 'true')
    await form.getByRole('radio', { name: '🤬' }).click()
    await form.getByLabel('Nombre').fill('Decir palabrotas')
    await form.getByLabel('Puntos').fill('8')
    await form.getByRole('button', { name: 'Guardar' }).click()
    await expect(parent.locator('.rows li', { hasText: 'Decir palabrotas' })).toContainText('-8')
    await expect(parent.locator('.rows li', { hasText: 'Decir palabrotas' })).toContainText('🤬')
  })

  await test.step('parent edits a child; browser back returns to the edit page', async () => {
    await parent.getByRole('link', { name: '🧒 Niños' }).click()
    await parent.locator('.rows li', { hasText: 'Ana' }).getByRole('link', { name: 'Editar' }).click()
    const form = parent.locator('form')
    await expect(form.getByRole('radio', { name: '🦊' })).toHaveAttribute('aria-checked', 'true')
    await form.getByRole('radio', { name: '🐼' }).click()
    await form.getByLabel('Nombre').fill('Ana María')
    await form.getByRole('button', { name: 'Guardar' }).click()
    await expect(parent.locator('.rows li', { hasText: 'Ana María' })).toContainText('🐼')
    await parent.goBack()
    await expect(parent.getByRole('heading', { name: /Editar a/ })).toBeVisible()
  })

  const code = await test.step('parent reads the invite code', async () => {
    await parent.getByRole('link', { name: '🔑 Código' }).click()
    return (await parent.locator('.code').textContent())!.trim()
  })

  await test.step('kid tablet joins anonymously with the code', async () => {
    await kid.goto(APP)
    await kid.getByRole('button', { name: /Usar este dispositivo/ }).click()
    await kid.getByLabel('Código').fill(` ${code.toUpperCase()} `)
    await kid.getByLabel('Nombre de este dispositivo').fill('Tablet del salón')
    await kid.getByRole('button', { name: 'Unirme' }).click()
    await kid.locator('.kid-card').click()
    await expect(kid.getByText('Restar puntos'), 'kid does not see penalties').toHaveCount(0)
    await expect(kid.getByRole('link', { name: '⚙️ Padres' }), 'kid has no parent panel').toHaveCount(0)
    await expect(kid.getByRole('button', { name: /Ver la TV/ }), 'reward locked without points').toBeDisabled()
  })

  await test.step('kid proposes a task; parent sees it live and approves', async () => {
    await kid.getByRole('button', { name: /Hacer los deberes/ }).click()
    await expect(kid.locator('.toast')).toBeVisible()
    await parent.getByRole('link', { name: '← Volver' }).click()
    await expect(parent.getByText('1 por aprobar')).toBeVisible({ timeout: 10_000 })
    await parent.locator('.kid-card').click()
    await parent.getByRole('button', { name: 'Aprobar' }).click()
    await expect(parent.locator('.hero-points')).toHaveText('10 ⭐')
    await parent.getByRole('button', { name: /Recoger la habitación/ }).click()
    await expect(parent.locator('.hero-points')).toHaveText('15 ⭐')
  })

  await test.step('kid sees the points live, redeems the reward, which then reserves the points', async () => {
    await expect(kid.locator('.hero-points')).toHaveText('15 ⭐', { timeout: 10_000 })
    await expect(kid.getByRole('button', { name: /Ver la TV/ })).toBeEnabled()
    await kid.getByRole('button', { name: /Ver la TV/ }).click()
    await expect(kid.getByRole('button', { name: /Ver la TV/ }), 'pending reward reserves the points').toBeDisabled()
  })

  await test.step('parent approves the reward; balance back to 0', async () => {
    await parent.getByRole('button', { name: 'Aprobar' }).click()
    await expect(parent.locator('.hero-points')).toHaveText('0 ⭐')
  })

  await test.step('parent undoes an approved movement through the in-app dialog', async () => {
    const undo = parent.locator('.history li', { hasText: 'Ver la TV' }).getByRole('button', { name: 'Anular' })
    const dialog = parent.getByRole('dialog', { name: '¿Anular este movimiento?' })
    await undo.click()
    await expect(dialog).toContainText('Ver la TV')
    await parent.keyboard.press('Escape')
    await expect(dialog, 'Escape cancels').toBeHidden()
    await expect(parent.locator('.hero-points')).toHaveText('0 ⭐')
    await undo.click()
    await dialog.getByRole('button', { name: 'Anular' }).click()
    await expect(parent.locator('.hero-points')).toHaveText('15 ⭐')
    await expect(parent.locator('.history li', { hasText: 'Ver la TV' })).toContainText('anulado')
  })

  await test.step('no horizontal scroll at phone width', async () => {
    await parent.setViewportSize({ width: 390, height: 844 })
    await parent.getByRole('link', { name: '← Volver' }).click()
    expect(await parent.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  })

  await test.step('parent deletes a child after confirming in the dialog', async () => {
    await parent.getByRole('link', { name: '⚙️ Padres' }).click()
    const remove = parent.locator('.rows li', { hasText: 'Ana María' }).getByRole('button', { name: 'Borrar' })
    const dialog = parent.getByRole('dialog', { name: '¿Borrar a Ana María?' })
    await remove.click()
    await dialog.getByRole('button', { name: 'Cancelar' }).click()
    await expect(dialog).toBeHidden()
    await expect(parent.locator('.rows li', { hasText: 'Ana María' })).toBeVisible()
    await remove.click()
    await dialog.getByRole('button', { name: 'Borrar' }).click()
    await expect(parent.locator('.rows li', { hasText: 'Ana María' })).toHaveCount(0)
  })

  expect(errors, 'no browser errors').toEqual([])

  await test.step('admin deletes the whole family after confirming', async () => {
    await admin.reload()
    await admin.setViewportSize({ width: 390, height: 844 })
    await expect(admin.locator('.rows li', { hasText: family })).toBeVisible()
    expect(await admin.evaluate(() => document.documentElement.scrollWidth > innerWidth), 'no horizontal scroll on phone').toBe(false)
    const row = admin.locator('.rows li', { hasText: family })
    await row.getByRole('button', { name: 'Borrar' }).click()
    await admin.getByRole('dialog', { name: `¿Borrar la familia «${family}»?` }).getByRole('button', { name: 'Borrar familia' }).click()
    await expect(row).toHaveCount(0)
  })
})
