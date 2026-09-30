import { publishedAssessmentReference, type ModerationState, type PublishedAssessmentReference } from '../assessment-moderation/assessment-moderation'
import { credentialMonitoringPortfolio, seededCredentialMonitoring, type CredentialMonitoringRecord } from './monitoring-portfolio'

export type MonitoringControlRole = 'Learner' | 'Supervisor' | 'Compliance Reviewer' | 'Compliance Lead'
export function monitoringCapabilities(role: MonitoringControlRole) {
  return { canSubmitEvidence: role === 'Learner', canApproveEvidence: role === 'Supervisor' || role === 'Compliance Lead', canRequestEvidence: role === 'Compliance Reviewer' || role === 'Compliance Lead', canReassignReview: role === 'Compliance Lead', canCloseMonitoring: role === 'Compliance Lead' } as const
}
export interface MonitoringReview { id: string; monitoringId: string; learner: string; previousOwner: string; owner: string; assignedSupervisor?: string; reviewOn: string; failedUses: number; evidenceRequested: string; decisionDue: true; immutable: true }
export interface SupervisedMonitoringOutcome { id: string; monitoringId: string; reviewId: string; submissionId: string; supervisorDecisionId: string; successfulUses: number; evidenceReference: string; rationale: string; recordedBy: string; recordedOn: string; immutable: true }
export interface MonitoringClosure { id: string; monitoringId: string; reviewId: string; learner: string; previousFailedUses: number; acceptedEvidence: string[]; supervisorApproval: string; complianceApproval: string; successfulUses: number; outcome: 'completed'; closedBy: string; closedOn: string; immutable: true }
export interface MonitoringEvidenceSubmission { id: string; monitoringId: string; learner: string; reviewId: string; evidenceReference: string; submittedOn: string; sourceRevision: number; supersedesSubmissionId?: string; immutable: true }
export interface SupervisorEvidenceReview { id: string; monitoringId: string; submissionId: string; decision: 'accepted' | 'returned'; rationale: string; reviewer: string; reviewedOn: string; reviewId?: string; sourceRevision: number; revalidatedFromDecisionId?: string; immutable: true }
export interface LearnerMonitoringNotice { id: string; monitoringId: string; learner: string; submissionId: string; reviewId: string; decision: SupervisorEvidenceReview['decision']; evidenceReference: string; rationale: string; issuedOn: string; immutable: true }
export interface ScheduledReviewNotice { id: string; monitoringId: string; reviewId: string; audience: 'learner' | 'supervisor'; recipient: string; dueOn: string; message: string; issuedOn: string; immutable: true }
export interface ReviewNoticeAcknowledgement { id: string; noticeId: string; reviewId: string; actor: string; acknowledgedOn: string; immutable: true }
export interface DueReviewDecision { id: string; monitoringId: string; reviewId: string; outcome: 'completed' | 'deferred' | 'missed'; evidenceSubmissionId: string | null; supervisorReviewId: string | null; learnerAcknowledgementId: string | null; supervisorAcknowledgementId: string | null; reason: string; nextReviewId: string | null; decidedBy: string; decidedOn: string; immutable: true }
export interface SupervisorAvailabilityException { id: string; monitoringId: string; reviewId: string; nextReviewId: string; unavailableSupervisor: string; replacementSupervisor: string; cause?: 'unavailable' | 'returned evidence'; returnedDecisionId?: string; reason: string; approvalReference: string; approvedBy: string; previousReviewOn: string; revisedReviewOn: string; decidedOn: string; immutable: true }
export interface MonitoringPortfolioState { revision: number; records: CredentialMonitoringRecord[]; reviewHistory: MonitoringReview[]; evidenceSubmissions: MonitoringEvidenceSubmission[]; supervisorReviews: SupervisorEvidenceReview[]; learnerNotices: LearnerMonitoringNotice[]; scheduledNotices: ScheduledReviewNotice[]; noticeAcknowledgements: ReviewNoticeAcknowledgement[]; dueReviewDecisions: DueReviewDecision[]; supervisorExceptions: SupervisorAvailabilityException[]; closures: MonitoringClosure[] }
export interface ComplianceRecoveryArchive { learnerId?: string; credentialId?: string; assessmentSource?: PublishedAssessmentReference; schemaVersion: 1; id: string; monitoringId: string; learner: string; credential: string; sourceRevision: number; createdOn: string; progressAtCapture: { successfulUses: number; failedUses: number; evidencePending: number }; history: Pick<MonitoringPortfolioState, 'reviewHistory' | 'evidenceSubmissions' | 'supervisorReviews' | 'learnerNotices' | 'scheduledNotices' | 'noticeAcknowledgements' | 'dueReviewDecisions' | 'supervisorExceptions' | 'closures' | 'supervisedOutcomes' | 'assessmentEnrollments'> }
export interface ComplianceRecoveryImport { id: string; archiveId: string; monitoringId: string; importedBy: string; importedOn: string; immutable: true }

export interface AssessmentMonitoringEnrollment {
  id: string
  monitoringId: string
  learnerId: string
  credentialId: string
  evidenceReference: string
  enrolledBy: string
  enrolledOn: string
  immutable: true
}
interface RegisterAssessmentMonitoring {
  id: string
  expectedRevision: number
  expectedModerationRevision: number
  role: MonitoringControlRole
  attemptId: string
  credentialId: string
  startsOn: string
  endsOn: string
  evidenceReference: string
  enrolledBy: string
}
function sameAssessmentReference(first: PublishedAssessmentReference | undefined, second: PublishedAssessmentReference) {
  return first?.learnerId === second.learnerId && first.attemptId === second.attemptId && first.attemptVersion === second.attemptVersion && first.assessmentId === second.assessmentId && first.rulesVersion === second.rulesVersion && first.publicationId === second.publicationId
}
/** New monitoring is explicitly enrolled; legacy names never become inferred learner IDs. */
export function registerAssessmentMonitoring(state: MonitoringPortfolioState, moderation: ModerationState, command: RegisterAssessmentMonitoring) {
  if (command.role !== 'Compliance Lead') throw new Error('Only the compliance lead can enroll a moderated credential.')
  const source = publishedAssessmentReference(moderation, command.attemptId)
  if (state.revision !== command.expectedRevision || moderation.revision !== command.expectedModerationRevision) throw new Error('Monitoring or assessment source changed. Refresh sources; entered enrollment stays intact.')
  const validDate = (value: string) => /^20\d{2}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
  if (!command.id.trim() || !/^CRED-[A-Z0-9-]{3,40}$/.test(command.credentialId) || !command.evidenceReference.trim() || !command.enrolledBy.trim() || !validDate(command.startsOn) || !validDate(command.endsOn) || command.endsOn <= command.startsOn) throw new Error('A durable credential ID, attribution, enrollment evidence and valid monitoring window are required.')
  if (state.assessmentEnrollments.some((item) => item.id === command.id) || state.records.some((item) => item.credentialId === command.credentialId)) throw new Error('Credential enrollment identity is already registered. No duplicate learner record was created.')
  const monitoringId = 'MON-' + command.credentialId
  const next = structuredClone(state)
  next.records.push({ monitoringId, learnerId: source.learnerId, credentialId: command.credentialId, assessmentSource: source, learner: source.learnerId, credential: command.credentialId, startsOn: command.startsOn, endsOn: command.endsOn, successfulUses: 0, failedUses: 0, evidencePending: 1, owner: 'Credential council' })
  next.assessmentEnrollments.push({ id: command.id, monitoringId, learnerId: source.learnerId, credentialId: command.credentialId, evidenceReference: command.evidenceReference.trim(), enrolledBy: command.enrolledBy.trim(), enrolledOn: command.startsOn, immutable: true })
  next.revision += 1
  return next
}
function requireCurrentAssessment(state: MonitoringPortfolioState, monitoringId: string, readModeration?: () => ModerationState) {
  const record = state.records.find((item) => item.monitoringId === monitoringId)
  const source = record?.assessmentSource
  if (!source) return
  const enrollment = state.assessmentEnrollments.filter((item) => item.monitoringId === monitoringId)
  if (record.learnerId !== source.learnerId || record.learner !== source.learnerId || record.credentialId !== record.credential || enrollment.length !== 1 || enrollment[0]?.learnerId !== record.learnerId || enrollment[0].credentialId !== record.credentialId) throw new Error('Saved monitoring learner or credential identity lacks its authoritative enrollment.')
  if (!readModeration) throw new Error('Authoritative assessment source is unavailable. Existing monitoring evidence was preserved.')
  const current = publishedAssessmentReference(readModeration(), source.attemptId)
  if (!sameAssessmentReference(current, source)) throw new Error('Assessment source changed after credential enrollment. Reconcile the source before accepting outcomes or closing monitoring.')
}

