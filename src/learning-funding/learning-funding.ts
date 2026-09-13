export type FundingRole =
  | 'Learning Partner'
  | 'Finance Analyst'
  | 'Department Manager'
  | 'Learning Admin';

export interface LearningFundingState {
  revision: number;
  costCenter: {
    id: string;
    annualBudget: number;
    committed: number;
    spent: number;
    version: number;
  };
  cohort: {
    id: string;
    version: number;
    status: 'open' | 'active' | 'delivered';
    seatCost: number;
    capacity: number;
    fundedSeats: number;
  };
  request: null | {
    id: string;
    status: 'draft' | 'validated' | 'approved' | 'committed' | 'reconciled' | 'cancelled';
    seats: number;
    estimatedCost: number;
    actualCost?: number;
    costCenterVersion: number;
    cohortVersion: number;
    owner: string;
    analyst?: string;
    approver?: string;
  };
  events: {
    id: string;
    action: string;
    actor: string;
    detail: string;
  }[];
}

export const initialLearningFundingState: LearningFundingState = {
  revision: 0,
  costCenter: {
    id: 'CC-DATA-04',
    annualBudget: 120000,
    committed: 24000,
    spent: 36000,
    version: 7,
  },
  cohort: {
    id: 'COHORT-DG-12',
    version: 5,
    status: 'open',
    seatCost: 4800,
    capacity: 12,
    fundedSeats: 2,
  },
  request: null,
  events: [],
};

