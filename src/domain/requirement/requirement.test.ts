import { describe, expect, it } from 'vitest';
import { product } from '../../product/definition';
import { fresh } from '../../workspace/engine';
import { analyzeRequirement } from './analytics';
import { canEditRequirement, requirementStates } from './policy';
import { countRequirementByState, searchRequirement, selectRequirement } from './selectors';
describe('requirement domain module', () => { const records = fresh(product).entities; it('selects only requirement records', () => expect(selectRequirement(records).every(record => record.kind === 'requirement')).toBe(true)); it('searches deterministic fields', () => { const first = selectRequirement(records)[0]; expect(first ? searchRequirement(records, first.title).map(row => row.id) : []).toEqual(first ? [first.id] : []); }); it('summarizes states', () => expect([...countRequirementByState(records).values()].reduce((sum, value) => sum + value, 0)).toBe(selectRequirement(records).length)); it('exposes configured states', () => expect(requirementStates(product).length).toBeGreaterThan(0)); it('reports analytics', () => expect(analyzeRequirement(records).total).toBe(selectRequirement(records).length)); it('applies edit policy', () => expect(canEditRequirement(product, product.actors[0]!.role)).toBe(product.kinds.find(kind => kind.key === 'requirement')!.editors.includes(product.actors[0]!.role))); });
