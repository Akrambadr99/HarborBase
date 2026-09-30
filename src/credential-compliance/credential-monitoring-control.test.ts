import { createElement } from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CredentialMonitoringControl } from './CredentialMonitoringControl'
import { describe, expect, it } from 'vitest'
import { acknowledgeScheduledReview, BrowserMonitoringPersistence, closeCredentialMonitoring, decideDueMonitoringReview, initialMonitoringPortfolioState, MonitoringPortfolioRepository, MonitoringReadAdapter, monitoringCapabilities, queryLearnerMonitoringHistory, queryMonitoringInterface, querySupervisorReviewQueue, reassignUnavailableSupervisor, rescheduleMonitoringReview, revalidateCarriedMonitoringEvidence, reviewMonitoringEvidence, scheduleDueMonitoringReview, scheduleMonitoringReview, submitMonitoringEvidence, type MonitoringPersistence, type MonitoringPortfolioState } from './credential-monitoring-domain'

const command = { id: 'monitor-1', expectedRevision: 0, role: 'Compliance Lead' as const, monitoringId: 'MON-AR-18', owner: 'Senior compliance reviewer', reviewOn: '2026-10-21', asOf: '2026-10-20', evidenceRequested: 'Provide supervisor observation for both failed credential uses.' }
it('reassigns an unavailable supervisor without losing learner evidence or previous notices', () => {
  const scheduled = scheduleMonitoringReview(initialMonitoringPortfolioState, command)
  const submitted = submitMonitoringEvidence(scheduled, { id: 'evidence-1', expectedRevision: scheduled.revision, role: 'Learner', monitoringId: command.monitoringId, learner: 'Amira Rahman', evidenceReference: 'OBS-18', submittedOn: '2026-10-20' })
  const change = { id: 'availability-1', expectedRevision: submitted.revision, role: 'Compliance Lead' as const, monitoringId: command.monitoringId, replacementSupervisor: 'Regional supervisor', reviewOn: '2026-10-25', asOf: '2026-10-20', reason: 'Assigned supervisor is unavailable for the governed evidence review.', approvalReference: 'COMPLIANCE-18', approvedBy: 'Compliance lead' }
  expect(() => reassignUnavailableSupervisor(submitted, { ...change, role: 'Supervisor' })).toThrow('compliance lead')
  expect(() => reassignUnavailableSupervisor(submitted, { ...change, expectedRevision: 0 })).toThrow('Refresh')
  const reassigned = reassignUnavailableSupervisor(submitted, change)
  expect(reassigned.evidenceSubmissions).toEqual(submitted.evidenceSubmissions)
  expect(reassigned.scheduledNotices).toHaveLength(4)
  expect(reassigned.scheduledNotices.at(-1)?.recipient).toBe('Regional supervisor')
  expect(reassigned.supervisorExceptions[0]).toMatchObject({ reviewId: 'monitor-1', nextReviewId: 'availability-1:review', approvalReference: 'COMPLIANCE-18', immutable: true })
  expect(() => acknowledgeScheduledReview(reassigned, { id: 'old-ack', expectedRevision: reassigned.revision, role: 'Supervisor', noticeId: 'monitor-1:supervisor', actor: 'Monitoring supervisor', acknowledgedOn: '2026-10-21' })).toThrow('Stale')
  expect(() => acknowledgeScheduledReview(reassigned, { id: 'wrong-ack', expectedRevision: reassigned.revision, role: 'Supervisor', noticeId: 'availability-1:review:supervisor', actor: 'Monitoring supervisor', acknowledgedOn: '2026-10-21' })).toThrow('recipient')
  expect(() => reviewMonitoringEvidence(reassigned, { id: 'wrong-review', expectedRevision: reassigned.revision, role: 'Supervisor', monitoringId: command.monitoringId, submissionId: 'evidence-1', decision: 'accepted', rationale: 'Current evidence was reviewed.', reviewer: 'Monitoring supervisor', reviewedOn: '2026-10-23' })).toThrow('replacement supervisor')
  const review = { id: 'current-review', role: 'Supervisor' as const, monitoringId: command.monitoringId, submissionId: 'evidence-1', decision: 'accepted' as const, rationale: 'Current evidence was reviewed.', reviewer: 'Regional supervisor', reviewedOn: '2026-10-23' }
  expect(() => reviewMonitoringEvidence(reassigned, { ...review, expectedRevision: reassigned.revision })).toThrow('acknowledge the current review notice')
  const acknowledged = acknowledgeScheduledReview(reassigned, { id: 'replacement-ack', expectedRevision: reassigned.revision, role: 'Supervisor', noticeId: 'availability-1:review:supervisor', actor: 'Regional supervisor', acknowledgedOn: '2026-10-21' })
  expect(querySupervisorReviewQueue(acknowledged, '2026-10-23')[0]).toMatchObject({ supervisor: 'Regional supervisor', noticeAcknowledged: true })
  const reviewed = reviewMonitoringEvidence(acknowledged, { ...review, expectedRevision: acknowledged.revision })
  expect(reviewed.supervisorReviews[0]?.reviewer).toBe('Regional supervisor')
  expect(reassignUnavailableSupervisor(reassigned, change)).toBe(reassigned)
  const storage = { getItem: () => JSON.stringify({ ...submitted, supervisorExceptions: undefined }), setItem: () => undefined }
  expect(new BrowserMonitoringPersistence(storage).load()?.supervisorExceptions).toEqual([])
})
it('refuses a replacement supervisor already carrying two active governed reviews', () => {
  const scheduled = scheduleMonitoringReview(initialMonitoringPortfolioState, command)
  const loaded = structuredClone(scheduled)
  const source = scheduled.reviewHistory[0]
  if (!source) throw new Error('Seed review missing')
  const record = scheduled.records.find((item) => item.monitoringId === command.monitoringId)
  if (!record) throw new Error('Seed monitoring record missing')
  for (const suffix of ['B', 'C']) {
    loaded.reviewHistory.push({ ...source, id: `review-${suffix}`, monitoringId: `MON-${suffix}`, assignedSupervisor: 'Regional supervisor' })
    loaded.records.push({ ...record, monitoringId: `MON-${suffix}` })
  }
  const change = { id: 'overloaded', expectedRevision: loaded.revision, role: 'Compliance Lead' as const, monitoringId: command.monitoringId, replacementSupervisor: 'Regional supervisor', reviewOn: '2026-10-25', asOf: '2026-10-20', reason: 'Assigned supervisor cannot cover the current learner observation.', approvalReference: 'COMPLIANCE-18', approvedBy: 'Compliance lead' }
  expect(() => reassignUnavailableSupervisor(loaded, change)).toThrow('active review capacity')
  expect(loaded.supervisorExceptions).toEqual([])
  expect(loaded.scheduledNotices).toHaveLength(2)
})
it('transfers a returned evidence correction with its decision and learner history intact', () => {
  const scheduled = scheduleMonitoringReview(initialMonitoringPortfolioState, command)
  const submitted = submitMonitoringEvidence(scheduled, { id: 'original-observation', expectedRevision: scheduled.revision, role: 'Learner', monitoringId: command.monitoringId, learner: 'Amira Rahman', evidenceReference: 'OBS-18', submittedOn: '2026-10-22' })
  const transfer = { id: 'inherited-correction', expectedRevision: submitted.revision, role: 'Compliance Lead' as const, monitoringId: command.monitoringId, replacementSupervisor: 'Regional supervisor', reviewOn: '2026-10-26', asOf: '2026-10-24', cause: 'returned evidence' as const, reason: 'Returned learner observation requires a different qualified supervisor.', approvalReference: 'APP-RETURN-18', approvedBy: 'Compliance lead' }
  expect(() => reassignUnavailableSupervisor(submitted, transfer)).toThrow('returned decision')
  expect(submitted.supervisorExceptions).toEqual([])
  const returned = reviewMonitoringEvidence(submitted, { id: 'return-18', expectedRevision: submitted.revision, role: 'Supervisor', monitoringId: command.monitoringId, submissionId: 'original-observation', decision: 'returned', rationale: 'The second credential use requires an observation.', reviewer: 'Monitoring supervisor', reviewedOn: '2026-10-23' })
  const reassigned = reassignUnavailableSupervisor(returned, { ...transfer, expectedRevision: returned.revision })
  expect(reassigned.supervisorExceptions[0]).toMatchObject({ cause: 'returned evidence', returnedDecisionId: 'return-18', reviewId: 'monitor-1', nextReviewId: 'inherited-correction:review', immutable: true })
  expect(reassigned.evidenceSubmissions).toEqual(returned.evidenceSubmissions)
  expect(reassigned.supervisorReviews).toEqual(returned.supervisorReviews)
  expect(reassigned.learnerNotices).toEqual(returned.learnerNotices)
  expect(reassigned.scheduledNotices.at(-1)).toMatchObject({ recipient: 'Regional supervisor', reviewId: 'inherited-correction:review' })
  expect(() => reassignUnavailableSupervisor(reassigned, { ...transfer, id: 'stale-transfer', expectedRevision: returned.revision })).toThrow('Refresh')
})
it('completes only a due review with accepted evidence and both current-cycle acknowledgements', () => { const scheduled = scheduleMonitoringReview(initialMonitoringPortfolioState, command); const decision = { id: 'due-1', expectedRevision: scheduled.revision, role: 'Compliance Lead' as const, monitoringId: command.monitoringId, outcome: 'completed' as const, reason: 'Both observed credential uses have been independently reviewed.', nextReviewOn: null, decidedBy: 'lead', decidedOn: '2026-10-23' }; expect(() => decideDueMonitoringReview(scheduled, decision)).toThrow('accepted evidence'); let state = acknowledgeScheduledReview(scheduled, { id: 'learner-ack', expectedRevision: scheduled.revision, role: 'Learner', noticeId: 'monitor-1:learner', actor: 'Amira Rahman', acknowledgedOn: '2026-10-21' }); state = acknowledgeScheduledReview(state, { id: 'supervisor-ack', expectedRevision: state.revision, role: 'Supervisor', noticeId: 'monitor-1:supervisor', actor: 'Monitoring supervisor', acknowledgedOn: '2026-10-21' }); state = submitMonitoringEvidence(state, { id: 'submission-1', expectedRevision: state.revision, role: 'Learner', monitoringId: command.monitoringId, learner: 'Amira Rahman', evidenceReference: 'OBS-18', submittedOn: '2026-10-22' }); state = reviewMonitoringEvidence(state, { id: 'accepted-1', expectedRevision: state.revision, role: 'Supervisor', monitoringId: command.monitoringId, submissionId: 'submission-1', decision: 'accepted', rationale: 'Both observed uses are supported.', reviewer: 'supervisor', reviewedOn: '2026-10-23' }); const completed = decideDueMonitoringReview(state, { ...decision, expectedRevision: state.revision }); expect(completed.dueReviewDecisions[0]).toMatchObject({ reviewId: 'monitor-1', evidenceSubmissionId: 'submission-1', supervisorReviewId: 'accepted-1', learnerAcknowledgementId: 'learner-ack', supervisorAcknowledgementId: 'supervisor-ack', immutable: true }); expect(completed.reviewHistory).toEqual(state.reviewHistory); expect(completed.evidenceSubmissions).toEqual(state.evidenceSubmissions) })
it('defers an incomplete due review while retaining the previous cycle and learner work', () => { const scheduled = scheduleMonitoringReview(initialMonitoringPortfolioState, command); const submitted = submitMonitoringEvidence(scheduled, { id: 'submission-1', expectedRevision: scheduled.revision, role: 'Learner', monitoringId: command.monitoringId, learner: 'Amira Rahman', evidenceReference: 'OBS-18', submittedOn: '2026-10-22' }); const decision = { id: 'defer-1', expectedRevision: submitted.revision, role: 'Compliance Lead' as const, monitoringId: command.monitoringId, outcome: 'deferred' as const, reason: 'Supervisor availability prevents a reviewed decision by the due date.', nextReviewOn: '2026-10-25', decidedBy: 'lead', decidedOn: '2026-10-23' }; expect(() => decideDueMonitoringReview(submitted, { ...decision, nextReviewOn: '2026-10-22' })).toThrow('future'); const deferred = decideDueMonitoringReview(submitted, decision); expect(deferred.reviewHistory.map((item) => item.reviewOn)).toEqual(['2026-10-21', '2026-10-25']); expect(deferred.scheduledNotices).toHaveLength(4); expect(deferred.evidenceSubmissions).toEqual(submitted.evidenceSubmissions); expect(deferred.dueReviewDecisions[0]).toMatchObject({ outcome: 'deferred', nextReviewId: 'defer-1:review', evidenceSubmissionId: 'submission-1' }); expect(() => decideDueMonitoringReview(deferred, { ...decision, id: 'stale', expectedRevision: deferred.revision, outcome: 'completed' })).toThrow('active due review') })
it('loads previous monitoring state without due-review decisions', () => { const storage = { getItem: () => JSON.stringify({ ...initialMonitoringPortfolioState, dueReviewDecisions: undefined }), setItem: () => undefined }; expect(new BrowserMonitoringPersistence(storage).load()?.dueReviewDecisions).toEqual([]) })
it('keeps learner and supervisor review notices separate across a rescheduled cycle', () => { const scheduled = scheduleMonitoringReview(initialMonitoringPortfolioState, command); expect(scheduled.scheduledNotices).toHaveLength(2); expect(scheduled.scheduledNotices[0]?.message).not.toContain('failed uses'); expect(scheduled.scheduledNotices[1]?.message).toContain('2 failed uses'); const learnerAck = { id: 'ack-learner', expectedRevision: scheduled.revision, role: 'Learner' as const, noticeId: 'monitor-1:learner', actor: 'Amira Rahman', acknowledgedOn: '2026-10-21' }; expect(() => acknowledgeScheduledReview(scheduled, { ...learnerAck, role: 'Supervisor' })).toThrow('recipient'); const acknowledged = acknowledgeScheduledReview(scheduled, learnerAck); expect(acknowledgeScheduledReview(acknowledged, learnerAck)).toBe(acknowledged); const changed = rescheduleMonitoringReview(acknowledged, { id: 'monitor-2', expectedRevision: acknowledged.revision, role: 'Compliance Lead', monitoringId: command.monitoringId, reviewOn: '2026-10-25', asOf: '2026-10-20', reason: 'Learner availability changed after the scheduled observation window.' }); expect(changed.reviewHistory.map((item) => item.reviewOn)).toEqual(['2026-10-21', '2026-10-25']); expect(changed.scheduledNotices).toHaveLength(4); expect(changed.noticeAcknowledgements[0]?.reviewId).toBe('monitor-1'); expect(() => acknowledgeScheduledReview(changed, { ...learnerAck, id: 'stale-ack', expectedRevision: changed.revision })).toThrow('Stale'); const current = acknowledgeScheduledReview(changed, { id: 'ack-current', expectedRevision: changed.revision, role: 'Learner', noticeId: 'monitor-2:learner', actor: 'Amira Rahman', acknowledgedOn: '2026-10-21' }); expect(current.noticeAcknowledgements.at(-1)?.reviewId).toBe('monitor-2'); expect(changed.scheduledNotices[0]).toEqual(scheduled.scheduledNotices[0]) })
describe('credential monitoring review control', () => {
  it('reassigns due high-risk monitoring and retains learner evidence context', () => { const next = scheduleMonitoringReview(initialMonitoringPortfolioState, command); expect(next.records.find((item) => item.monitoringId === command.monitoringId)?.owner).toBe(command.owner); expect(next.reviewHistory[0]).toMatchObject({ learner: 'Amira Rahman', previousOwner: 'Credential council', failedUses: 2, decisionDue: true }) })
  it('rejects reviewer and stale commands without changing learner history', () => { expect(() => scheduleMonitoringReview(initialMonitoringPortfolioState, { ...command, role: 'Compliance Reviewer' })).toThrow('compliance lead'); expect(() => scheduleMonitoringReview(initialMonitoringPortfolioState, { ...command, expectedRevision: 4 })).toThrow('changed'); expect(initialMonitoringPortfolioState.reviewHistory).toEqual([]) })
  it('does not duplicate a repeated evidence request', () => { const next = scheduleMonitoringReview(initialMonitoringPortfolioState, command); expect(scheduleMonitoringReview(next, command)).toBe(next) })
})
describe('credential monitoring closure', () => {
  const closure = { id: 'close-1', expectedRevision: 1, role: 'Compliance Lead' as const, monitoringId: 'MON-AR-18', acceptedEvidence: ['OBS-18'], supervisorApproval: 'SUP-18', complianceApproval: 'COMP-18', successfulUses: 5, closedBy: 'lead', closedOn: '2026-10-26' }
  it('completes monitoring with current evidence while retaining prior failures', () => { const active = scheduleMonitoringReview(initialMonitoringPortfolioState, command); const closed = closeCredentialMonitoring(active, closure); expect(closed.records.find((item) => item.monitoringId === 'MON-AR-18')).toMatchObject({ successfulUses: 5, failedUses: 0, evidencePending: 0 }); expect(closed.closures[0]).toMatchObject({ previousFailedUses: 2, reviewId: 'monitor-1', immutable: true }) })
  it('blocks early, unsupported, stale, unauthorized, and duplicate closure', () => { const active = scheduleMonitoringReview(initialMonitoringPortfolioState, command); expect(() => closeCredentialMonitoring(active, { ...closure, closedOn: '2026-10-24' })).toThrow('window ends'); expect(() => closeCredentialMonitoring(active, { ...closure, acceptedEvidence: [] })).toThrow('learner evidence'); expect(() => closeCredentialMonitoring(active, { ...closure, expectedRevision: 0 })).toThrow('changed'); expect(() => closeCredentialMonitoring(active, { ...closure, role: 'Compliance Reviewer' })).toThrow('compliance lead'); const closed = closeCredentialMonitoring(active, closure); expect(closeCredentialMonitoring(closed, closure)).toBe(closed) })
  it('queries learner progress separately from immutable compliance outcomes', () => { const active = scheduleMonitoringReview(initialMonitoringPortfolioState, command); const closed = closeCredentialMonitoring(active, closure); expect(queryLearnerMonitoringHistory(closed, 'MON-AR-18')).toMatchObject({ learner: 'Amira Rahman', currentProgress: { successfulUses: 5, failedUses: 0, evidencePending: 0 }, reviews: [{ reviewId: 'monitor-1', priorFailures: 2 }], closures: [{ closureId: 'close-1', previousFailedUses: 2 }] }); expect(queryLearnerMonitoringHistory(closed, 'missing')).toBeNull() })
  it('reads credential lifecycle independently from learner progress and compliance events', () => { let current = scheduleMonitoringReview(initialMonitoringPortfolioState, command); const views = new MonitoringReadAdapter(() => current); expect(views.readCredentialState('MON-AR-18')).toMatchObject({ credential: 'Clinical assessor', monitoringPeriod: { startsOn: '2026-09-01', endsOn: '2026-10-25' }, monitoringStatus: 'active', latestComplianceDecision: null }); current = closeCredentialMonitoring(current, closure); expect(views.readCredentialState('MON-AR-18')).toMatchObject({ monitoringStatus: 'completed', latestComplianceDecision: { closureId: 'close-1', outcome: 'completed', acceptedEvidence: ['OBS-18'] } }) })
  it('separates learner progress from compliance history and never persists a rejected mutation', () => { expect(monitoringCapabilities('Learner')).toMatchObject({ canSubmitEvidence: true, canCloseMonitoring: false }); expect(monitoringCapabilities('Supervisor')).toMatchObject({ canApproveEvidence: true, canReassignReview: false }); class MemoryPersistence implements MonitoringPersistence { state: MonitoringPortfolioState | null = null; writes = 0; load() { return this.state }; saveMonitoring(state: MonitoringPortfolioState) { this.state = structuredClone(state); this.writes += 1 } }; const persistence = new MemoryPersistence(); const repository = new MonitoringPortfolioRepository(persistence); const views = new MonitoringReadAdapter(() => repository.read()); const before = views.readLearnerProgress('MON-AR-18'); expect(() => repository.dispatch({ ...command, role: 'Compliance Reviewer' })).toThrow('compliance lead'); expect(persistence.writes).toBe(0); expect(views.readLearnerProgress('MON-AR-18')).toEqual(before); repository.dispatch(command); expect(persistence.writes).toBe(1); expect(views.readComplianceHistory('MON-AR-18')?.reviews).toMatchObject([{ reviewId: 'monitor-1', priorFailures: 2 }]); expect(views.readLearnerProgress('MON-AR-18')).toMatchObject({ currentProgress: before?.currentProgress, requestedEvidence: ['Provide supervisor observation for both failed credential uses.'] }) })
})

