import { describe, expect, it } from 'vitest';
import { product } from '../../product/definition';
import { fresh } from '../../workspace/engine';
import { analyzeAttempt } from './analytics';
import { canEditAttempt, attemptStates } from './policy';
import { countAttemptByState, searchAttempt, selectAttempt } from './selectors';
describe('attempt domain module', () => { const records = fresh(product).entities; it('selects only attempt records', () => expect(selectAttempt(records).every(record => record.kind === 'attempt')).toBe(true)); it('searches deterministic fields', () => { const first = selectAttempt(records)[0]; expect(first ? searchAttempt(records, first.title).map(row => row.id) : []).toEqual(first ? [first.id] : []); }); it('summarizes states', () => expect([...countAttemptByState(records).values()].reduce((sum, value) => sum + value, 0)).toBe(selectAttempt(records).length)); it('exposes configured states', () => expect(attemptStates(product).length).toBeGreaterThan(0)); it('reports analytics', () => expect(analyzeAttempt(records).total).toBe(selectAttempt(records).length)); it('applies edit policy', () => expect(canEditAttempt(product, product.actors[0]!.role)).toBe(product.kinds.find(kind => kind.key === 'attempt')!.editors.includes(product.actors[0]!.role))); });
