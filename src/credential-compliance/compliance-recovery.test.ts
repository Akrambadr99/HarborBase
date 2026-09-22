import { expect, it } from 'vitest'
import { BrowserMonitoringPersistence, exportComplianceRecovery, importComplianceRecovery, initialMonitoringPortfolioState, parseComplianceRecovery, previewComplianceRecovery } from './credential-monitoring-domain'

const command = { id: 'archive-1', monitoringId: 'MON-AR-18', role: 'Compliance Lead' as const, createdOn: '2026-10-29' }

it('imports only verified compliance history and leaves newer learner progress unchanged', () => {
  const source = structuredClone(initialMonitoringPortfolioState)
  source.reviewHistory.push({ id: 'review-1', monitoringId: command.monitoringId, learner: 'Amira Rahman', previousOwner: 'Credential council', owner: 'Compliance lead', reviewOn: '2026-10-30', failedUses: 2, evidenceRequested: 'Verify observed learner uses and supervisor evidence.', decisionDue: true, immutable: true })
  const archive = exportComplianceRecovery(source, command)
  expect(parseComplianceRecovery(JSON.stringify(archive))).toEqual(archive)
  const damaged = structuredClone(source)
  damaged.reviewHistory = []
  damaged.records[0]!.successfulUses = 4
  expect(previewComplianceRecovery(damaged, archive).ready).toBe(true)
  const restored = importComplianceRecovery(damaged, archive, { id: 'import-1', expectedRevision: 0, role: 'Compliance Lead', importedBy: 'lead', importedOn: '2026-10-29' })
  expect(restored.records[0]?.successfulUses).toBe(4)
  expect(restored.reviewHistory).toEqual(source.reviewHistory)
  expect(importComplianceRecovery(restored, archive, { id: 'import-2', expectedRevision: restored.revision, role: 'Compliance Lead', importedBy: 'lead', importedOn: '2026-10-29' })).toBe(restored)
  expect(() => importComplianceRecovery(damaged, archive, { id: 'unauthorized', expectedRevision: 0, role: 'Learner', importedBy: 'learner', importedOn: '2026-10-29' })).toThrow('compliance lead')
})

it('rejects stale and invalid learner-review archives without partial writes and migrates older saved state', () => {
  const state = structuredClone(initialMonitoringPortfolioState)
  const archive = exportComplianceRecovery(state, command)
  expect(() => parseComplianceRecovery(JSON.stringify({ ...archive, schemaVersion: 2 }))).toThrow('Unsupported')
  expect(previewComplianceRecovery(state, { ...archive, learner: 'Different learner' }).ready).toBe(false)
  const stale = { ...state, revision: state.revision + 1 }
  expect(() => importComplianceRecovery(stale, archive, { id: 'import-1', expectedRevision: stale.revision, role: 'Compliance Lead', importedBy: 'lead', importedOn: '2026-10-29' })).toThrow('progress')
  expect(stale.recoveryImports).toEqual([])
  const broken = structuredClone(archive)
  broken.history.scheduledNotices.push({ id: 'notice-1', monitoringId: command.monitoringId, reviewId: 'missing-review', audience: 'learner', recipient: 'Amira Rahman', dueOn: '2026-10-30', message: 'Review due', issuedOn: '2026-10-29', immutable: true })
  expect(previewComplianceRecovery(state, broken).reasons).toContain('Review-cycle or notice lineage is incomplete.')
  const old = structuredClone(state) as unknown as Record<string, unknown>
  delete old['recoveryImports']
  expect(new BrowserMonitoringPersistence({ getItem: () => JSON.stringify(old), setItem: () => undefined }).load()?.recoveryImports).toEqual([])
})
