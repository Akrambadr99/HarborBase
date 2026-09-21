import { credentialMonitoringPortfolio, seededCredentialMonitoring, type CredentialMonitoringRecord } from './monitoring-portfolio'

export type MonitoringControlRole = 'Learner' | 'Supervisor' | 'Compliance Reviewer' | 'Compliance Lead'
export function monitoringCapabilities(role: MonitoringControlRole) {
  return { canSubmitEvidence: role === 'Learner', canApproveEvidence: role === 'Supervisor' || role === 'Compliance Lead', canRequestEvidence: role === 'Compliance Reviewer' || role === 'Compliance Lead', canReassignReview: role === 'Compliance Lead', canCloseMonitoring: role === 'Compliance Lead' } as const
}
export interface MonitoringReview { id: string; monitoringId: string; learner: string; previousOwner: string; owner: string; reviewOn: string; failedUses: number; evidenceRequested: string; decisionDue: true; immutable: true }
export interface MonitoringClosure { id: string; monitoringId: string; reviewId: string; learner: string; previousFailedUses: number; acceptedEvidence: string[]; supervisorApproval: string; complianceApproval: string; successfulUses: number; outcome: 'completed'; closedBy: string; closedOn: string; immutable: true }
export interface MonitoringEvidenceSubmission { id: string; monitoringId: string; learner: string; reviewId: string; evidenceReference: string; submittedOn: string; sourceRevision: number; immutable: true }
export interface SupervisorEvidenceReview { id: string; monitoringId: string; submissionId: string; decision: 'accepted' | 'returned'; rationale: string; reviewer: string; reviewedOn: string; sourceRevision: number; immutable: true }
export interface LearnerMonitoringNotice { id: string; monitoringId: string; learner: string; submissionId: string; reviewId: string; decision: SupervisorEvidenceReview['decision']; evidenceReference: string; rationale: string; issuedOn: string; immutable: true }
export interface MonitoringPortfolioState { revision: number; records: CredentialMonitoringRecord[]; reviewHistory: MonitoringReview[]; evidenceSubmissions: MonitoringEvidenceSubmission[]; supervisorReviews: SupervisorEvidenceReview[]; learnerNotices: LearnerMonitoringNotice[]; closures: MonitoringClosure[] }
export const monitoringOwnerPolicy = { maximumHighRiskReviews: 2 } as const
export const initialMonitoringPortfolioState: MonitoringPortfolioState = { revision: 0, records: structuredClone(seededCredentialMonitoring), reviewHistory: [], evidenceSubmissions: [], supervisorReviews: [], learnerNotices: [], closures: [] }
interface ScheduleMonitoringReview { id: string; expectedRevision: number; role: MonitoringControlRole; monitoringId: string; owner: string; reviewOn: string; asOf: string; evidenceRequested: string }

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
  next.reviewHistory.push({ id: command.id, monitoringId: record.monitoringId, learner: record.learner, previousOwner: record.owner, owner: command.owner, reviewOn: command.reviewOn, failedUses: record.failedUses, evidenceRequested: command.evidenceRequested.trim(), decisionDue: true, immutable: true })
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
  next.evidenceSubmissions.push({ id: command.id, monitoringId: command.monitoringId, learner: command.learner, reviewId: review.id, evidenceReference: command.evidenceReference.trim(), submittedOn: command.submittedOn, sourceRevision: state.revision, immutable: true })
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
  const next = structuredClone(state)
  next.supervisorReviews.push({ id: command.id, monitoringId: command.monitoringId, submissionId: latest.id, decision: command.decision, rationale: command.rationale.trim(), reviewer: command.reviewer.trim(), reviewedOn: command.reviewedOn, sourceRevision: state.revision, immutable: true })
  next.learnerNotices.push({ id: `notice-${command.id}`, monitoringId: command.monitoringId, learner: latest.learner, submissionId: latest.id, reviewId: command.id, decision: command.decision, evidenceReference: latest.evidenceReference, rationale: command.rationale.trim(), issuedOn: command.reviewedOn, immutable: true })
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
  if (command.acceptedEvidence.length < record.evidencePending || !command.supervisorApproval || !command.complianceApproval || command.successfulUses < 5) throw new Error('Current learner evidence, supervisor approval, and independent compliance approval are required.')
  const submittedEvidence = new Set(state.evidenceSubmissions.filter((item) => item.monitoringId === command.monitoringId).map((item) => item.evidenceReference))
  if (submittedEvidence.size > 0 && !command.acceptedEvidence.every((item) => submittedEvidence.has(item))) throw new Error('Accepted evidence must come from the learner submission lineage.')
  if (submittedEvidence.size > 0) {
    const latest = [...state.evidenceSubmissions].reverse().find((item) => item.monitoringId === command.monitoringId)
    const decision = state.supervisorReviews.find((item) => item.submissionId === latest?.id)
    if (decision?.decision !== 'accepted' || !command.acceptedEvidence.includes(latest?.evidenceReference ?? '')) throw new Error('Current learner evidence requires an accepted supervisor review before compliance closure.')
  }
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
    evidenceSubmissions: state.evidenceSubmissions.filter((item) => item.monitoringId === monitoringId).map((item) => ({ evidenceReference: item.evidenceReference, submittedOn: item.submittedOn, supervisorDecision: state.supervisorReviews.find((review) => review.submissionId === item.id)?.decision ?? 'awaiting review' })),
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
    const decision = state.supervisorReviews.find((item) => item.submissionId === latest?.id)
    const previousDecision = state.supervisorReviews.filter((item) => item.monitoringId === monitoringId && item.submissionId !== latest?.id).at(-1)?.decision ?? null
    return { monitoringId: review.monitoringId, learner: review.learner, credential: record.credential, monitoringPeriod: { startsOn: record.startsOn, endsOn: record.endsOn }, previousDecision, owner: review.owner, requestedEvidence: review.evidenceRequested, dueOn: review.reviewOn, overdue: review.reviewOn < asOf && !decision, submissionId: latest?.id ?? null, evidenceReference: latest?.evidenceReference ?? null, status: !latest ? 'awaiting learner' as const : !decision ? 'awaiting supervisor' as const : decision.decision === 'returned' ? 'awaiting correction' as const : 'accepted' as const }
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
  const submittedEvidence = state.evidenceSubmissions.filter((item) => item.monitoringId === monitoringId).map((item) => ({ evidenceReference: item.evidenceReference, submittedOn: item.submittedOn, supervisorDecision: state.supervisorReviews.find((decision) => decision.submissionId === item.id)?.decision ?? 'awaiting review' }))
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
  load() { const raw = this.storage.getItem(BrowserMonitoringPersistence.key); if (!raw) return null; const saved = JSON.parse(raw) as Partial<MonitoringPortfolioState>; return { ...(saved as MonitoringPortfolioState), reviewHistory: saved.reviewHistory ?? [], evidenceSubmissions: saved.evidenceSubmissions ?? [], supervisorReviews: saved.supervisorReviews ?? [], learnerNotices: saved.learnerNotices ?? [], closures: saved.closures ?? [] } }
  saveMonitoring(state: MonitoringPortfolioState) { this.storage.setItem(BrowserMonitoringPersistence.key, JSON.stringify(state)) }
}
export class MonitoringPortfolioRepository {
  private readonly persistence: MonitoringPersistence
  constructor(persistence: MonitoringPersistence) { this.persistence = persistence }
  read(): MonitoringPortfolioState { return this.persistence.load() ?? structuredClone(initialMonitoringPortfolioState) }
  dispatch(command: ScheduleMonitoringReview | SubmitMonitoringEvidence | ReviewMonitoringEvidence | CloseCredentialMonitoring) { const current = this.read(); const next = 'acceptedEvidence' in command ? closeCredentialMonitoring(current, command) : 'decision' in command ? reviewMonitoringEvidence(current, command) : 'evidenceReference' in command ? submitMonitoringEvidence(current, command) : scheduleMonitoringReview(current, command); if (next !== current) this.persistence.saveMonitoring(next); return next }
}
