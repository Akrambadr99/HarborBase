export type GapRole = 'Learning Partner' | 'People Analyst' | 'Department Manager' | 'Learning Admin' | 'Learner' | 'Compliance Reviewer';

export interface SkillsGapState {
  revision: number;
  demand: { id: string; version: number; skill: string; requiredLevel: number; requiredPeople: number; effectiveOn: string };
  workers: { id: string; version: number; level: number; assessmentVersion: number; status: 'available' | 'assigned' | 'qualified' }[];
  course: { id: string; version: number; skill: string; targetLevel: number; seats: number; occupied: number; status: 'published' };
  plan: null | {
    id: string;
    status: 'draft' | 'validated' | 'approved' | 'assigned' | 'in-progress' | 'completed' | 'verified' | 'cancelled';
    owner: string;
    demandVersion: number;
    courseVersion: number;
    workerVersions: Record<string, number>;
    workerIds: string[];
    analyst?: string;
    manager?: string;
  };
  enrollments: { id: string; workerId: string; courseId: string; status: 'assigned' | 'accepted' | 'completed'; score?: number }[];
  events: { id: string; action: string; actor: string; detail: string }[];
}

export const initialSkillsGapState: SkillsGapState = {
  revision: 0,
  demand: { id: 'DEMAND-DATA-7', version: 8, skill: 'Data governance', requiredLevel: 3, requiredPeople: 2, effectiveOn: '2026-10-01' },
  workers: [
    { id: 'LEARNER-A', version: 5, level: 2, assessmentVersion: 3, status: 'available' },
    { id: 'LEARNER-B', version: 7, level: 2, assessmentVersion: 4, status: 'available' },
    { id: 'LEARNER-C', version: 6, level: 3, assessmentVersion: 5, status: 'qualified' },
  ],
  course: { id: 'COURSE-DG3', version: 9, skill: 'Data governance', targetLevel: 3, seats: 3, occupied: 0, status: 'published' },
  plan: null,
  enrollments: [],
  events: [],
};

interface CommandMeta { id: string; expectedRevision: number; actor: { id: string; role: GapRole } }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function begin(state: SkillsGapState, command: CommandMeta) { assert(state.revision === command.expectedRevision, 'Skills-gap plan changed. Refresh before retrying.'); assert(!state.events.some((event) => event.id === command.id), 'Command already applied.'); return structuredClone(state); }
function finish(state: SkillsGapState, command: CommandMeta, action: string, detail: string) { state.revision += 1; state.events.push({ id: command.id, action, actor: command.actor.id, detail }); return state; }
function currentPlan(state: SkillsGapState) { assert(state.plan, 'No skills-gap plan exists.'); return state.plan; }
function worker(state: SkillsGapState, workerId: string) { const target = state.workers.find((item) => item.id === workerId); assert(target, 'Plan worker was not found.'); return target; }
function assertEvidenceVersions(state: SkillsGapState) { const plan = currentPlan(state); assert(plan.demandVersion === state.demand.version, 'Workforce demand changed after planning.'); assert(plan.courseVersion === state.course.version, 'Learning course changed after planning.'); for (const workerId of plan.workerIds) assert(plan.workerVersions[workerId] === worker(state, workerId).version, `Worker ${workerId} changed after planning.`); }

export function draftSkillsGapPlan(state: SkillsGapState, command: CommandMeta & { workerIds: string[] }) {
  assert(command.actor.role === 'Learning Partner', 'Only learning partners can draft skills-gap plans.');
  const next = begin(state, command);
  assert(!next.plan || ['verified', 'cancelled'].includes(next.plan.status), 'An active skills-gap plan already exists.');
  const uniqueIds = [...new Set(command.workerIds)];
  assert(uniqueIds.length > 0 && uniqueIds.length <= next.demand.requiredPeople, 'Plan size must fit the workforce demand.');
  for (const workerId of uniqueIds) {
    const target = worker(next, workerId);
    assert(target.level < next.demand.requiredLevel && target.status === 'available', `${workerId} has no eligible skill gap.`);
  }
  assert(next.course.skill === next.demand.skill && next.course.targetLevel >= next.demand.requiredLevel, 'Published course does not satisfy the demand.');
  next.plan = { id: `${command.id}-plan`, status: 'draft', owner: command.actor.id, demandVersion: next.demand.version, courseVersion: next.course.version, workerVersions: Object.fromEntries(uniqueIds.map((id) => [id, worker(next, id).version])), workerIds: uniqueIds };
  return finish(next, command, 'skills-gap-plan-drafted', uniqueIds.join(','));
}

export function validateAssessmentEvidence(state: SkillsGapState, command: CommandMeta) {
  assert(command.actor.role === 'People Analyst', 'Only people analysts can validate assessment evidence.');
  const next = begin(state, command), plan = currentPlan(next);
  assert(plan.status === 'draft' && command.actor.id !== plan.owner, 'Independent draft-plan validation is required.');
  assertEvidenceVersions(next);
  for (const workerId of plan.workerIds) assert(worker(next, workerId).assessmentVersion > 0, `${workerId} lacks current assessment evidence.`);
  plan.status = 'validated'; plan.analyst = command.actor.id;
  return finish(next, command, 'skills-gap-evidence-validated', plan.id);
}