describe('role-aware monitoring evidence lineage', () => {
  it('coordinates supervisor workload with a durable learner notice for each review decision', () => {
    const scheduled = scheduleMonitoringReview(initialMonitoringPortfolioState, command)
    expect(querySupervisorReviewQueue(scheduled, '2026-10-22')).toMatchObject([{ status: 'awaiting learner', dueOn: '2026-10-21', overdue: true }])
    const submitted = submitMonitoringEvidence(scheduled, { id: 'evidence-queue', expectedRevision: scheduled.revision, role: 'Learner', monitoringId: command.monitoringId, learner: 'Amira Rahman', evidenceReference: 'OBS-QUEUE', submittedOn: '2026-10-22' })
    expect(querySupervisorReviewQueue(submitted, '2026-10-23')).toMatchObject([{ status: 'awaiting supervisor', evidenceReference: 'OBS-QUEUE', overdue: true }])
    const review = { id: 'review-queue', expectedRevision: submitted.revision, role: 'Supervisor' as const, monitoringId: command.monitoringId, submissionId: 'evidence-queue', decision: 'returned' as const, rationale: 'Second observed use needs evidence.', reviewer: 'Maya', reviewedOn: '2026-10-23' }
    expect(() => reviewMonitoringEvidence(submitted, { ...review, role: 'Learner' })).toThrow('supervisor')
    expect(submitted.learnerNotices).toHaveLength(0)
    const returned = reviewMonitoringEvidence(submitted, review)
    expect(querySupervisorReviewQueue(returned, '2026-10-23')).toMatchObject([{ status: 'awaiting correction' }])
    expect(querySupervisorReviewQueue(returned, '2026-10-23')).toMatchObject([{ credential: 'Clinical assessor', monitoringPeriod: { startsOn: '2026-09-01', endsOn: '2026-10-25' } }])
    expect(queryMonitoringInterface(returned, command.monitoringId, 'Learner')).toMatchObject({ notices: [{ decision: 'returned', evidenceReference: 'OBS-QUEUE', rationale: review.rationale, immutable: true }] })
    expect(reviewMonitoringEvidence(returned, review)).toBe(returned)
    expect(returned.learnerNotices).toHaveLength(1)
    const resubmitted = submitMonitoringEvidence(returned, { id: 'evidence-queue-2', expectedRevision: returned.revision, role: 'Learner', monitoringId: command.monitoringId, learner: 'Amira Rahman', evidenceReference: 'OBS-QUEUE-2', submittedOn: '2026-10-24' })
    expect(querySupervisorReviewQueue(resubmitted, '2026-10-24')).toMatchObject([{ status: 'awaiting supervisor', previousDecision: 'returned', evidenceReference: 'OBS-QUEUE-2' }])
  })
  it('lets only the assigned learner submit durable evidence for the current review', () => { const active = scheduleMonitoringReview(initialMonitoringPortfolioState, command); const submitted = submitMonitoringEvidence(active, { id: 'evidence-1', expectedRevision: 1, role: 'Learner', monitoringId: command.monitoringId, learner: 'Amira Rahman', evidenceReference: 'OBS-18', submittedOn: '2026-10-22' }); expect(queryLearnerMonitoringHistory(submitted, command.monitoringId)).toMatchObject({ monitoringPeriod: { endsOn: '2026-10-25' }, evidenceSubmissions: [{ evidenceReference: 'OBS-18' }] }); expect(submitted.evidenceSubmissions[0]).toMatchObject({ reviewId: command.id, sourceRevision: 1, immutable: true }); expect(() => submitMonitoringEvidence(active, { id: 'bad', expectedRevision: 1, role: 'Compliance Reviewer', monitoringId: command.monitoringId, learner: 'Amira Rahman', evidenceReference: 'OBS-18', submittedOn: '2026-10-22' })).toThrow('Only the learner') })
  it('accepts only supervisor-reviewed current learner evidence for independent closure', () => { const active = scheduleMonitoringReview(initialMonitoringPortfolioState, command); const submitted = submitMonitoringEvidence(active, { id: 'evidence-1', expectedRevision: 1, role: 'Learner', monitoringId: command.monitoringId, learner: 'Amira Rahman', evidenceReference: 'OBS-18', submittedOn: '2026-10-22' }); const closure = { id: 'close-good', expectedRevision: 2, role: 'Compliance Lead' as const, monitoringId: command.monitoringId, acceptedEvidence: ['OBS-18'], supervisorApproval: 'SUP-18', complianceApproval: 'COMP-18', successfulUses: 5, closedBy: 'lead', closedOn: '2026-10-26' }; expect(() => closeCredentialMonitoring(submitted, { ...closure, acceptedEvidence: ['OTHER'] })).toThrow('submission lineage'); expect(() => closeCredentialMonitoring(submitted, closure)).toThrow('supervisor review'); const reviewed = reviewMonitoringEvidence(submitted, { id: 'review-1', expectedRevision: 2, role: 'Supervisor', monitoringId: command.monitoringId, submissionId: 'evidence-1', decision: 'accepted', rationale: 'Observed current supervised credential use.', reviewer: 'Maya', reviewedOn: '2026-10-23' }); expect(closeCredentialMonitoring(reviewed, { ...closure, expectedRevision: 3 }).closures).toHaveLength(1) })
  it('preserves returned submissions and requires a fresh supervisor decision after resubmission', () => { const active = scheduleMonitoringReview(initialMonitoringPortfolioState, command); const submitted = submitMonitoringEvidence(active, { id: 'evidence-1', expectedRevision: 1, role: 'Learner', monitoringId: command.monitoringId, learner: 'Amira Rahman', evidenceReference: 'OBS-18', submittedOn: '2026-10-22' }); const review = { id: 'review-1', expectedRevision: 2, role: 'Supervisor' as const, monitoringId: command.monitoringId, submissionId: 'evidence-1', decision: 'returned' as const, rationale: 'Observation omitted the second credential use.', reviewer: 'Maya', reviewedOn: '2026-10-23' }; expect(() => reviewMonitoringEvidence(submitted, { ...review, role: 'Learner' })).toThrow('supervisor'); expect(() => reviewMonitoringEvidence(submitted, { ...review, expectedRevision: 1 })).toThrow('changed'); const returned = reviewMonitoringEvidence(submitted, review); expect(() => submitMonitoringEvidence(submitted, { id: 'evidence-2', expectedRevision: 2, role: 'Learner', monitoringId: command.monitoringId, learner: 'Amira Rahman', evidenceReference: 'OBS-19', submittedOn: '2026-10-24' })).toThrow('awaits supervisor'); const resubmitted = submitMonitoringEvidence(returned, { id: 'evidence-2', expectedRevision: 3, role: 'Learner', monitoringId: command.monitoringId, learner: 'Amira Rahman', evidenceReference: 'OBS-19', submittedOn: '2026-10-24' }); expect(resubmitted.evidenceSubmissions).toHaveLength(2); expect(resubmitted.supervisorReviews).toMatchObject([{ decision: 'returned', rationale: review.rationale }]); expect(queryMonitoringInterface(resubmitted, command.monitoringId, 'Learner')).not.toHaveProperty('supervisorReviews'); expect(queryMonitoringInterface(resubmitted, command.monitoringId, 'Compliance Lead')).toHaveProperty('supervisorReviews') })
  it('separates learner-safe progress from reviewer compliance detail', () => { const active = scheduleMonitoringReview(initialMonitoringPortfolioState, command); const learner = queryMonitoringInterface(active, command.monitoringId, 'Learner'); const reviewer = queryMonitoringInterface(active, command.monitoringId, 'Compliance Reviewer'); expect(learner).toMatchObject({ persona: 'learner', requestedEvidence: command.evidenceRequested, upcomingReview: command.reviewOn, successfulUses: 3 }); expect(learner).not.toHaveProperty('previousFailures'); expect(learner).not.toHaveProperty('owner'); expect(reviewer).toMatchObject({ persona: 'reviewer', owner: command.owner, previousFailures: 2, complianceDecision: null }) })
})

