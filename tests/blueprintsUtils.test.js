import { describe, it, expect } from 'vitest'
import { countPoints, totalPoints } from '../src/utils/blueprints.js'

describe('blueprint utils', () => {
  it('counts points from the points array or from a count field', () => {
    expect(countPoints({ points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] })).toBe(2)
    expect(countPoints({ totalPoints: 7 })).toBe(7)
    expect(countPoints({ pointsCount: 3 })).toBe(3)
    expect(countPoints({})).toBe(0)
    expect(countPoints(null)).toBe(0)
  })

  it('adds the points of every blueprint of an author with reduce', () => {
    const blueprints = [
      { name: 'a', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
      { name: 'b', totalPoints: 4 },
      { name: 'c', points: [] },
    ]
    expect(totalPoints(blueprints)).toBe(6)
    expect(totalPoints()).toBe(0)
  })
})