interface CommandMeta {
  id: string;
  expectedRevision: number;
  actor: { id: string; role: FundingRole };
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function begin(state: LearningFundingState, command: CommandMeta) {
  assert(state.revision === command.expectedRevision, 'Learning funding changed. Refresh before retrying.');
  assert(!state.events.some((event) => event.id === command.id), 'Command already applied.');
  return structuredClone(state);
}

function finish(
  state: LearningFundingState,
  command: CommandMeta,
  action: string,
  detail: string,
) {
  state.revision += 1;
  state.events.push({ id: command.id, action, actor: command.actor.id, detail });
  return state;
}

function currentRequest(state: LearningFundingState) {
  assert(state.request, 'No learning funding request exists.');
  return state.request;
}

function assertEvidenceCurrent(state: LearningFundingState) {
  const request = currentRequest(state);
  assert(
    request.costCenterVersion === state.costCenter.version,
    'Cost-center budget changed after the funding request was created.',
  );
  assert(
    request.cohortVersion === state.cohort.version,
    'Cohort capacity changed after the funding request was created.',
  );
}

export function draftFundingRequest(
  state: LearningFundingState,
  command: CommandMeta & { seats: number },
) {
  assert(command.actor.role === 'Learning Partner', 'Only learning partners can draft funding requests.');
  const next = begin(state, command);
  assert(!next.request, 'An active learning funding request already exists.');
  assert(next.cohort.status === 'open', 'Only an open cohort can receive new funding.');
  assert(
    Number.isInteger(command.seats) && command.seats > 0,
    'Funded seats must be a positive whole number.',
  );
  assert(
    next.cohort.fundedSeats + command.seats <= next.cohort.capacity,
    'Requested seats exceed remaining cohort capacity.',
  );
  const estimatedCost = command.seats * next.cohort.seatCost;
  next.request = {
    id: `${command.id}-funding`,
    status: 'draft',
    seats: command.seats,
    estimatedCost,
    costCenterVersion: next.costCenter.version,
    cohortVersion: next.cohort.version,
    owner: command.actor.id,
  };
  return finish(next, command, 'learning-funding-drafted', String(estimatedCost));
}

export function validateBudget(state: LearningFundingState, command: CommandMeta) {
  assert(command.actor.role === 'Finance Analyst', 'Only finance analysts can validate learning budgets.');
  const next = begin(state, command);
  const request = currentRequest(next);
  assert(
    request.status === 'draft' && command.actor.id !== request.owner,
    'Independent budget validation is required.',
  );
  assertEvidenceCurrent(next);
  const available = next.costCenter.annualBudget - next.costCenter.committed - next.costCenter.spent;
  assert(request.estimatedCost <= available, 'Learning request exceeds available cost-center budget.');
  request.status = 'validated';
  request.analyst = command.actor.id;
  return finish(next, command, 'learning-budget-validated', String(available));
}

export function approveFunding(state: LearningFundingState, command: CommandMeta) {
  assert(command.actor.role === 'Department Manager', 'Only department managers can approve funding.');
  const next = begin(state, command);
  const request = currentRequest(next);
  assert(request.status === 'validated', 'Validated learning funding is required.');
  assert(
    command.actor.id !== request.owner && command.actor.id !== request.analyst,
    'Funding approval must be independent.',
  );
  assertEvidenceCurrent(next);
  assert(
    request.estimatedCost <= next.costCenter.annualBudget * 0.25,
    'Funding request exceeds manager approval authority.',
  );
  request.status = 'approved';
  request.approver = command.actor.id;
  return finish(next, command, 'learning-funding-approved', request.id);
}

export function commitCohortFunding(state: LearningFundingState, command: CommandMeta) {
  assert(command.actor.role === 'Learning Admin', 'Only learning administrators can commit cohort funding.');
  const next = begin(state, command);
  const request = currentRequest(next);
  assert(request.status === 'approved', 'Approved learning funding is required.');
  assertEvidenceCurrent(next);
  assert(
    next.cohort.fundedSeats + request.seats <= next.cohort.capacity,
    'Cohort capacity was consumed before funding commitment.',
  );
  next.costCenter.committed += request.estimatedCost;
  next.costCenter.version += 1;
  next.cohort.fundedSeats += request.seats;
  next.cohort.version += 1;
  request.costCenterVersion = next.costCenter.version;
  request.cohortVersion = next.cohort.version;
  request.status = 'committed';
  return finish(next, command, 'cohort-funding-committed', String(request.seats));
}

export function cancelFunding(state: LearningFundingState, command: CommandMeta) {
  assert(command.actor.role === 'Learning Admin', 'Only learning administrators can cancel funding.');
  const next = begin(state, command);
  const request = currentRequest(next);
  assert(request.status === 'committed', 'Committed learning funding is required.');
  assert(next.cohort.status === 'open', 'Funding cannot be cancelled after cohort delivery starts.');
  assertEvidenceCurrent(next);
  next.costCenter.committed -= request.estimatedCost;
  next.costCenter.version += 1;
  next.cohort.fundedSeats -= request.seats;
  next.cohort.version += 1;
  request.costCenterVersion = next.costCenter.version;
  request.cohortVersion = next.cohort.version;
  request.status = 'cancelled';
  return finish(next, command, 'cohort-funding-cancelled', String(request.estimatedCost));
}

export function reconcileFunding(
  state: LearningFundingState,
  command: CommandMeta & { actualCost: number },
) {
  assert(command.actor.role === 'Finance Analyst', 'Only finance analysts can reconcile funding.');
  const next = begin(state, command);
  const request = currentRequest(next);
  assert(request.status === 'committed', 'Committed learning funding is required.');
  assert(next.cohort.status === 'delivered', 'Delivered cohort is required for reconciliation.');
  assertEvidenceCurrent(next);
  assert(
    command.actualCost >= 0 && command.actualCost <= request.estimatedCost * 1.1,
    'Actual learning cost is outside reconciliation tolerance.',
  );
  next.costCenter.committed -= request.estimatedCost;
  next.costCenter.spent += command.actualCost;
  next.costCenter.version += 1;
  request.costCenterVersion = next.costCenter.version;
  request.actualCost = command.actualCost;
  request.status = 'reconciled';
  return finish(next, command, 'learning-funding-reconciled', String(command.actualCost));
}

export class LearningFundingRepository {
  static key = 'skillorbit:learning-funding:v1';
  private storage: Pick<Storage, 'getItem' | 'setItem'>;

  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) {
    this.storage = storage;
  }

  read() {
    const raw = this.storage.getItem(LearningFundingRepository.key);
    return raw
      ? JSON.parse(raw) as LearningFundingState
      : structuredClone(initialLearningFundingState);
  }

  commit(
    expectedRevision: number,
    operation: (state: LearningFundingState) => LearningFundingState,
  ) {
    const current = this.read();
    assert(
      current.revision === expectedRevision,
      'Another session changed learning funding. Refresh before retrying.',
    );
    const next = operation(current);
    this.storage.setItem(LearningFundingRepository.key, JSON.stringify(next));
    return next;
  }
}
