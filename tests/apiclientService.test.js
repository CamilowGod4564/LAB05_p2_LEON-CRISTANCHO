import { beforeEach, describe, it, expect, vi } from 'vitest'
import api from '../src/services/apiClient.js'
import apiclient from '../src/services/apiclientService.js'

vi.mock('../src/services/apiClient.js', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('apiclient service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('unwraps the response envelope for getAll', async () => {
    const blueprints = [{ author: 'john', name: 'house', points: [] }]
    api.get.mockResolvedValue({ data: { code: 200, message: 'Success', data: blueprints } })

    await expect(apiclient.getAll()).resolves.toEqual(blueprints)
    expect(api.get).toHaveBeenCalledWith('/blueprints')
  })

  it('lists by author with the ?author= query and treats 404 as an empty list', async () => {
    const blueprints = [{ author: 'john doe', name: 'house', points: [] }]
    api.get.mockResolvedValueOnce({ data: blueprints })
    await expect(apiclient.getByAuthor('john doe')).resolves.toEqual(blueprints)
    expect(api.get).toHaveBeenLastCalledWith('/blueprints', { params: { author: 'john doe' } })

    api.get.mockRejectedValueOnce({ response: { status: 404 } })
    await expect(apiclient.getByAuthor('unknown')).resolves.toEqual([])
  })

  it('gets one blueprint and creates a blueprint through Axios', async () => {
    const blueprint = { author: 'john', name: 'house', points: [{ x: 1, y: 2 }] }
    api.get.mockResolvedValueOnce({ data: { data: blueprint } })
    await expect(apiclient.getByAuthorAndName('john', 'house')).resolves.toEqual(blueprint)
    expect(api.get).toHaveBeenLastCalledWith('/blueprints/john/house')

    api.post.mockResolvedValueOnce({ data: { data: blueprint } })
    await expect(apiclient.create(blueprint)).resolves.toEqual(blueprint)
    expect(api.post).toHaveBeenCalledWith('/blueprints', blueprint)
  })

  it('updates and deletes using /blueprints/:author/:name', async () => {
    const blueprint = { author: 'john', name: 'my house', points: [{ x: 3, y: 4 }] }
    api.put.mockResolvedValueOnce({ data: '' })
    await expect(apiclient.update('john', 'my house', blueprint)).resolves.toEqual(blueprint)
    expect(api.put).toHaveBeenCalledWith('/blueprints/john/my%20house', blueprint)

    api.delete.mockResolvedValueOnce({ data: '' })
    await expect(apiclient.delete('john', 'my house')).resolves.toEqual({
      author: 'john',
      name: 'my house',
    })
    expect(api.delete).toHaveBeenCalledWith('/blueprints/john/my%20house')
  })
})
