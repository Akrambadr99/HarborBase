import { describe, expect, it } from 'vitest';
import { product } from '../../product/definition';
import { fresh } from '../../workspace/engine';
import { analyzeCourse } from './analytics';
import { canEditCourse, courseStates } from './policy';
import { countCourseByState, searchCourse, selectCourse } from './selectors';
describe('course domain module', () => { const records = fresh(product).entities; it('selects only course records', () => expect(selectCourse(records).every(record => record.kind === 'course')).toBe(true)); it('searches deterministic fields', () => { const first = selectCourse(records)[0]; expect(first ? searchCourse(records, first.title).map(row => row.id) : []).toEqual(first ? [first.id] : []); }); it('summarizes states', () => expect([...countCourseByState(records).values()].reduce((sum, value) => sum + value, 0)).toBe(selectCourse(records).length)); it('exposes configured states', () => expect(courseStates(product).length).toBeGreaterThan(0)); it('reports analytics', () => expect(analyzeCourse(records).total).toBe(selectCourse(records).length)); it('applies edit policy', () => expect(canEditCourse(product, product.actors[0]!.role)).toBe(product.kinds.find(kind => kind.key === 'course')!.editors.includes(product.actors[0]!.role))); });
