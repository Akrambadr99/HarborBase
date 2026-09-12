import { describe, expect, it } from 'vitest';
import { product } from '../../product/definition';
import { fresh } from '../../workspace/engine';
import { analyzeAward } from './analytics';
import { canEditAward, awardStates } from './policy';
import { countAwardByState, searchAward, selectAward } from './selectors';
describe('award domain module', () => { const records = fresh(product).entities; it('selects only award records', () => expect(selectAward(records).every(record => record.kind === 'award')).toBe(true)); it('searches deterministic fields', () => { const first = selectAward(records)[0]; expect(first ? searchAward(records, first.title).map(row => row.id) : []).toEqual(first ? [first.id] : []); }); it('summarizes states', () => expect([...countAwardByState(records).values()].reduce((sum, value) => sum + value, 0)).toBe(selectAward(records).length)); it('exposes configured states', () => expect(awardStates(product).length).toBeGreaterThan(0)); it('reports analytics', () => expect(analyzeAward(records).total).toBe(selectAward(records).length)); it('applies edit policy', () => expect(canEditAward(product, product.actors[0]!.role)).toBe(product.kinds.find(kind => kind.key === 'award')!.editors.includes(product.actors[0]!.role))); });