export interface MonitoringPortfolioState { assessmentEnrollments: AssessmentMonitoringEnrollment[]; recoveryImports: ComplianceRecoveryImport[]; supervisedOutcomes: SupervisedMonitoringOutcome[] }
export const monitoringOwnerPolicy = { maximumHighRiskReviews: 2, maximumActiveSupervisorReviews: 2 } as const
export const initialMonitoringPortfolioState: MonitoringPortfolioState = { revision: 0, records: structuredClone(seededCredentialMonitoring), reviewHistory: [], evidenceSubmissions: [], supervisorReviews: [], learnerNotices: [], scheduledNotices: [], noticeAcknowledgements: [], dueReviewDecisions: [], supervisorExceptions: [], closures: [], recoveryImports: [], supervisedOutcomes: [], assessmentEnrollments: [] }

const complianceHistoryKeys = ['reviewHistory', 'evidenceSubmissions', 'supervisorReviews', 'learnerNotices', 'scheduledNotices', 'noticeAcknowledgements', 'dueReviewDecisions', 'supervisorExceptions', 'closures', 'supervisedOutcomes', 'assessmentEnrollments'] as const
export function exportComplianceRecovery(state: MonitoringPortfolioState, command: { id: string; monitoringId: string; role: MonitoringControlRole; createdOn: string }): ComplianceRecoveryArchive {
  if (command.role !== 'Compliance Lead') throw new Error('Only the compliance lead can export monitoring recovery evidence.')
  const record = state.records.find((item) => item.monitoringId === command.monitoringId)
  if (!record || !command.id.trim() || !/^20\d{2}-\d{2}-\d{2}$/.test(command.createdOn)) throw new Error('Monitoring identity, archive ID, and business date are required.')
  const noticeIds = new Set(state.scheduledNotices.filter((item) => item.monitoringId === command.monitoringId).map((item) => item.id))
  const history = Object.fromEntries(complianceHistoryKeys.map((key) => [key, structuredClone(key === 'noticeAcknowledgements' ? state.noticeAcknowledgements.filter((item) => noticeIds.has(item.noticeId)) : state[key].filter((item) => item.monitoringId === command.monitoringId))])) as unknown as ComplianceRecoveryArchive['history']
  return { ...(record.assessmentSource ? { learnerId: record.assessmentSource.learnerId, credentialId: record.credentialId ?? '', assessmentSource: structuredClone(record.assessmentSource) } : {}), schemaVersion: 1, id: command.id, monitoringId: record.monitoringId, learner: record.learner, credential: record.credential, sourceRevision: state.revision, createdOn: command.createdOn, progressAtCapture: { successfulUses: record.successfulUses, failedUses: record.failedUses, evidencePending: record.evidencePending }, history }
}
export function parseComplianceRecovery(raw: string): ComplianceRecoveryArchive {
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object') throw new Error('Monitoring recovery archive is structurally incomplete.')
  const archive = parsed as Partial<ComplianceRecoveryArchive>
  if (archive.schemaVersion !== 1) throw new Error('Unsupported monitoring recovery archive schema.')
  const savedHistory = archive.history as Partial<ComplianceRecoveryArchive['history']> | undefined
  if (savedHistory) { savedHistory.supervisedOutcomes ??= []; savedHistory.assessmentEnrollments ??= [] }
  if (!archive.id || !archive.monitoringId || !archive.learner || !archive.history || complianceHistoryKeys.some((key) => !Array.isArray(archive.history?.[key]))) throw new Error('Monitoring recovery archive is structurally incomplete.')
  return archive as ComplianceRecoveryArchive
}
export function previewComplianceRecovery(state: MonitoringPortfolioState, archive: ComplianceRecoveryArchive) {
  const reasons: string[] = []
  const record = state.records.find((item) => item.monitoringId === archive.monitoringId)
  if ((archive as { schemaVersion: number }).schemaVersion !== 1) reasons.push('Unsupported archive schema.')
  if (!record?.learner || record.learner !== archive.learner || record.credential !== archive.credential) reasons.push('Learner or credential identity does not match the authoritative monitoring record.')
  if (record?.assessmentSource && (archive.learnerId !== record.learnerId || archive.credentialId !== record.credentialId || !sameAssessmentReference(archive.assessmentSource, record.assessmentSource))) reasons.push('Authoritative learner, credential or assessment reference does not match the enrolled monitoring record.')
  if (archive.history.assessmentEnrollments.some((item) => item.learnerId !== record?.learnerId || item.credentialId !== record.credentialId || !record.assessmentSource)) reasons.push('Enrollment history does not belong to the authoritative credential identity.')
  if (state.revision !== archive.sourceRevision) reasons.push('Monitoring state changed after export; current learner progress and compliance decisions cannot be overwritten.')
  if (state.recoveryImports.some((item) => item.archiveId === archive.id)) reasons.push('Archive already imported.')
  const reviews = archive.history.reviewHistory
  if (complianceHistoryKeys.some((key) => key !== 'noticeAcknowledgements' && archive.history[key].some((item) => item.monitoringId !== archive.monitoringId))) reasons.push('Archive contains history for a different learner monitoring record.')
  if (archive.history.evidenceSubmissions.some((item) => !reviews.some((review) => review.id === item.reviewId)) || archive.history.scheduledNotices.some((item) => !reviews.some((review) => review.id === item.reviewId)) || archive.history.noticeAcknowledgements.some((item) => !archive.history.scheduledNotices.some((notice) => notice.id === item.noticeId && notice.reviewId === item.reviewId))) reasons.push('Review-cycle or notice lineage is incomplete.')
  if (archive.history.supervisorReviews.some((item) => !archive.history.evidenceSubmissions.some((submission) => submission.id === item.submissionId)) || archive.history.dueReviewDecisions.some((item) => !reviews.some((review) => review.id === item.reviewId)) || archive.history.supervisorExceptions.some((item) => !reviews.some((review) => review.id === item.reviewId) || !reviews.some((review) => review.id === item.nextReviewId))) reasons.push('Evidence decision or supervisor assignment references a missing review.')
  if ([...reviews, ...archive.history.evidenceSubmissions, ...archive.history.learnerNotices, ...archive.history.closures].some((item) => item.learner !== archive.learner)) reasons.push('Archived evidence names a different learner from its monitoring source.')
  if (archive.history.learnerNotices.some((notice) => !archive.history.supervisorReviews.some((review) => review.id === notice.reviewId && review.submissionId === notice.submissionId && review.decision === notice.decision) || !archive.history.evidenceSubmissions.some((submission) => submission.id === notice.submissionId && submission.evidenceReference === notice.evidenceReference))) reasons.push('Learner decision notice does not match its reviewed evidence and outcome.')
  if (archive.history.noticeAcknowledgements.some((acknowledgement) => {
    const notice = archive.history.scheduledNotices.find((item) => item.id === acknowledgement.noticeId)
    const review = reviews.find((item) => item.id === notice?.reviewId)
    return notice && (acknowledgement.acknowledgedOn < notice.issuedOn || (notice.audience === 'learner' ? acknowledgement.actor !== notice.recipient : Boolean(review?.assignedSupervisor && acknowledgement.actor !== review.assignedSupervisor)))
  })) reasons.push('Review acknowledgement must preserve the authorized recipient and notice date.')
  if (archive.history.supervisedOutcomes.some((item) => !reviews.some((review) => review.id === item.reviewId && review.monitoringId === item.monitoringId) || !archive.history.evidenceSubmissions.some((submission) => submission.id === item.submissionId && submission.monitoringId === item.monitoringId) || !archive.history.supervisorReviews.some((decision) => decision.id === item.supervisorDecisionId && decision.submissionId === item.submissionId && decision.reviewId === item.reviewId && decision.decision === 'accepted' && decision.reviewer === item.recordedBy) || !Number.isSafeInteger(item.successfulUses) || item.successfulUses < 0)) reasons.push('Supervised outcome has invalid reviewed evidence, attribution, or observed count.')
  if (archive.history.closures.some((item) => !reviews.some((review) => review.id === item.reviewId))) reasons.push('Monitoring closure has no archived review source.')
  for (const key of complianceHistoryKeys) for (const item of archive.history[key]) { const existing = state[key].find((entry) => entry.id === item.id); if (existing && JSON.stringify(existing) !== JSON.stringify(item)) reasons.push(`Existing ${key} record ${item.id} conflicts with archive evidence.`) }
  return { ready: reasons.length === 0, reasons, archiveId: archive.id, sourceRevision: archive.sourceRevision, currentRevision: state.revision }
}
export function importComplianceRecovery(state: MonitoringPortfolioState, archive: ComplianceRecoveryArchive, command: { id: string; expectedRevision: number; role: MonitoringControlRole; importedBy: string; importedOn: string }) {
  if (command.role !== 'Compliance Lead') throw new Error('Only the compliance lead can import monitoring recovery evidence.')
  if (state.recoveryImports.some((item) => item.archiveId === archive.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Monitoring state changed before recovery import.')
  const preview = previewComplianceRecovery(state, archive)
  if (!preview.ready || !command.id.trim() || !command.importedBy.trim()) throw new Error(preview.reasons.join(' ') || 'Recovery import identity and actor are required.')
  const next = structuredClone(state)
  for (const key of complianceHistoryKeys) (next as unknown as Record<string, unknown>)[key] = [...next[key], ...structuredClone(archive.history[key]).filter((item) => !next[key].some((existing) => existing.id === item.id))]
  next.recoveryImports.push({ id: command.id, archiveId: archive.id, monitoringId: archive.monitoringId, importedBy: command.importedBy.trim(), importedOn: command.importedOn, immutable: true })
  next.revision += 1
  return next
}
function addReviewNotices(state: MonitoringPortfolioState, review: MonitoringReview, issuedOn: string, credential: string) { state.scheduledNotices.push({ id: `${review.id}:learner`, monitoringId: review.monitoringId, reviewId: review.id, audience: 'learner', recipient: review.learner, dueOn: review.reviewOn, message: `${credential} evidence review is due. ${review.evidenceRequested}`, issuedOn, immutable: true }, { id: `${review.id}:supervisor`, monitoringId: review.monitoringId, reviewId: review.id, audience: 'supervisor', recipient: review.assignedSupervisor ?? 'Monitoring supervisor', dueOn: review.reviewOn, message: `${credential} review for ${review.learner} is due. ${String(review.failedUses)} failed uses require supervisor evidence review.`, issuedOn, immutable: true }) }

export function reassignUnavailableSupervisor(state: MonitoringPortfolioState, command: { id: string; expectedRevision: number; role: MonitoringControlRole; monitoringId: string; replacementSupervisor: string; reviewOn: string; asOf: string; cause?: 'unavailable' | 'returned evidence'; reason: string; approvalReference: string; approvedBy: string }) {
  if (state.supervisorExceptions.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Credential monitoring changed. Refresh before supervisor reassignment.')
  if (command.role !== 'Compliance Lead') throw new Error('Only the compliance lead can approve supervisor reassignment.')
  const current = state.reviewHistory.filter((item) => item.monitoringId === command.monitoringId).at(-1)
  const record = state.records.find((item) => item.monitoringId === command.monitoringId)
  if (!current || !record || state.closures.some((item) => item.monitoringId === command.monitoringId) || state.dueReviewDecisions.some((item) => item.reviewId === current.id)) throw new Error('An active undecided review is required for supervisor reassignment.')
  const oldSupervisor = current.assignedSupervisor ?? 'Monitoring supervisor'
  const latestSubmission = state.evidenceSubmissions.filter((item) => item.monitoringId === command.monitoringId).at(-1)
  const returnedDecision = state.supervisorReviews.find((item) => item.submissionId === latestSubmission?.id && item.decision === 'returned' && item.reviewId === current.id)
  if (command.cause === 'returned evidence' && !returnedDecision) throw new Error('A returned decision from the current supervisor review is required for inherited correction.')
  if (!command.replacementSupervisor.trim() || command.replacementSupervisor.trim() === oldSupervisor || command.reason.trim().length < 20 || !command.approvalReference.trim() || !command.approvedBy.trim() || command.reviewOn <= command.asOf) throw new Error('A different supervisor, approval evidence, reason, and future review date are required.')
  const activeSupervisorReviews = [...new Set(state.reviewHistory.map((item) => item.monitoringId))].filter((monitoringId) => monitoringId !== command.monitoringId && !state.closures.some((item) => item.monitoringId === monitoringId) && state.reviewHistory.filter((item) => item.monitoringId === monitoringId).at(-1)?.assignedSupervisor === command.replacementSupervisor.trim() && !state.dueReviewDecisions.some((item) => item.reviewId === state.reviewHistory.filter((review) => review.monitoringId === monitoringId).at(-1)?.id)).length
  if (activeSupervisorReviews >= monitoringOwnerPolicy.maximumActiveSupervisorReviews) throw new Error('Replacement supervisor is at active review capacity.')
  const next = structuredClone(state)
  const nextReview = { ...current, id: `${command.id}:review`, previousOwner: current.owner, assignedSupervisor: command.replacementSupervisor.trim(), reviewOn: command.reviewOn }
  next.reviewHistory.push(nextReview)
  next.supervisorExceptions.push({ id: command.id, monitoringId: current.monitoringId, reviewId: current.id, nextReviewId: nextReview.id, unavailableSupervisor: oldSupervisor, replacementSupervisor: nextReview.assignedSupervisor, cause: command.cause ?? 'unavailable', ...(returnedDecision && command.cause === 'returned evidence' ? { returnedDecisionId: returnedDecision.id } : {}), reason: command.reason.trim(), approvalReference: command.approvalReference.trim(), approvedBy: command.approvedBy.trim(), previousReviewOn: current.reviewOn, revisedReviewOn: command.reviewOn, decidedOn: command.asOf, immutable: true })
  addReviewNotices(next, nextReview, command.asOf, record.credential)
  next.revision += 1
  return next
}
export function decideDueMonitoringReview(state: MonitoringPortfolioState, command: { id: string; expectedRevision: number; role: MonitoringControlRole; monitoringId: string; outcome: DueReviewDecision['outcome']; reason: string; nextReviewOn: string | null; decidedBy: string; decidedOn: string }) {
  if (state.dueReviewDecisions.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Credential monitoring changed. Refresh before due-review decision.')
  if (command.role !== 'Compliance Lead') throw new Error('Only the compliance lead can decide a due review.')
  const review = state.reviewHistory.filter((item) => item.monitoringId === command.monitoringId).at(-1)
  const record = state.records.find((item) => item.monitoringId === command.monitoringId)
  if (!review || !record || command.decidedOn < review.reviewOn || state.closures.some((item) => item.monitoringId === command.monitoringId) || state.dueReviewDecisions.some((item) => item.reviewId === review.id)) throw new Error('An active due review cycle without a prior decision is required.')
  const latest = state.evidenceSubmissions.filter((item) => item.monitoringId === command.monitoringId).at(-1)
  const supervisor = state.supervisorReviews.filter((item) => item.submissionId === latest?.id).at(-1)
  const learnerNotice = state.scheduledNotices.find((item) => item.reviewId === review.id && item.audience === 'learner')
  const supervisorNotice = state.scheduledNotices.find((item) => item.reviewId === review.id && item.audience === 'supervisor')
  const learnerAck = state.noticeAcknowledgements.find((item) => item.noticeId === learnerNotice?.id)
  const supervisorAck = state.noticeAcknowledgements.find((item) => item.noticeId === supervisorNotice?.id)
  if (!command.decidedBy.trim() || command.reason.trim().length < 20) throw new Error('Due-review decision needs a named lead and specific rationale.')
  if (command.outcome === 'completed' && (!latest || supervisor?.decision !== 'accepted' || ((review.assignedSupervisor || state.reviewHistory.filter((item) => item.monitoringId === command.monitoringId).length > 1) && supervisor.reviewId !== review.id) || !learnerAck || !supervisorAck)) throw new Error('Completion needs accepted evidence and both current-cycle acknowledgements.')
  if (command.outcome !== 'completed' && (!command.nextReviewOn || command.nextReviewOn <= command.decidedOn)) throw new Error('Deferred or missed review needs a future extension date.')
  const next = structuredClone(state)
  const nextReviewId = command.outcome === 'completed' ? null : `${command.id}:review`
  next.dueReviewDecisions.push({ id: command.id, monitoringId: command.monitoringId, reviewId: review.id, outcome: command.outcome, evidenceSubmissionId: latest?.id ?? null, supervisorReviewId: supervisor?.id ?? null, learnerAcknowledgementId: learnerAck?.id ?? null, supervisorAcknowledgementId: supervisorAck?.id ?? null, reason: command.reason.trim(), nextReviewId, decidedBy: command.decidedBy.trim(), decidedOn: command.decidedOn, immutable: true })
  if (nextReviewId && command.nextReviewOn) { const nextReview = { ...review, id: nextReviewId, previousOwner: review.owner, reviewOn: command.nextReviewOn }; next.reviewHistory.push(nextReview); addReviewNotices(next, nextReview, command.decidedOn, record.credential) }
  next.revision += 1
  return next
}
export function rescheduleMonitoringReview(state: MonitoringPortfolioState, command: { id: string; expectedRevision: number; role: MonitoringControlRole; monitoringId: string; reviewOn: string; asOf: string; reason: string }) { if (state.reviewHistory.some((item) => item.id === command.id)) return state; if (state.revision !== command.expectedRevision) throw new Error('Credential monitoring changed. Refresh before rescheduling.'); if (command.role !== 'Compliance Lead') throw new Error('Only the compliance lead can reschedule review.'); const previous = state.reviewHistory.filter((item) => item.monitoringId === command.monitoringId).at(-1); const record = state.records.find((item) => item.monitoringId === command.monitoringId); if (!previous || !record || state.closures.some((item) => item.monitoringId === command.monitoringId) || command.reviewOn <= command.asOf || command.reviewOn === previous.reviewOn || command.reason.trim().length < 20) throw new Error('Active review, changed future date, and rescheduling reason are required.'); const next = structuredClone(state); const review = { ...previous, id: command.id, reviewOn: command.reviewOn, previousOwner: previous.owner }; next.reviewHistory.push(review); addReviewNotices(next, review, command.asOf, record.credential); next.revision += 1; return next }
export function acknowledgeScheduledReview(state: MonitoringPortfolioState, command: { id: string; expectedRevision: number; role: MonitoringControlRole; noticeId: string; actor: string; acknowledgedOn: string }) { if (state.noticeAcknowledgements.some((item) => item.id === command.id)) return state; if (state.revision !== command.expectedRevision) throw new Error('Credential monitoring changed. Refresh before acknowledgement.'); const notice = state.scheduledNotices.find((item) => item.id === command.noticeId); const review = state.reviewHistory.find((item) => item.id === notice?.reviewId); if (!notice || (notice.audience === 'learner' ? command.role !== 'Learner' || command.actor !== notice.recipient : command.role !== 'Supervisor' || !command.actor.trim() || Boolean(review?.assignedSupervisor && command.actor !== review.assignedSupervisor))) throw new Error('Only the notice recipient can acknowledge their review notice.'); if (state.reviewHistory.filter((item) => item.monitoringId === notice.monitoringId).at(-1)?.id !== notice.reviewId || state.noticeAcknowledgements.some((item) => item.noticeId === notice.id)) throw new Error('Stale or already acknowledged review notice cannot count for the current cycle.'); if (command.acknowledgedOn < notice.issuedOn) throw new Error('Acknowledgement cannot predate its notice.'); const next = structuredClone(state); next.noticeAcknowledgements.push({ id: command.id, noticeId: notice.id, reviewId: notice.reviewId, actor: command.actor.trim(), acknowledgedOn: command.acknowledgedOn, immutable: true }); next.revision += 1; return next }
interface ScheduleMonitoringReview { id: string; expectedRevision: number; role: MonitoringControlRole; monitoringId: string; owner: string; reviewOn: string; asOf: string; evidenceRequested: string }

export function scheduleDueMonitoringReview(state: MonitoringPortfolioState, command: ScheduleMonitoringReview & { routineReview: true; supervisor: string }) {
  if (state.reviewHistory.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Credential monitoring changed. Refresh before scheduling review.')
  if (command.role !== 'Compliance Lead') throw new Error('Only the compliance lead can assign a due monitoring review.')
  const record = state.records.find((item) => item.monitoringId === command.monitoringId)
  const status = record && credentialMonitoringPortfolio([record], command.asOf)[0]
  if (!record || !status?.dueReview || state.closures.some((item) => item.monitoringId === record.monitoringId) || state.reviewHistory.some((item) => item.monitoringId === record.monitoringId)) throw new Error('An unassigned due monitoring record is required.')
  const validDate = /^20\d{2}-\d{2}-\d{2}$/.test(command.reviewOn) && Number.isFinite(Date.parse(command.reviewOn)) && new Date(command.reviewOn).toISOString().slice(0, 10) === command.reviewOn
  if (!validDate || command.reviewOn < command.asOf || command.reviewOn > record.endsOn || command.supervisor.trim().length < 3 || command.owner.trim().length < 3 || command.evidenceRequested.trim().length < 20) throw new Error('A named owner and supervisor, specific evidence request, and review date within the monitoring period are required.')
  const active = [...new Set(state.reviewHistory.map((item) => item.monitoringId))].filter((id) => !state.closures.some((item) => item.monitoringId === id)).map((id) => state.reviewHistory.filter((item) => item.monitoringId === id).at(-1)).filter((review) => review && !state.dueReviewDecisions.some((item) => item.reviewId === review.id))
  if (active.filter((review) => (review?.assignedSupervisor ?? 'Monitoring supervisor') === command.supervisor.trim()).length >= monitoringOwnerPolicy.maximumActiveSupervisorReviews) throw new Error('Selected supervisor is at active review capacity.')
  const next = structuredClone(state)
  const review: MonitoringReview = { id: command.id, monitoringId: record.monitoringId, learner: record.learner, previousOwner: record.owner, owner: command.owner.trim(), assignedSupervisor: command.supervisor.trim(), reviewOn: command.reviewOn, failedUses: record.failedUses, evidenceRequested: command.evidenceRequested.trim(), decisionDue: true, immutable: true }
  next.reviewHistory.push(review)
  addReviewNotices(next, review, command.asOf, record.credential)
  const target = next.records.find((item) => item.monitoringId === record.monitoringId)
  if (target) target.owner = review.owner
  next.revision += 1
  return next
}

export function scheduleMonitoringReview(state: MonitoringPortfolioState, command: ScheduleMonitoringReview) {
  if (state.reviewHistory.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Credential monitoring changed. Refresh before scheduling review.')
  if (!monitoringCapabilities(command.role).canReassignReview) throw new Error('Only the compliance lead can reassign a high-risk monitoring review.')
  const record = state.records.find((item) => item.monitoringId === command.monitoringId)
  if (!record) throw new Error('Monitoring record was not found.')
  const status = credentialMonitoringPortfolio([record], command.asOf)[0]
  if (status?.risk !== 'high' || !status.dueReview) throw new Error('Only due high-risk monitoring can be escalated.')
  const activeForOwner = state.reviewHistory.filter((item) => item.owner === command.owner).length
  if (activeForOwner >= monitoringOwnerPolicy.maximumHighRiskReviews) throw new Error('Selected compliance owner is at review capacity.')
  if (command.reviewOn < command.asOf) throw new Error('Monitoring review cannot be scheduled in the past.')
  if (command.evidenceRequested.trim().length < 20) throw new Error('A specific evidence request is required.')
  const next = structuredClone(state)
  const target = next.records.find((item) => item.monitoringId === record.monitoringId)
  if (!target) throw new Error('Monitoring record disappeared during review scheduling.')
  const review: MonitoringReview = { id: command.id, monitoringId: record.monitoringId, learner: record.learner, previousOwner: record.owner, owner: command.owner, reviewOn: command.reviewOn, failedUses: record.failedUses, evidenceRequested: command.evidenceRequested.trim(), decisionDue: true, immutable: true }
  next.reviewHistory.push(review)
  addReviewNotices(next, review, command.asOf, record.credential)
  target.owner = command.owner
  next.revision += 1
  return next
}

interface SubmitMonitoringEvidence { id: string; expectedRevision: number; role: MonitoringControlRole; monitoringId: string; learner: string; evidenceReference: string; submittedOn: string }
export function submitMonitoringEvidence(state: MonitoringPortfolioState, command: SubmitMonitoringEvidence) {
  if (state.evidenceSubmissions.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Credential monitoring changed. Refresh before submitting evidence.')
  if (!monitoringCapabilities(command.role).canSubmitEvidence) throw new Error('Only the learner can submit monitoring evidence.')
  const record = state.records.find((item) => item.monitoringId === command.monitoringId)
  const review = [...state.reviewHistory].reverse().find((item) => item.monitoringId === command.monitoringId)
  if (!record || !review || record.learner !== command.learner) throw new Error('The learner can submit evidence only for their active governed review.')
  if (!command.evidenceReference.trim() || state.closures.some((item) => item.monitoringId === command.monitoringId)) throw new Error('A unique evidence reference is required for active monitoring.')
  const latestSubmission = [...state.evidenceSubmissions].reverse().find((item) => item.monitoringId === command.monitoringId)
  if (latestSubmission && !state.supervisorReviews.some((item) => item.submissionId === latestSubmission.id && item.decision === 'returned')) throw new Error('The current submission awaits supervisor review or was already accepted.')
  if (state.evidenceSubmissions.some((item) => item.monitoringId === command.monitoringId && item.evidenceReference === command.evidenceReference)) throw new Error('This evidence was already submitted.')
  const next = structuredClone(state)
  next.evidenceSubmissions.push({ id: command.id, monitoringId: command.monitoringId, learner: command.learner, reviewId: review.id, evidenceReference: command.evidenceReference.trim(), submittedOn: command.submittedOn, sourceRevision: state.revision, ...(latestSubmission ? { supersedesSubmissionId: latestSubmission.id } : {}), immutable: true })
  next.revision += 1
  return next
}

interface ReviewMonitoringEvidence { id: string; expectedRevision: number; role: MonitoringControlRole; monitoringId: string; submissionId: string; decision: 'accepted' | 'returned'; rationale: string; reviewer: string; reviewedOn: string }
export function reviewMonitoringEvidence(state: MonitoringPortfolioState, command: ReviewMonitoringEvidence) {
  if (state.supervisorReviews.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Credential monitoring changed. Refresh before reviewing evidence.')
  if (command.role !== 'Supervisor') throw new Error('Only the supervisor can review learner evidence.')
  if (state.closures.some((item) => item.monitoringId === command.monitoringId)) throw new Error('Completed monitoring cannot accept a new review.')
  const latest = [...state.evidenceSubmissions].reverse().find((item) => item.monitoringId === command.monitoringId)
  if (latest?.id !== command.submissionId) throw new Error('Review the latest learner submission.')
  if (state.supervisorReviews.some((item) => item.submissionId === latest.id)) throw new Error('This submission already has a supervisor decision.')
  if (command.rationale.trim().length < 15 || !command.reviewer.trim()) throw new Error('A named supervisor and specific rationale are required.')
  const validReviewDate = /^20\d{2}-\d{2}-\d{2}$/.test(command.reviewedOn) && Number.isFinite(Date.parse(command.reviewedOn)) && new Date(command.reviewedOn).toISOString().slice(0, 10) === command.reviewedOn
  if (!validReviewDate || command.reviewedOn < latest.submittedOn) throw new Error('Supervisor review needs a valid business date on or after the actual learner submission.')

  const currentReview = state.reviewHistory.filter((item) => item.monitoringId === command.monitoringId).at(-1)
  if (currentReview?.assignedSupervisor && command.reviewer.trim() !== currentReview.assignedSupervisor) throw new Error('Only the assigned replacement supervisor can decide current learner evidence.')
  const currentNotice = state.scheduledNotices.find((item) => item.reviewId === currentReview?.id && item.audience === 'supervisor')
  if (currentReview?.assignedSupervisor && !state.noticeAcknowledgements.some((item) => item.noticeId === currentNotice?.id && item.actor === currentReview.assignedSupervisor)) throw new Error('Replacement supervisor must acknowledge the current review notice before deciding learner evidence.')
  const next = structuredClone(state)
  next.supervisorReviews.push({ id: command.id, monitoringId: command.monitoringId, submissionId: latest.id, decision: command.decision, rationale: command.rationale.trim(), reviewer: command.reviewer.trim(), reviewedOn: command.reviewedOn, ...(currentReview ? { reviewId: currentReview.id } : {}), sourceRevision: state.revision, immutable: true })
  next.learnerNotices.push({ id: `notice-${command.id}`, monitoringId: command.monitoringId, learner: latest.learner, submissionId: latest.id, reviewId: command.id, decision: command.decision, evidenceReference: latest.evidenceReference, rationale: command.rationale.trim(), issuedOn: command.reviewedOn, immutable: true })
  next.revision += 1
  return next
}

interface RevalidateCarriedEvidence { id: string; expectedRevision: number; role: MonitoringControlRole; monitoringId: string; submissionId: string; carryForwardReview: true; decision: SupervisorEvidenceReview['decision']; rationale: string; reviewer: string; reviewedOn: string }
/** A new cycle reuses learner work only through a new accountable supervisor decision. */
export function revalidateCarriedMonitoringEvidence(state: MonitoringPortfolioState, command: RevalidateCarriedEvidence) {
  if (state.supervisorReviews.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Credential monitoring changed. Refresh before revalidating retained evidence.')
  if (command.role !== 'Supervisor') throw new Error('Only the current supervisor can revalidate retained evidence.')
  const review = state.reviewHistory.filter((item) => item.monitoringId === command.monitoringId).at(-1)
  const submission = state.evidenceSubmissions.filter((item) => item.monitoringId === command.monitoringId).at(-1)
  const prior = state.supervisorReviews.filter((item) => item.submissionId === submission?.id).at(-1)
  if (!review || submission?.id !== command.submissionId || prior?.decision !== 'accepted' || prior.reviewId === review.id || state.closures.some((item) => item.monitoringId === command.monitoringId) || state.dueReviewDecisions.some((item) => item.reviewId === review.id)) throw new Error('Retained accepted evidence requires an active different review cycle.')
  const supervisor = review.assignedSupervisor ?? 'Monitoring supervisor'
  const notice = state.scheduledNotices.find((item) => item.reviewId === review.id && item.audience === 'supervisor')
  const acknowledgement = state.noticeAcknowledgements.find((item) => item.noticeId === notice?.id && item.actor === supervisor)
  if (command.reviewer.trim() !== supervisor || !acknowledgement) throw new Error('The current supervisor must acknowledge this cycle before revalidating retained evidence.')
  const validDate = /^20\d{2}-\d{2}-\d{2}$/.test(command.reviewedOn) && Number.isFinite(Date.parse(command.reviewedOn)) && new Date(command.reviewedOn).toISOString().slice(0, 10) === command.reviewedOn
  if (command.rationale.trim().length < 20 || !validDate || command.reviewedOn < acknowledgement.acknowledgedOn || command.reviewedOn < prior.reviewedOn) throw new Error('Revalidation needs a specific rationale and a valid date after current-cycle acknowledgement and original review.')
  const next = structuredClone(state)
  next.supervisorReviews.push({ id: command.id, monitoringId: command.monitoringId, submissionId: submission.id, decision: command.decision, rationale: command.rationale.trim(), reviewer: supervisor, reviewedOn: command.reviewedOn, reviewId: review.id, sourceRevision: state.revision, revalidatedFromDecisionId: prior.id, immutable: true })
  next.learnerNotices.push({ id: `notice-${command.id}`, monitoringId: command.monitoringId, learner: submission.learner, submissionId: submission.id, reviewId: command.id, decision: command.decision, evidenceReference: submission.evidenceReference, rationale: command.rationale.trim(), issuedOn: command.reviewedOn, immutable: true })
  next.revision += 1
  return next
}
export function recordSupervisedMonitoringOutcome(state: MonitoringPortfolioState, command: { id: string; expectedRevision: number; role: MonitoringControlRole; monitoringId: string; successfulUses: number; evidenceReference: string; rationale: string; recordedBy: string; recordedOn: string; supervisedOutcome: true }) {
  if (state.supervisedOutcomes.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Credential monitoring changed. Refresh before recording supervised outcomes.')
  if (command.role !== 'Supervisor') throw new Error('Only the reviewing supervisor can record observed credential outcomes.')
  const record = state.records.find((item) => item.monitoringId === command.monitoringId)
  const cycle = state.reviewHistory.filter((item) => item.monitoringId === command.monitoringId).at(-1)
  const submission = state.evidenceSubmissions.filter((item) => item.monitoringId === command.monitoringId).at(-1)
  const decision = state.supervisorReviews.filter((item) => item.submissionId === submission?.id).at(-1)
  if (!record || !cycle || !submission || decision?.decision !== 'accepted' || decision.reviewId !== cycle.id || state.closures.some((item) => item.monitoringId === record.monitoringId)) throw new Error('Current accepted supervisor evidence and an open monitoring cycle are required.')
  if (command.recordedBy.trim() !== decision.reviewer || (cycle.assignedSupervisor && cycle.assignedSupervisor !== command.recordedBy.trim())) throw new Error('Outcome attribution must match the accountable evidence reviewer.')
  const validDate = /^20\d{2}-\d{2}-\d{2}$/.test(command.recordedOn) && Number.isFinite(Date.parse(command.recordedOn)) && new Date(command.recordedOn).toISOString().slice(0, 10) === command.recordedOn
  if (!validDate || command.recordedOn < decision.reviewedOn || !Number.isSafeInteger(command.successfulUses) || command.successfulUses < record.successfulUses || command.rationale.trim().length < 20 || !command.evidenceReference.trim()) throw new Error('Observed use count, supporting evidence, specific rationale, and valid date after review are required.')
  const previous = state.supervisedOutcomes.filter((item) => item.monitoringId === record.monitoringId && item.reviewId === cycle.id).at(-1)
  if (previous && (command.successfulUses < previous.successfulUses || command.recordedOn < previous.recordedOn || command.evidenceReference.trim() === previous.evidenceReference)) throw new Error('Additional observed outcomes need new evidence without regressing count or chronology.')
  const next = structuredClone(state)
  next.supervisedOutcomes.push({ id: command.id, monitoringId: record.monitoringId, reviewId: cycle.id, submissionId: submission.id, supervisorDecisionId: decision.id, successfulUses: command.successfulUses, evidenceReference: command.evidenceReference.trim(), rationale: command.rationale.trim(), recordedBy: command.recordedBy.trim(), recordedOn: command.recordedOn, immutable: true })
  next.revision += 1
  return next
}

interface CloseCredentialMonitoring { id: string; expectedRevision: number; role: MonitoringControlRole; monitoringId: string; acceptedEvidence: string[]; supervisorApproval: string; complianceApproval: string; successfulUses: number; closedBy: string; closedOn: string }
export function closeCredentialMonitoring(state: MonitoringPortfolioState, command: CloseCredentialMonitoring) {
  if (state.closures.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Credential monitoring changed. Refresh before closure.')
  if (!monitoringCapabilities(command.role).canCloseMonitoring) throw new Error('Only the compliance lead can independently close monitoring.')
  const record = state.records.find((item) => item.monitoringId === command.monitoringId)
  const review = [...state.reviewHistory].reverse().find((item) => item.monitoringId === command.monitoringId)
  if (!record || !review) throw new Error('A governed monitoring review is required before closure.')
  if (command.closedOn < record.endsOn) throw new Error('Monitoring cannot close before its governed window ends.')
  if (command.acceptedEvidence.length < record.evidencePending || !command.supervisorApproval || !command.complianceApproval || !Number.isSafeInteger(command.successfulUses) || command.successfulUses < 5) throw new Error('Current learner evidence, supervisor approval, and independent compliance approval are required.')
  const submittedEvidence = new Set(state.evidenceSubmissions.filter((item) => item.monitoringId === command.monitoringId).map((item) => item.evidenceReference))
  if (submittedEvidence.size > 0 && !command.acceptedEvidence.every((item) => submittedEvidence.has(item))) throw new Error('Accepted evidence must come from the learner submission lineage.')
  if (submittedEvidence.size > 0) {
    const latest = [...state.evidenceSubmissions].reverse().find((item) => item.monitoringId === command.monitoringId)
    const decision = state.supervisorReviews.filter((item) => item.submissionId === latest?.id).at(-1)
    if (decision?.decision !== 'accepted' || ((review.assignedSupervisor || state.reviewHistory.filter((item) => item.monitoringId === command.monitoringId).length > 1) && decision.reviewId !== review.id) || !command.acceptedEvidence.includes(latest?.evidenceReference ?? '')) throw new Error('Current learner evidence requires an accepted supervisor review before compliance closure.')
  }
  const observed = state.supervisedOutcomes.filter((item) => item.monitoringId === record.monitoringId).at(-1)
  if (record.assessmentSource && !observed) throw new Error('Assessment-linked closure needs actual supervised outcomes for the enrolled learner.')
  if (observed) {
    const latest = state.evidenceSubmissions.filter((item) => item.monitoringId === record.monitoringId).at(-1)
    const decision = state.supervisorReviews.filter((item) => item.submissionId === latest?.id).at(-1)
    if (!Number.isSafeInteger(observed.successfulUses) || observed.successfulUses < record.successfulUses || observed.recordedBy !== decision?.reviewer || observed.rationale.trim().length < 20 || !observed.evidenceReference.trim()) throw new Error('Saved supervised outcome count or accountable review identity is invalid.')
    if (observed.reviewId !== review.id || observed.submissionId !== latest?.id || observed.supervisorDecisionId !== decision.id || command.supervisorApproval !== observed.id || command.successfulUses !== observed.successfulUses) throw new Error('Closure must pin the current observed supervisor outcome, reviewed submission, and exact use count.')
    if (command.closedBy.trim() === observed.recordedBy || command.complianceApproval.trim() !== command.id || command.closedOn < observed.recordedOn) throw new Error('Closure needs an attributable independent compliance decision after the supervised outcome.')
  }
  if (review.assignedSupervisor && !state.dueReviewDecisions.some((item) => item.reviewId === review.id && item.outcome === 'completed' && item.evidenceSubmissionId === state.evidenceSubmissions.filter((submission) => submission.monitoringId === record.monitoringId).at(-1)?.id)) throw new Error('Replacement supervisor evidence needs an independent current-cycle compliance completion decision.')
  const next = structuredClone(state)
  const target = next.records.find((item) => item.monitoringId === record.monitoringId)
  if (!target) throw new Error('Monitoring record disappeared during closure.')
  next.closures.push({ id: command.id, monitoringId: record.monitoringId, reviewId: review.id, learner: record.learner, previousFailedUses: record.failedUses, acceptedEvidence: [...command.acceptedEvidence], supervisorApproval: command.supervisorApproval, complianceApproval: command.complianceApproval, successfulUses: command.successfulUses, outcome: 'completed', closedBy: command.closedBy, closedOn: command.closedOn, immutable: true })
  target.successfulUses = command.successfulUses
  target.failedUses = 0
  target.evidencePending = 0
  next.revision += 1
  return next
}

export function queryLearnerMonitoringHistory(state: MonitoringPortfolioState, monitoringId: string) {
  const learnerProgress = queryLearnerProgress(state, monitoringId)
  const complianceHistory = queryComplianceMonitoringHistory(state, monitoringId)
  if (!learnerProgress || !complianceHistory) return null
  return { ...learnerProgress, ...complianceHistory }
}

export function queryLearnerProgress(state: MonitoringPortfolioState, monitoringId: string) {
  const record = state.records.find((item) => item.monitoringId === monitoringId)
  if (!record) return null
  return {
    monitoringId,
    learner: record.learner,
    credential: record.credential,
    currentProgress: { successfulUses: record.successfulUses, failedUses: record.failedUses, evidencePending: record.evidencePending },
    monitoringPeriod: { startsOn: record.startsOn, endsOn: record.endsOn },
    evidenceSubmissions: state.evidenceSubmissions.filter((item) => item.monitoringId === monitoringId).map((item) => ({ evidenceReference: item.evidenceReference, submittedOn: item.submittedOn, supervisorDecision: state.supervisorReviews.filter((review) => review.submissionId === item.id).at(-1)?.decision ?? 'awaiting review' })),
    requestedEvidence: state.reviewHistory.filter((item) => item.monitoringId === monitoringId).map((item) => item.evidenceRequested),
    notices: state.learnerNotices.filter((item) => item.monitoringId === monitoringId && item.learner === record.learner),
  }
}

export function querySupervisorReviewQueue(state: MonitoringPortfolioState, asOf: string) {
  const monitoringIds = [...new Set(state.reviewHistory.map((item) => item.monitoringId))]
  return monitoringIds.filter((monitoringId) => !state.closures.some((closure) => closure.monitoringId === monitoringId)).map((monitoringId) => {
    const review = state.reviewHistory.filter((item) => item.monitoringId === monitoringId).at(-1)
    if (!review) throw new Error('Scheduled monitoring review disappeared from the supervisor queue.')
    const record = state.records.find((item) => item.monitoringId === monitoringId)
    if (!record) throw new Error('Scheduled monitoring record disappeared from the supervisor queue.')
    const latest = state.evidenceSubmissions.filter((item) => item.monitoringId === review.monitoringId).at(-1)
    const decision = state.supervisorReviews.filter((item) => item.submissionId === latest?.id && item.reviewId === review.id).at(-1)
    const previousDecision = state.supervisorReviews.filter((item) => item.monitoringId === monitoringId && item.submissionId !== latest?.id).at(-1)?.decision ?? null
    const supervisorNotice = state.scheduledNotices.find((item) => item.reviewId === review.id && item.audience === 'supervisor')
    return { monitoringId: review.monitoringId, learner: review.learner, credential: record.credential, monitoringPeriod: { startsOn: record.startsOn, endsOn: record.endsOn }, previousDecision, owner: review.owner, supervisor: review.assignedSupervisor ?? 'Monitoring supervisor', noticeAcknowledged: state.noticeAcknowledgements.some((item) => item.noticeId === supervisorNotice?.id), requestedEvidence: review.evidenceRequested, dueOn: review.reviewOn, overdue: review.reviewOn < asOf && !decision, submissionId: latest?.id ?? null, evidenceReference: latest?.evidenceReference ?? null, status: !latest ? 'awaiting learner' as const : !decision ? 'awaiting supervisor' as const : decision.decision === 'returned' ? 'awaiting correction' as const : 'accepted' as const }
  })
}

export function queryComplianceMonitoringHistory(state: MonitoringPortfolioState, monitoringId: string) {
  const record = state.records.find((item) => item.monitoringId === monitoringId)
  if (!record) return null
  return {
    reviews: state.reviewHistory.filter((item) => item.monitoringId === monitoringId).map((item) => ({ reviewId: item.id, owner: item.owner, requestedEvidence: item.evidenceRequested, priorFailures: item.failedUses })),
    evidenceSubmissions: state.evidenceSubmissions.filter((item) => item.monitoringId === monitoringId),
    supervisorReviews: state.supervisorReviews.filter((item) => item.monitoringId === monitoringId),
    closures: state.closures.filter((item) => item.monitoringId === monitoringId).map((item) => ({ closureId: item.id, outcome: item.outcome, acceptedEvidence: [...item.acceptedEvidence], previousFailedUses: item.previousFailedUses })),
  }
}

export function queryCredentialMonitoringState(state: MonitoringPortfolioState, monitoringId: string) {
  const record = state.records.find((item) => item.monitoringId === monitoringId)
  if (!record) return null
  const closure = [...state.closures].reverse().find((item) => item.monitoringId === monitoringId) ?? null
  return { credential: record.credential, monitoringPeriod: { startsOn: record.startsOn, endsOn: record.endsOn }, monitoringStatus: closure ? 'completed' as const : 'active' as const, latestComplianceDecision: closure ? { closureId: closure.id, outcome: closure.outcome, acceptedEvidence: [...closure.acceptedEvidence], supervisorApproval: closure.supervisorApproval, complianceApproval: closure.complianceApproval } : null }
}

export function queryMonitoringInterface(state: MonitoringPortfolioState, monitoringId: string, role: MonitoringControlRole) {
  const record = state.records.find((item) => item.monitoringId === monitoringId)
  if (!record) return null
  const review = [...state.reviewHistory].reverse().find((item) => item.monitoringId === monitoringId) ?? null
  const closure = [...state.closures].reverse().find((item) => item.monitoringId === monitoringId) ?? null
  const submittedEvidence = state.evidenceSubmissions.filter((item) => item.monitoringId === monitoringId).map((item) => ({ evidenceReference: item.evidenceReference, submittedOn: item.submittedOn, supervisorDecision: state.supervisorReviews.filter((decision) => decision.submissionId === item.id).at(-1)?.decision ?? 'awaiting review' }))
  if (role === 'Learner') return { persona: 'learner' as const, learner: record.learner, credential: record.credential, monitoringPeriod: { startsOn: record.startsOn, endsOn: record.endsOn }, status: closure ? 'completed' as const : 'active' as const, requestedEvidence: review?.evidenceRequested ?? null, submittedEvidence, notices: state.learnerNotices.filter((item) => item.monitoringId === monitoringId && item.learner === record.learner), upcomingReview: review?.reviewOn ?? null, successfulUses: record.successfulUses }
  return { persona: 'reviewer' as const, learner: record.learner, credential: record.credential, status: closure ? 'completed' as const : 'active' as const, owner: record.owner, previousFailures: review?.failedUses ?? record.failedUses, requestedEvidence: review?.evidenceRequested ?? null, submittedEvidence, supervisorReviews: state.supervisorReviews.filter((item) => item.monitoringId === monitoringId), supervisorApproval: closure?.supervisorApproval ?? null, complianceDecision: closure ? { outcome: closure.outcome, approval: closure.complianceApproval, closedOn: closure.closedOn } : null, upcomingReview: review?.reviewOn ?? null }
}

export interface LearnerProgressReader { readLearnerProgress(monitoringId: string): ReturnType<typeof queryLearnerProgress> }
export interface CredentialMonitoringReader { readCredentialState(monitoringId: string): ReturnType<typeof queryCredentialMonitoringState> }
export interface ComplianceMonitoringReader { readComplianceHistory(monitoringId: string): ReturnType<typeof queryComplianceMonitoringHistory> }
export class MonitoringReadAdapter implements LearnerProgressReader, CredentialMonitoringReader, ComplianceMonitoringReader {
  private readonly readState: () => MonitoringPortfolioState
  constructor(readState: () => MonitoringPortfolioState) { this.readState = readState }
  readLearnerProgress(monitoringId: string) { return queryLearnerProgress(this.readState(), monitoringId) }
  readCredentialState(monitoringId: string) { return queryCredentialMonitoringState(this.readState(), monitoringId) }
  readComplianceHistory(monitoringId: string) { return queryComplianceMonitoringHistory(this.readState(), monitoringId) }
}

export interface MonitoringPersistence { load(): MonitoringPortfolioState | null; saveMonitoring(state: MonitoringPortfolioState): void }
export class BrowserMonitoringPersistence implements MonitoringPersistence {
  static key = 'skillorbit:monitoring-portfolio:v3'
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'>
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage }
  load() { const raw = this.storage.getItem(BrowserMonitoringPersistence.key); if (!raw) return null; const saved = JSON.parse(raw) as Partial<MonitoringPortfolioState>; return { ...(saved as MonitoringPortfolioState), reviewHistory: saved.reviewHistory ?? [], evidenceSubmissions: saved.evidenceSubmissions ?? [], supervisorReviews: saved.supervisorReviews ?? [], learnerNotices: saved.learnerNotices ?? [], scheduledNotices: saved.scheduledNotices ?? [], noticeAcknowledgements: saved.noticeAcknowledgements ?? [], dueReviewDecisions: saved.dueReviewDecisions ?? [], supervisorExceptions: saved.supervisorExceptions ?? [], closures: saved.closures ?? [], recoveryImports: saved.recoveryImports ?? [], supervisedOutcomes: saved.supervisedOutcomes ?? [], assessmentEnrollments: saved.assessmentEnrollments ?? [] } }
  saveMonitoring(state: MonitoringPortfolioState) { this.storage.setItem(BrowserMonitoringPersistence.key, JSON.stringify(state)) }
}
export class MonitoringPortfolioRepository {
  private readonly persistence: MonitoringPersistence
  private readonly readModeration: (() => ModerationState) | undefined
  constructor(persistence: MonitoringPersistence, readModeration?: () => ModerationState) { this.persistence = persistence; this.readModeration = readModeration }
  read(): MonitoringPortfolioState { return this.persistence.load() ?? structuredClone(initialMonitoringPortfolioState) }
  dispatch(command: Parameters<typeof recordSupervisedMonitoringOutcome>[1] | ScheduleMonitoringReview | SubmitMonitoringEvidence | ReviewMonitoringEvidence | CloseCredentialMonitoring | Parameters<typeof rescheduleMonitoringReview>[1] | Parameters<typeof acknowledgeScheduledReview>[1] | Parameters<typeof decideDueMonitoringReview>[1] | Parameters<typeof reassignUnavailableSupervisor>[1] | RevalidateCarriedEvidence | Parameters<typeof scheduleDueMonitoringReview>[1]) {
    const current = this.read()
    const consequential = 'supervisedOutcome' in command || 'acceptedEvidence' in command || 'decision' in command || ('outcome' in command && command.outcome === 'completed')
    if (consequential && 'monitoringId' in command) requireCurrentAssessment(current, command.monitoringId, this.readModeration)
    const next = 'supervisedOutcome' in command ? recordSupervisedMonitoringOutcome(current, command) : 'routineReview' in command ? scheduleDueMonitoringReview(current, command) : 'carryForwardReview' in command ? revalidateCarriedMonitoringEvidence(current, command) : 'replacementSupervisor' in command ? reassignUnavailableSupervisor(current, command) : 'nextReviewOn' in command ? decideDueMonitoringReview(current, command) : 'noticeId' in command ? acknowledgeScheduledReview(current, command) : 'reason' in command && 'reviewOn' in command ? rescheduleMonitoringReview(current, command) : 'acceptedEvidence' in command ? closeCredentialMonitoring(current, command) : 'decision' in command ? reviewMonitoringEvidence(current, command) : 'evidenceReference' in command ? submitMonitoringEvidence(current, command) : scheduleMonitoringReview(current, command)
    if (next !== current) {
      if (consequential && 'monitoringId' in command) requireCurrentAssessment(next, command.monitoringId, this.readModeration)
      this.persistence.saveMonitoring(next)
    }
    return next
  }
  registerAssessment(command: RegisterAssessmentMonitoring) {
    if (!this.readModeration) throw new Error('Authoritative assessment source is unavailable.')
    const current = this.read(), source = this.readModeration()
    const next = registerAssessmentMonitoring(current, source, command)
    if (this.read().revision !== current.revision || this.readModeration().revision !== source.revision) throw new Error('Another session changed enrollment sources before save. Refresh and retry.')
    this.persistence.saveMonitoring(next)
    return next
  }
  importRecovery(archive: ComplianceRecoveryArchive, command: Parameters<typeof importComplianceRecovery>[2]) { const current = this.read(); const next = importComplianceRecovery(current, archive, command); if (next !== current) this.persistence.saveMonitoring(next); return next }
}
