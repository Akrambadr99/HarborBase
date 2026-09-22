import { expect, test } from '@playwright/test'

test('compliance lead imports monitoring history without changing learner progress', async ({ page }) => {
  await page.goto('/credential-compliance')
  const recovery = page.getByRole('region', { name: 'Monitoring compliance recovery' })
  await expect(recovery.getByRole('button', { name: 'Export monitoring compliance history' })).toBeDisabled()
  await page.getByLabel('Monitoring role').selectOption('Compliance Lead')
  await recovery.getByRole('button', { name: 'Export monitoring compliance history' }).click()
  await expect(recovery.getByLabel('Compliance import preview')).toContainText('verified for import')
  await recovery.getByRole('button', { name: 'Import verified compliance history' }).click()
  await expect(page.getByRole('status')).toContainText('learner progress was preserved')
  await expect(recovery.getByLabel('Compliance import preview')).toContainText('import blocked')
  await page.reload()
  await expect(recovery.getByRole('list', { name: 'Compliance recovery import history' })).toContainText('MON-AR-18')
})