export function approveSkillsGapPlan(state: SkillsGapState, command: CommandMeta) {
  assert(command.actor.role === 'Department Manager', 'Only department managers can approve skills-gap plans.');
  const next = begin(state, command), plan = currentPlan(next);
  assert(plan.status === 'validated', 'Validated skills-gap plan is required.');
  assert(command.actor.id !== plan.owner && command.actor.id !== plan.analyst, 'Manager approval must be independent.');
  assertEvidenceVersions(next);
  assert(plan.workerIds.length + next.workers.filter((item) => item.level >= next.demand.requiredLevel).length >= next.demand.requiredPeople, 'Plan cannot satisfy required workforce coverage.');
  plan.status = 'approved'; plan.manager = command.actor.id;
  return finish(next, command, 'skills-gap-plan-approved', next.demand.id);
}

export function assignPlanLearning(state: SkillsGapState, command: CommandMeta) {
  assert(command.actor.role === 'Learning Admin', 'Only learning administrators can assign plan learning.');
  const next = begin(state, command), plan = currentPlan(next);
  assert(plan.status === 'approved', 'Approved skills-gap plan is required.');
  assertEvidenceVersions(next);
  assert(next.course.seats - next.course.occupied >= plan.workerIds.length, 'Course capacity cannot cover the approved plan.');
  for (const workerId of plan.workerIds) {
    assert(!next.enrollments.some((item) => item.workerId === workerId && item.courseId === next.course.id), `${workerId} is already enrolled.`);
    next.enrollments.push({ id: `${command.id}-${workerId}`, workerId, courseId: next.course.id, status: 'assigned' });
    const target = worker(next, workerId); target.status = 'assigned'; target.version += 1; plan.workerVersions[workerId] = target.version;
  }
  next.course.occupied += plan.workerIds.length; next.course.version += 1; plan.courseVersion = next.course.version; plan.status = 'assigned';
  return finish(next, command, 'skills-gap-learning-assigned', String(plan.workerIds.length));
}

export function acceptLearningAssignment(state: SkillsGapState, command: CommandMeta) {
  assert(command.actor.role === 'Learner', 'Only learners can accept their assignments.');
  const next = begin(state, command), plan = currentPlan(next);
  assert(['assigned', 'in-progress'].includes(plan.status) && plan.workerIds.includes(command.actor.id), 'Assigned learner is required.');
  const enrollment = next.enrollments.find((item) => item.workerId === command.actor.id && item.status === 'assigned');
  assert(enrollment, 'Learner has no pending assignment.');
  enrollment.status = 'accepted'; plan.status = 'in-progress';
  return finish(next, command, 'skills-gap-assignment-accepted', command.actor.id);
}

export function recordPlanCompletion(state: SkillsGapState, command: CommandMeta & { workerId: string; score: number }) {
  assert(command.actor.role === 'Learning Admin', 'Only learning administrators can record plan completion.');
  const next = begin(state, command), plan = currentPlan(next);
  assert(plan.status === 'in-progress' && plan.workerIds.includes(command.workerId), 'In-progress plan worker is required.');
  const enrollment = next.enrollments.find((item) => item.workerId === command.workerId && item.status === 'accepted');
  assert(enrollment, 'Accepted enrollment is required.');
  assert(Number.isInteger(command.score) && command.score >= 80 && command.score <= 100, 'Completion requires a score from 80 to 100.');
  enrollment.status = 'completed'; enrollment.score = command.score;
  const target = worker(next, command.workerId); target.level = next.course.targetLevel; target.status = 'qualified'; target.version += 1; plan.workerVersions[target.id] = target.version;
  if (plan.workerIds.every((id) => next.enrollments.some((item) => item.workerId === id && item.status === 'completed'))) plan.status = 'completed';
  return finish(next, command, 'skills-gap-learning-completed', command.workerId);
}

export function verifyWorkforceCoverage(state: SkillsGapState, command: CommandMeta) {
  assert(command.actor.role === 'Compliance Reviewer', 'Only compliance reviewers can verify workforce coverage.');
  const next = begin(state, command), plan = currentPlan(next);
  assert(plan.status === 'completed', 'Completed skills-gap plan is required.');
  assert(command.actor.id !== plan.manager && command.actor.id !== plan.analyst, 'Coverage verification must be independent.');
  const qualified = next.workers.filter((item) => item.level >= next.demand.requiredLevel).length;
  assert(qualified >= next.demand.requiredPeople, 'Qualified workforce remains below demand.');
  plan.status = 'verified';
  return finish(next, command, 'workforce-skill-coverage-verified', String(qualified));
}

export class SkillsGapRepository {
  static key = 'skillorbit:skills-gap-planning:v1';
  private storage: Pick<Storage, 'getItem' | 'setItem'>;
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage; }
  read() { const raw = this.storage.getItem(SkillsGapRepository.key); return raw ? JSON.parse(raw) as SkillsGapState : structuredClone(initialSkillsGapState); }
  commit(expectedRevision: number, operation: (state: SkillsGapState) => SkillsGapState) { const current = this.read(); assert(current.revision === expectedRevision, 'Another session changed skills-gap planning. Refresh before retrying.'); const next = operation(current); this.storage.setItem(SkillsGapRepository.key, JSON.stringify(next)); return next; }
}
