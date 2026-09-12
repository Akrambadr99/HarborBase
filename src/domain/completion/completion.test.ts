import { describe, expect, it } from 'vitest';
import { product } from '../../product/definition';
import { fresh } from '../../workspace/engine';
import { analyzeCompletion } from './analytics';
import { canEditCompletion, completionStates } from './policy';
import { countCompletionByState, searchCompletion, selectCompletion } from './selectors';
describe('completion domain module', () => { const records = fresh(product).entities; it('selects only completion records', () => expect(selectCompletion(records).every(record => record.kind === 'completion')).toBe(true)); it('searches deterministic fields', () => { const first = selectCompletion(records)[0]; expect(first ? searchCompletion(records, first.title).map(row => row.id) : []).toEqual(first ? [first.id] : []); }); it('summarizes states', () => expect([...countCompletionByState(records).values()].reduce((sum, value) => sum + value, 0)).toBe(selectCompletion(records).length)); it('exposes configured states', () => expect(completionStates(product).length).toBeGreaterThan(0)); it('reports analytics', () => expect(analyzeCompletion(records).total).toBe(selectCompletion(records).length)); it('applies edit policy', () => expect(canEditCompletion(product, product.actors[0]!.role)).toBe(product.kinds.find(kind => kind.key === 'completion')!.editors.includes(product.actors[0]!.role))); });