it('completes reassigned supervisor evidence only after current notices, resubmission, and independent compliance decision',()=>{
  let s=scheduleMonitoringReview(initialMonitoringPortfolioState,command)
  s=submitMonitoringEvidence(s,{id:'initial-evidence',expectedRevision:s.revision,role:'Learner',monitoringId:command.monitoringId,learner:'Amira Rahman',evidenceReference:'OBS-18',submittedOn:'2026-10-22'})
  s=reassignUnavailableSupervisor(s,{id:'supervisor-change',expectedRevision:s.revision,role:'Compliance Lead',monitoringId:command.monitoringId,replacementSupervisor:'Regional supervisor',reviewOn:'2026-10-25',asOf:'2026-10-20',reason:'Original supervisor cannot conduct the scheduled evidence review.',approvalReference:'APP-SUP-18',approvedBy:'lead'})
  expect(()=>reviewMonitoringEvidence(s,{id:'old-owner-review',expectedRevision:s.revision,role:'Supervisor',monitoringId:command.monitoringId,submissionId:'initial-evidence',decision:'accepted',rationale:'Old supervisor approves earlier evidence.',reviewer:'Monitoring supervisor',reviewedOn:'2026-10-23'})).toThrow('replacement supervisor')
  s=acknowledgeScheduledReview(s,{id:'supervisor-notice',expectedRevision:s.revision,role:'Supervisor',noticeId:'supervisor-change:review:supervisor',actor:'Regional supervisor',acknowledgedOn:'2026-10-21'})
  s=reviewMonitoringEvidence(s,{id:'return-evidence',expectedRevision:s.revision,role:'Supervisor',monitoringId:command.monitoringId,submissionId:'initial-evidence',decision:'returned',rationale:'Observation omits the second governed credential use.',reviewer:'Regional supervisor',reviewedOn:'2026-10-23'})
  s=submitMonitoringEvidence(s,{id:'revised-evidence',expectedRevision:s.revision,role:'Learner',monitoringId:command.monitoringId,learner:'Amira Rahman',evidenceReference:'OBS-19',submittedOn:'2026-10-24'})
  expect(s.evidenceSubmissions[1]).toMatchObject({reviewId:'supervisor-change:review',supersedesSubmissionId:'initial-evidence',immutable:true})
  s=reviewMonitoringEvidence(s,{id:'accept-evidence',expectedRevision:s.revision,role:'Supervisor',monitoringId:command.monitoringId,submissionId:'revised-evidence',decision:'accepted',rationale:'Both credential uses now have current observation evidence.',reviewer:'Regional supervisor',reviewedOn:'2026-10-25'})
  expect(s.supervisorReviews[1]).toMatchObject({reviewId:'supervisor-change:review',reviewer:'Regional supervisor'})
  const closure={id:'closure-reassigned',expectedRevision:s.revision,role:'Compliance Lead' as const,monitoringId:command.monitoringId,acceptedEvidence:['OBS-19'],supervisorApproval:'SUP-APP',complianceApproval:'COMP-APP',successfulUses:5,closedBy:'lead',closedOn:'2026-10-26'}
  expect(()=>closeCredentialMonitoring(s,closure)).toThrow('independent current-cycle compliance')
  expect(()=>decideDueMonitoringReview(s,{id:'premature-completion',expectedRevision:s.revision,role:'Compliance Lead',monitoringId:command.monitoringId,outcome:'completed',reason:'Current evidence and both notices were reviewed independently.',nextReviewOn:null,decidedBy:'lead',decidedOn:'2026-10-25'})).toThrow('current-cycle acknowledgements')
  s=acknowledgeScheduledReview(s,{id:'learner-notice',expectedRevision:s.revision,role:'Learner',noticeId:'supervisor-change:review:learner',actor:'Amira Rahman',acknowledgedOn:'2026-10-21'})
  const decided=decideDueMonitoringReview(s,{id:'complete-review',expectedRevision:s.revision,role:'Compliance Lead',monitoringId:command.monitoringId,outcome:'completed',reason:'Current revised evidence and both notices were reviewed independently.',nextReviewOn:null,decidedBy:'lead',decidedOn:'2026-10-25'})
  expect(decided.dueReviewDecisions[0]).toMatchObject({reviewId:'supervisor-change:review',evidenceSubmissionId:'revised-evidence',supervisorReviewId:'accept-evidence',immutable:true})
  const closed=closeCredentialMonitoring(decided,{...closure,expectedRevision:decided.revision})
  expect(closed.closures[0]).toMatchObject({reviewId:'supervisor-change:review',acceptedEvidence:['OBS-19']})
  expect(closed.supervisorExceptions).toEqual(s.supervisorExceptions)
})

