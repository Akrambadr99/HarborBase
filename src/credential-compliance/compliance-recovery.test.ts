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

it('preserves learner and recipient identity across restored review evidence', () => {
  const state = structuredClone(initialMonitoringPortfolioState)
  const archive = exportComplianceRecovery(state, command)
  archive.history.reviewHistory.push({ id: 'review', monitoringId: command.monitoringId, learner: archive.learner, previousOwner: 'Credential council', owner: 'Compliance lead', reviewOn: '2026-10-30', failedUses: 2, evidenceRequested: 'Verify observed learner uses.', decisionDue: true, immutable: true })
  archive.history.scheduledNotices.push({ id: 'notice', monitoringId: command.monitoringId, reviewId: 'review', audience: 'learner', recipient: archive.learner, dueOn: '2026-10-30', message: 'Review due', issuedOn: '2026-10-29', immutable: true })
  archive.history.noticeAcknowledgements.push({ id: 'ack', noticeId: 'notice', reviewId: 'review', actor: archive.learner, acknowledgedOn: '2026-10-29', immutable: true })
  const restore = { id: 'restore-identities', expectedRevision: 0, role: 'Compliance Lead' as const, importedBy: 'lead', importedOn: '2026-10-29' }
  const before = structuredClone(state)
  const wrongLearner = structuredClone(archive)
  wrongLearner.history.reviewHistory[0]!.learner = 'Another learner'
  expect(() => importComplianceRecovery(state, wrongLearner, restore)).toThrow('different learner')
  for (const change of [{ actor: 'Another recipient' }, { acknowledgedOn: '2026-10-28' }]) {
    const invalid = structuredClone(archive)
    Object.assign(invalid.history.noticeAcknowledgements[0]!, change)
    expect(() => importComplianceRecovery(state, invalid, restore)).toThrow('authorized recipient and notice date')
  }
  expect(state).toEqual(before)
  expect(importComplianceRecovery(state, archive, restore).noticeAcknowledgements).toEqual(archive.history.noticeAcknowledgements)
  expect(() => parseComplianceRecovery('null')).toThrow('structurally incomplete')
  archive.history.evidenceSubmissions.push({ id: 'submission', monitoringId: command.monitoringId, learner: archive.learner, reviewId: 'review', evidenceReference: 'OBSERVATION-1', submittedOn: '2026-10-29', sourceRevision: 0, immutable: true })
  archive.history.supervisorReviews.push({ id: 'decision', monitoringId: command.monitoringId, submissionId: 'submission', reviewId: 'review', decision: 'accepted', rationale: 'Observed uses meet the criteria.', reviewer: 'supervisor', reviewedOn: '2026-10-29', sourceRevision: 0, immutable: true })
  archive.history.learnerNotices.push({ id: 'decision-notice', monitoringId: command.monitoringId, learner: archive.learner, submissionId: 'submission', reviewId: 'decision', decision: 'returned', evidenceReference: 'OBSERVATION-1', rationale: 'Observed uses meet the criteria.', issuedOn: '2026-10-29', immutable: true })
  expect(() => importComplianceRecovery(state, archive, restore)).toThrow('reviewed evidence and outcome')
  archive.history.learnerNotices[0]!.decision = 'accepted'
  expect(importComplianceRecovery(state, archive, restore).learnerNotices).toEqual(archive.history.learnerNotices)
})
