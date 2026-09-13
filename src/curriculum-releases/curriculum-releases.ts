export type CurriculumRole = 'Content Author' | 'Instructional Reviewer' | 'Compliance Approver' | 'Learning Admin';
export interface CurriculumReleaseState {
  revision: number;
  course: { id: string; title: string; publishedVersion: number; version: number };
  cohort: { id: string; courseVersion: number; enrolled: number; completed: number; status: 'active'; version: number };
  release: null | { id: string; status: 'draft' | 'reviewed' | 'approved' | 'published' | 'migrated'; fromVersion: number; toVersion: number; courseVersion: number; cohortVersion: number; changeSummary: string; assessmentChanged: boolean; author: string; reviewer?: string; approver?: string; migrationReason?: string };
  notices: { id: string; cohortId: string; learners: number; message: string; immutable: true }[];
  events: { id: string; action: string; actor: string; detail: string }[];
}
export const initialCurriculumReleaseState: CurriculumReleaseState = { revision: 0, course: { id: 'COURSE-DG3', title: 'Data governance foundations', publishedVersion: 9, version: 12 }, cohort: { id: 'COHORT-DG-12', courseVersion: 9, enrolled: 8, completed: 3, status: 'active', version: 7 }, release: null, notices: [], events: [] };
interface Meta { id: string; expectedRevision: number; actor: { id: string; role: CurriculumRole } }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function begin(state: CurriculumReleaseState, command: Meta) { assert(state.revision === command.expectedRevision, 'Curriculum release changed. Refresh before retrying.'); assert(!state.events.some((event) => event.id === command.id), 'Command already applied.'); return structuredClone(state); }
function finish(state: CurriculumReleaseState, command: Meta, action: string, detail: string) { state.revision += 1; state.events.push({ id: command.id, action, actor: command.actor.id, detail }); return state; }
function currentRelease(state: CurriculumReleaseState) { assert(state.release, 'No curriculum release exists.'); return state.release; }
function assertCurrent(state: CurriculumReleaseState) { const release = currentRelease(state); assert(release.courseVersion === state.course.version, 'Course metadata changed after release drafting.'); assert(release.cohortVersion === state.cohort.version, 'Active cohort changed after release drafting.'); }

export function draftCurriculumRelease(state: CurriculumReleaseState, command: Meta & { changeSummary: string; assessmentChanged: boolean }) {
  assert(command.actor.role === 'Content Author', 'Only content authors can draft curriculum releases.');
  const next = begin(state, command);
  assert(!next.release, 'An active curriculum release already exists.');
  assert(command.changeSummary.trim().length >= 30, 'Curriculum change summary must be substantive.');
  next.release = { id: `${command.id}-release`, status: 'draft', fromVersion: next.course.publishedVersion, toVersion: next.course.publishedVersion + 1, courseVersion: next.course.version, cohortVersion: next.cohort.version, changeSummary: command.changeSummary.trim(), assessmentChanged: command.assessmentChanged, author: command.actor.id };
  return finish(next, command, 'curriculum-release-drafted', String(next.release.toVersion));
}

export function reviewInstructionalDesign(state: CurriculumReleaseState, command: Meta) {
  assert(command.actor.role === 'Instructional Reviewer', 'Only instructional reviewers can review releases.');
  const next = begin(state, command), release = currentRelease(next);
  assert(release.status === 'draft' && command.actor.id !== release.author, 'Independent instructional review is required.');
  assertCurrent(next);
  assert(release.changeSummary.length >= 30, 'Release lacks instructional change evidence.');
  release.status = 'reviewed'; release.reviewer = command.actor.id;
  return finish(next, command, 'curriculum-instructional-review-passed', release.id);
}

export function approveComplianceRelease(state: CurriculumReleaseState, command: Meta) {
  assert(command.actor.role === 'Compliance Approver', 'Only compliance approvers can approve curriculum.');
  const next = begin(state, command), release = currentRelease(next);
  assert(release.status === 'reviewed', 'Instructionally reviewed release is required.');
  assert(command.actor.id !== release.author && command.actor.id !== release.reviewer, 'Compliance approval must be independent.');
  assertCurrent(next);
  assert(release.assessmentChanged, 'Compliance release requires versioned assessment impact.');
  release.status = 'approved'; release.approver = command.actor.id;
  return finish(next, command, 'curriculum-compliance-approved', String(release.toVersion));
}

export function publishCurriculum(state: CurriculumReleaseState, command: Meta) {
  assert(command.actor.role === 'Learning Admin', 'Only learning administrators can publish curriculum.');
  const next = begin(state, command), release = currentRelease(next);
  assert(release.status === 'approved', 'Approved curriculum release is required.');
  assertCurrent(next);
  assert(release.fromVersion === next.course.publishedVersion, 'Published course version advanced before release.');
  next.course.publishedVersion = release.toVersion; next.course.version += 1; release.courseVersion = next.course.version; release.status = 'published';
  return finish(next, command, 'curriculum-release-published', String(release.toVersion));
}

export function migrateActiveCohort(state: CurriculumReleaseState, command: Meta & { reason: string }) {
  assert(command.actor.role === 'Learning Admin', 'Only learning administrators can migrate cohorts.');
  const next = begin(state, command), release = currentRelease(next);
  assert(release.status === 'published', 'Published curriculum release is required.');
  assert(release.courseVersion === next.course.version && release.cohortVersion === next.cohort.version, 'Course or cohort changed before migration.');
  assert(next.cohort.completed === 0 || command.reason.trim().length >= 30, 'Migration with completed learners requires a substantive reason.');
  const affected = next.cohort.enrolled - next.cohort.completed;
  assert(affected > 0, 'No active learners require curriculum migration.');
  next.cohort.courseVersion = release.toVersion; next.cohort.version += 1; release.cohortVersion = next.cohort.version; release.status = 'migrated'; release.migrationReason = command.reason.trim();
  next.notices.push({ id: `${command.id}-notice`, cohortId: next.cohort.id, learners: affected, message: `Course updated to version ${String(release.toVersion)}`, immutable: true });
  return finish(next, command, 'active-cohort-migrated', String(affected));
}

export class CurriculumReleaseRepository { static key = 'skillorbit:curriculum-releases:v1'; private storage: Pick<Storage, 'getItem' | 'setItem'>; constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage; } read() { const raw = this.storage.getItem(CurriculumReleaseRepository.key); return raw ? JSON.parse(raw) as CurriculumReleaseState : structuredClone(initialCurriculumReleaseState); } commit(expectedRevision: number, operation: (state: CurriculumReleaseState) => CurriculumReleaseState) { const current = this.read(); assert(current.revision === expectedRevision, 'Another session changed curriculum. Refresh before retrying.'); const next = operation(current); this.storage.setItem(CurriculumReleaseRepository.key, JSON.stringify(next)); return next; } }