describe('retained evidence across a rescheduled review', () => {
  function carried() {
    let state = scheduleMonitoringReview(initialMonitoringPortfolioState, command)
    state = submitMonitoringEvidence(state, { id: 'retained-evidence', expectedRevision: state.revision, role: 'Learner', monitoringId: command.monitoringId, learner: 'Amira Rahman', evidenceReference: 'OBS-CARRIED', submittedOn: '2026-10-22' })
    state = reviewMonitoringEvidence(state, { id: 'original-acceptance', expectedRevision: state.revision, role: 'Supervisor', monitoringId: command.monitoringId, submissionId: 'retained-evidence', decision: 'accepted', rationale: 'Both observation records are supported.', reviewer: 'Monitoring supervisor', reviewedOn: '2026-10-23' })
    return rescheduleMonitoringReview(state, { id: 'new-cycle', expectedRevision: state.revision, role: 'Compliance Lead', monitoringId: command.monitoringId, reviewOn: '2026-10-25', asOf: '2026-10-24', reason: 'Learner availability moved the governed completion review.' })
  }
  function acknowledge(state: MonitoringPortfolioState) {
    for (const audience of ['learner', 'supervisor'] as const) state = acknowledgeScheduledReview(state, { id: `current-${audience}`, expectedRevision: state.revision, role: audience === 'learner' ? 'Learner' : 'Supervisor', noticeId: `new-cycle:${audience}`, actor: audience === 'learner' ? 'Amira Rahman' : 'Monitoring supervisor', acknowledgedOn: '2026-10-24' })
    return state
  }
  const decision = { id: 'carried-completion', expectedRevision: 0, role: 'Compliance Lead' as const, monitoringId: command.monitoringId, outcome: 'completed' as const, reason: 'Retained observations were independently revalidated for the current cycle.', nextReviewOn: null, decidedBy: 'Compliance lead', decidedOn: '2026-10-25' }
  const revalidation = { id: 'revalidated', expectedRevision: 0, role: 'Supervisor' as const, monitoringId: command.monitoringId, submissionId: 'retained-evidence', carryForwardReview: true as const, decision: 'accepted' as const, rationale: 'Observations remain current and satisfy this rescheduled evidence request.', reviewer: 'Monitoring supervisor', reviewedOn: '2026-10-25' }
  it('cannot complete a new cycle using an old accepted decision even with fresh notices', () => {
    const state = acknowledge(carried())
    const before = structuredClone(state)
    expect(() => decideDueMonitoringReview(state, { ...decision, expectedRevision: state.revision })).toThrow('accepted evidence')
    expect(querySupervisorReviewQueue(state, '2026-10-25')[0]?.status).toBe('awaiting supervisor')
    expect(state).toEqual(before)
  })
  it('revalidates without copying learner work or replacing its original acceptance', () => {
    const state = acknowledge(carried())
    const original = structuredClone(state.supervisorReviews)
    const validated = revalidateCarriedMonitoringEvidence(state, { ...revalidation, expectedRevision: state.revision })
    expect(validated.evidenceSubmissions).toEqual(state.evidenceSubmissions)
    expect(validated.supervisorReviews.slice(0, -1)).toEqual(original)
    expect(validated.supervisorReviews.at(-1)).toMatchObject({ reviewId: 'new-cycle', submissionId: 'retained-evidence', revalidatedFromDecisionId: 'original-acceptance', immutable: true })
    const complete = decideDueMonitoringReview(validated, { ...decision, expectedRevision: validated.revision })
    expect(complete.dueReviewDecisions.at(-1)).toMatchObject({ reviewId: 'new-cycle', supervisorReviewId: 'revalidated', evidenceSubmissionId: 'retained-evidence' })
    expect(querySupervisorReviewQueue(validated, '2026-10-25')[0]?.status).toBe('accepted')
    expect(revalidateCarriedMonitoringEvidence(validated, { ...revalidation, expectedRevision: state.revision })).toBe(validated)
  })
  it('returns carried evidence for correction without erasing prior acceptance or learner work', () => {
    const state = acknowledge(carried())
    const returned = revalidateCarriedMonitoringEvidence(state, { ...revalidation, id: 'returned-carried', expectedRevision: state.revision, decision: 'returned', rationale: 'Retained observation no longer covers the revised evidence request.' })
    expect(returned.supervisorReviews[0]).toEqual(state.supervisorReviews[0])
    expect(returned.learnerNotices.at(-1)).toMatchObject({ decision: 'returned', evidenceReference: 'OBS-CARRIED' })
    expect(querySupervisorReviewQueue(returned, '2026-10-25')[0]?.status).toBe('awaiting correction')
    for (const role of ['Learner', 'Compliance Lead'] as const) expect(queryMonitoringInterface(returned, command.monitoringId, role)?.submittedEvidence).toEqual([{ evidenceReference: 'OBS-CARRIED', submittedOn: '2026-10-22', supervisorDecision: 'returned' }])
    expect(() => decideDueMonitoringReview(returned, { ...decision, expectedRevision: returned.revision })).toThrow('accepted evidence')
    const corrected = submitMonitoringEvidence(returned, { id: 'corrected-carried', expectedRevision: returned.revision, role: 'Learner', monitoringId: command.monitoringId, learner: 'Amira Rahman', evidenceReference: 'OBS-CURRENT', submittedOn: '2026-10-25' })
    expect(corrected.evidenceSubmissions).toHaveLength(2)
    expect(corrected.evidenceSubmissions.at(-1)).toMatchObject({ supersedesSubmissionId: 'retained-evidence', reviewId: 'new-cycle' })
    const accepted = reviewMonitoringEvidence(corrected, { id: 'current-corrected-review', expectedRevision: corrected.revision, role: 'Supervisor', monitoringId: command.monitoringId, submissionId: 'corrected-carried', decision: 'accepted', rationale: 'Revised evidence now covers the current request.', reviewer: 'Monitoring supervisor', reviewedOn: '2026-10-25' })
    expect(decideDueMonitoringReview(accepted, { ...decision, expectedRevision: accepted.revision }).dueReviewDecisions.at(-1)?.evidenceSubmissionId).toBe('corrected-carried')
  })
  it('rejects unacknowledged, wrong-actor, stale and repeated revalidation without partial changes', () => {
    const waiting = carried()
    expect(() => revalidateCarriedMonitoringEvidence(waiting, { ...revalidation, expectedRevision: waiting.revision })).toThrow('acknowledge this cycle')
    const state = acknowledge(waiting)
    expect(() => revalidateCarriedMonitoringEvidence(state, { ...revalidation, expectedRevision: state.revision, role: 'Learner' })).toThrow('current supervisor')
    expect(() => revalidateCarriedMonitoringEvidence(state, { ...revalidation, expectedRevision: state.revision, reviewer: 'Other supervisor' })).toThrow('current supervisor')
    expect(() => revalidateCarriedMonitoringEvidence(state, { ...revalidation, expectedRevision: 0 })).toThrow('Refresh')
    expect(() => revalidateCarriedMonitoringEvidence(state, { ...revalidation, expectedRevision: state.revision, reviewedOn: '2026-02-30' })).toThrow('valid date')
    const validated = revalidateCarriedMonitoringEvidence(state, { ...revalidation, expectedRevision: state.revision })
    expect(() => revalidateCarriedMonitoringEvidence(validated, { ...revalidation, id: 'again', expectedRevision: validated.revision })).toThrow('active different review cycle')
    expect(state.supervisorReviews).toHaveLength(1)
  })
})
it('reviews on or after the actual submission while allowing review before its scheduled due date', () => {
  let state = scheduleMonitoringReview(initialMonitoringPortfolioState, command)
  state = rescheduleMonitoringReview(state, { id: 'future-review', expectedRevision: state.revision, role: 'Compliance Lead', monitoringId: command.monitoringId, reviewOn: '2026-11-01', asOf: '2026-10-24', reason: 'The learner review meeting moved into the next business week.' })
  state = submitMonitoringEvidence(state, { id: 'early-current-evidence', expectedRevision: state.revision, role: 'Learner', monitoringId: command.monitoringId, learner: 'Amira Rahman', evidenceReference: 'EARLY-OBS', submittedOn: '2026-10-25' })
  const review = { id: 'early-current-review', expectedRevision: state.revision, role: 'Supervisor' as const, monitoringId: command.monitoringId, submissionId: 'early-current-evidence', decision: 'accepted' as const, rationale: 'Evidence was checked before the planned learner meeting.', reviewer: 'Monitoring supervisor', reviewedOn: '2026-10-25' }
  const before = structuredClone(state)
  for (const reviewedOn of ['2026-10-23', '2026-02-30', 'not-a-date']) expect(() => reviewMonitoringEvidence(state, { ...review, reviewedOn })).toThrow('actual learner submission')
  expect(state).toEqual(before)
  const accepted = reviewMonitoringEvidence(state, review)
  expect(accepted.supervisorReviews.at(-1)).toMatchObject({ reviewedOn: '2026-10-25', reviewId: 'future-review' })
  expect(accepted.reviewHistory.at(-1)?.reviewOn).toBe('2026-11-01')
});

