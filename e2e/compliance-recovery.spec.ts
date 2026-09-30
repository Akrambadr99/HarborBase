import { expect, test } from '@playwright/test'

test('compliance lead imports monitoring history without changing learner progress', async ({ page }) => {
  await page.goto('/credential-compliance')
  const recovery = page.getByRole('region', { name: 'Monitoring compliance recovery' })
  await expect(recovery.getByRole('button', { name: 'Export monitoring compliance history' })).toBeDisabled()
  await page.getByLabel('Monitoring role').selectOption('Compliance Lead')
  await recovery.getByRole('button', { name: 'Export monitoring compliance history' }).click()
  await expect(recovery.getByLabel('Compliance import preview')).toContainText('verified for import')
  const href = await recovery.getByRole('link', { name: 'Download compliance archive' }).getAttribute('href')
  if (!href) throw new Error('Archive download missing')
  const saved = decodeURIComponent(href.slice(href.indexOf(',') + 1))
  const invalid = JSON.parse(saved) as { monitoringId: string; history: { reviewHistory: unknown[] } }
  invalid.history.reviewHistory.push({ id: 'wrong-learner', monitoringId: invalid.monitoringId, learner: 'Another learner' })
  await recovery.getByLabel('Import compliance archive').setInputFiles({ name: 'wrong-learner.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)) })
  await expect(recovery.getByRole('alert')).toContainText('different learner')
  await expect(recovery.getByRole('button', { name: 'Import verified compliance history' })).toBeDisabled()
  await recovery.getByLabel('Import compliance archive').setInputFiles({ name: 'verified.json', mimeType: 'application/json', buffer: Buffer.from(saved) })
  await recovery.getByRole('button', { name: 'Import verified compliance history' }).click()
  await expect(page.getByRole('status')).toContainText('learner progress was preserved')
  await expect(recovery.getByLabel('Compliance import preview')).toContainText('import blocked')
  await page.reload()
  await expect(recovery.getByRole('list', { name: 'Compliance recovery import history' })).toContainText('MON-AR-18')
})
