import { describe, expect, it } from 'vitest';
import { product } from '../../product/definition';
import { fresh } from '../../workspace/engine';
import { analyzePrerequisite } from './analytics';
import { canEditPrerequisite, prerequisiteStates } from './policy';
import { countPrerequisiteByState, searchPrerequisite, selectPrerequisite } from './selectors';
describe('prerequisite domain module', () => { const records = fresh(product).entities; it('selects only prerequisite records', () => expect(selectPrerequisite(records).every(record => record.kind === 'prerequisite')).toBe(true)); it('searches deterministic fields', () => { const first = selectPrerequisite(records)[0]; expect(first ? searchPrerequisite(records, first.title).map(row => row.id) : []).toEqual(first ? [first.id] : []); }); it('summarizes states', () => expect([...countPrerequisiteByState(records).values()].reduce((sum, value) => sum + value, 0)).toBe(selectPrerequisite(records).length)); it('exposes configured states', () => expect(prerequisiteStates(product).length).toBeGreaterThan(0)); it('reports analytics', () => expect(analyzePrerequisite(records).total).toBe(selectPrerequisite(records).length)); it('applies edit policy', () => expect(canEditPrerequisite(product, product.actors[0]!.role)).toBe(product.kinds.find(kind => kind.key === 'prerequisite')!.editors.includes(product.actors[0]!.role))); });