const routineCommand = { ...command, id: 'routine-JL', monitoringId: 'MON-JL-07', routineReview: true as const, supervisor: 'Safety supervisor', reviewOn: '2026-10-21', evidenceRequested: 'Provide rigging observation evidence before the current monitoring period ends.' }
it('assigns an actual due record with scoped notices without mutating another learner', () => {
  const state = scheduleDueMonitoringReview(initialMonitoringPortfolioState, routineCommand)
  expect(state.records[0]).toEqual(initialMonitoringPortfolioState.records[0])
  expect(state.reviewHistory[0]).toMatchObject({ monitoringId: 'MON-JL-07', learner: 'Jonas Lee', assignedSupervisor: 'Safety supervisor' })
  expect(state.scheduledNotices.map((item) => [item.audience, item.recipient])).toEqual([['learner', 'Jonas Lee'], ['supervisor', 'Safety supervisor']])
  expect(scheduleDueMonitoringReview(state, routineCommand)).toBe(state)
  expect(() => scheduleDueMonitoringReview(state, { ...routineCommand, id: 'duplicate', expectedRevision: state.revision })).toThrow('unassigned due')
})
it('rejects unauthorized, not-due, invalid-date and stale routine assignment without partial notices', () => {
  const before = structuredClone(initialMonitoringPortfolioState)
  expect(() => scheduleDueMonitoringReview(before, { ...routineCommand, role: 'Supervisor' })).toThrow('compliance lead')
  expect(() => scheduleDueMonitoringReview(before, { ...routineCommand, monitoringId: 'MON-SK-12' })).toThrow('unassigned due')
  expect(() => scheduleDueMonitoringReview(before, { ...routineCommand, reviewOn: '2026-10-23' })).toThrow('monitoring period')
  expect(() => scheduleDueMonitoringReview(before, { ...routineCommand, reviewOn: '2026-02-31' })).toThrow('monitoring period')
  expect(() => scheduleDueMonitoringReview(before, { ...routineCommand, expectedRevision: 1 })).toThrow('Refresh')
  expect(before).toEqual(initialMonitoringPortfolioState)
})
it('executes independent evidence decisions and current notices across two review records', () => {
  let state = scheduleMonitoringReview(initialMonitoringPortfolioState, command)
  state = scheduleDueMonitoringReview(state, { ...routineCommand, expectedRevision: state.revision })
  state = submitMonitoringEvidence(state, { id: 'AR-evidence', expectedRevision: state.revision, role: 'Learner', monitoringId: 'MON-AR-18', learner: 'Amira Rahman', evidenceReference: 'AR-OBS', submittedOn: '2026-10-22' })
  state = submitMonitoringEvidence(state, { id: 'JL-evidence', expectedRevision: state.revision, role: 'Learner', monitoringId: 'MON-JL-07', learner: 'Jonas Lee', evidenceReference: 'JL-OBS', submittedOn: '2026-10-22' })
  const decision = { id: 'JL-decision', expectedRevision: state.revision, role: 'Supervisor' as const, monitoringId: 'MON-JL-07', submissionId: 'JL-evidence', decision: 'accepted' as const, rationale: 'Current rigging observations meet the review requirement.', reviewer: 'Safety supervisor', reviewedOn: '2026-10-23' }
  expect(() => reviewMonitoringEvidence(state, { ...decision, submissionId: 'AR-evidence' })).toThrow('latest learner')
  expect(() => reviewMonitoringEvidence(state, decision)).toThrow('acknowledge')
  state = acknowledgeScheduledReview(state, { id: 'JL-ack', expectedRevision: state.revision, role: 'Supervisor', noticeId: 'routine-JL:supervisor', actor: 'Safety supervisor', acknowledgedOn: '2026-10-21' })
  expect(() => reviewMonitoringEvidence(state, { ...decision, expectedRevision: state.revision, reviewer: 'Other supervisor' })).toThrow('assigned')
  const accepted = reviewMonitoringEvidence(state, { ...decision, expectedRevision: state.revision })
  expect(querySupervisorReviewQueue(accepted, '2026-10-23').map((item) => [item.monitoringId, item.status])).toEqual([['MON-AR-18', 'awaiting supervisor'], ['MON-JL-07', 'accepted']])
  expect(accepted.learnerNotices[0]).toMatchObject({ learner: 'Jonas Lee', evidenceReference: 'JL-OBS' })
  expect(queryMonitoringInterface(accepted, 'MON-AR-18', 'Learner')?.notices).toEqual([])
})
it('preserves record drafts and scopes learner evidence when switching executable monitoring work', async () => {
  cleanup(); localStorage.clear()
  const user = userEvent.setup()
  render(createElement(CredentialMonitoringControl))
  const selected = screen.getByRole('combobox', { name: 'Active monitoring record' })
  await user.clear(screen.getByLabelText('Monitoring evidence reference'))
  await user.type(screen.getByLabelText('Monitoring evidence reference'), 'AMIRA-DRAFT')
  await user.selectOptions(selected, 'MON-JL-07')
  await user.selectOptions(screen.getByRole('combobox', { name: 'Monitoring role' }), 'Compliance Lead')
  await user.click(screen.getByRole('button', { name: 'Assign due monitoring review' }))
  expect(screen.getByLabelText('Selected monitoring record')).toHaveTextContent('Jonas Lee')
  await user.selectOptions(screen.getByRole('combobox', { name: 'Monitoring role' }), 'Learner')
  await user.clear(screen.getByLabelText('Monitoring evidence reference'))
  await user.type(screen.getByLabelText('Monitoring evidence reference'), 'JONAS-DRAFT')
  await user.click(screen.getByRole('button', { name: 'Submit learner monitoring evidence' }))
  expect(within(screen.getByRole('list', { name: 'Learner monitoring evidence' })).getByText(/JONAS-DRAFT/)).toBeVisible()
  await user.selectOptions(selected, 'MON-AR-18')
  expect(screen.getByLabelText('Monitoring evidence reference')).toHaveValue('AMIRA-DRAFT')
  expect(screen.getByRole('list', { name: 'Learner monitoring evidence' })).not.toHaveTextContent('JONAS-DRAFT')
  await user.selectOptions(selected, 'MON-JL-07')
  expect(screen.getByLabelText('Monitoring evidence reference')).toHaveValue('JONAS-DRAFT')
  cleanup(); localStorage.clear()
})
it('loads valid learner drafts and safely rejects malformed persisted input shapes', () => {
  for (const saved of ['null', '[]', '{"MON-AR-18":{"evidence":42,"rationale":"bad"}}']) {
    cleanup(); localStorage.clear(); localStorage.setItem('skillorbit:monitoring-work-input:v1', saved)
    render(createElement(CredentialMonitoringControl))
    expect(screen.getByLabelText('Monitoring evidence reference')).toHaveValue('SUPERVISOR-OBS-18')
  }
  cleanup(); localStorage.clear(); localStorage.setItem('skillorbit:monitoring-work-input:v1', JSON.stringify({ 'MON-AR-18': { evidence: 'VALID-SAVED', rationale: 'Preserved valid supervisor reasoning.' }, 'MON-JL-07': null }))
  render(createElement(CredentialMonitoringControl))
  expect(screen.getByLabelText('Monitoring evidence reference')).toHaveValue('VALID-SAVED')
  cleanup(); localStorage.clear()
})
