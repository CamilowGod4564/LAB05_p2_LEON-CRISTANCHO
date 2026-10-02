import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import blueprintsReducer from '../src/features/blueprints/blueprintsSlice.js'
import RealtimeBlueprintPage from '../src/pages/RealtimeBlueprintPage.jsx'

// Casos de prueba mínimos del LAB06 sobre la vista completa:
// estado inicial, dibujo local, RT multi-pestaña y CRUD que refresca lista y total.

const { service, resetDb, rtServer } = vi.hoisted(() => {
  let db = []
  const clone = (blueprint) => ({ ...blueprint, points: blueprint.points.map((p) => ({ ...p })) })
  const find = (author, name) => db.find((bp) => bp.author === author && bp.name === name)

  const service = {
    getAll: vi.fn(async () => db.map(clone)),
    getByAuthor: vi.fn(async (author) => db.filter((bp) => bp.author === author).map(clone)),
    getByAuthorAndName: vi.fn(async (author, name) => {
      const blueprint = find(author, name)
      return blueprint ? clone(blueprint) : null
    }),
    create: vi.fn(async (blueprint) => {
      db.push(clone(blueprint))
      return clone(blueprint)
    }),
    update: vi.fn(async (author, name, blueprint) => {
      Object.assign(find(author, name), clone(blueprint))
      return clone(blueprint)
    }),
    delete: vi.fn(async (author, name) => {
      db = db.filter((bp) => bp.author !== author || bp.name !== name)
      return { author, name }
    }),
  }

  const resetDb = () => {
    db = [
      {
        author: 'juan',
        name: 'plano-1',
        points: [
          { x: 10, y: 10 },
          { x: 40, y: 50 },
        ],
      },
      { author: 'juan', name: 'plano-2', points: [{ x: 1, y: 1 }] },
    ]
  }

  // Servidor Socket.IO en memoria con la semántica del backend guía:
  // socket.to(room).emit('blueprint-update', ...) → a los demás de la sala, no al emisor.
  const rooms = new Map()
  const rtServer = {
    rooms,
    transport: {
      connect({ room, onStatus, onUpdate }) {
        const client = { onUpdate }
        if (!rooms.has(room)) rooms.set(room, new Set())
        rooms.get(room).add(client)
        onStatus('connected')
        return {
          publish({ author, name, point }) {
            for (const other of rooms.get(room) || []) {
              if (other !== client) other.onUpdate({ author, name, points: [point] })
            }
            return true
          },
          disconnect() {
            rooms.get(room)?.delete(client)
          },
        }
      },
    },
  }

  return { service, resetDb, rtServer }
})

vi.mock('../src/services/blueprintsService.js', () => ({ default: service }))
vi.mock('../src/realtime/socketIoTransport.js', () => ({ default: rtServer.transport }))
vi.mock('../src/services/healthService.js', () => ({ checkAllServices: async () => [] }))

function renderTab() {
  const store = configureStore({ reducer: { blueprints: blueprintsReducer } })
  const { container } = render(
    <Provider store={store}>
      <RealtimeBlueprintPage />
    </Provider>,
  )
  return { container, ui: within(container), store }
}

async function loadBlueprint(tab, author, name) {
  fireEvent.change(tab.ui.getByPlaceholderText('e.g. juan'), { target: { value: author } })
  fireEvent.change(tab.ui.getByPlaceholderText(/e\.g\. plano-1/), { target: { value: name } })
  fireEvent.click(tab.ui.getByRole('button', { name: 'Load' }))
  await tab.ui.findByText(`${author} / ${name}`, { exact: false })
}

// jsdom no calcula layout: el canvas se "ve" a tamaño real (520×360) en (0, 0).
function clickCanvas(tab, x, y) {
  const canvas = tab.container.querySelector('#blueprint-canvas')
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 520, height: 360 })
  fireEvent.click(canvas, { clientX: x, clientY: y })
}

const pointCount = (tab) => tab.container.querySelector('.viewer-point-count').textContent
const total = (tab) => tab.ui.getByTestId('author-total-points').textContent

beforeEach(() => {
  resetDb()
  rtServer.rooms.clear()
})

describe('RealtimeBlueprintPage', () => {
  it('initial state: opening a blueprint loads its points from the API', async () => {
    const tab = renderTab()

    await loadBlueprint(tab, 'juan', 'plano-1')

    expect(service.getByAuthorAndName).toHaveBeenCalledWith('juan', 'plano-1')
    await waitFor(() => expect(pointCount(tab)).toBe('2 points'))
    expect(tab.ui.getByText('plano-2')).toBeInTheDocument()
    expect(total(tab)).toBe('3')
  })

  it('local drawing: clicking the canvas adds a point and redraws', async () => {
    const tab = renderTab()
    await loadBlueprint(tab, 'juan', 'plano-1')
    await waitFor(() => expect(pointCount(tab)).toBe('2 points'))

    clickCanvas(tab, 100, 120)

    expect(pointCount(tab)).toBe('3 points')
  })

  it('real time: points drawn in one tab appear in the other tab of the same blueprint only', async () => {
    const tabA = renderTab()
    const tabB = renderTab()
    const tabOther = renderTab()
    await loadBlueprint(tabA, 'juan', 'plano-1')
    await loadBlueprint(tabB, 'juan', 'plano-1')
    await loadBlueprint(tabOther, 'juan', 'plano-2')
    await waitFor(() => expect(pointCount(tabB)).toBe('2 points'))

    for (const tab of [tabA, tabB, tabOther]) {
      fireEvent.change(tab.ui.getByRole('combobox'), { target: { value: 'socketio' } })
      await tab.ui.findByText(/Connected/)
    }
    expect(tabA.ui.getByText('blueprints.juan.plano-1')).toBeInTheDocument()

    clickCanvas(tabA, 200, 100)
    expect(pointCount(tabA)).toBe('3 points') // sin duplicado por eco
    expect(pointCount(tabB)).toBe('3 points')

    clickCanvas(tabB, 300, 200)
    expect(pointCount(tabA)).toBe('4 points')
    expect(pointCount(tabB)).toBe('4 points')

    expect(pointCount(tabOther)).toBe('1 point') // aislamiento por plano
  })

  it('CRUD: Create, Save/Update and Delete refresh the list and the author total', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const tab = renderTab()

    // Create: un plano nuevo empieza como borrador.
    await loadBlueprint(tab, 'juan', 'plano-3')
    expect(tab.ui.getByText('Unsaved')).toBeInTheDocument()
    expect(tab.ui.getByRole('button', { name: 'Save/Update' })).toBeDisabled()
    clickCanvas(tab, 50, 50)
    clickCanvas(tab, 60, 70)
    fireEvent.click(tab.ui.getByRole('button', { name: 'Create' }))

    await tab.ui.findByText('Blueprint "plano-3" created.')
    expect(service.create).toHaveBeenCalledWith({
      author: 'juan',
      name: 'plano-3',
      points: [
        { x: 50, y: 50 },
        { x: 60, y: 70 },
      ],
    })
    await waitFor(() => expect(total(tab)).toBe('5'))
    expect(tab.ui.getByRole('cell', { name: 'plano-3' })).toBeInTheDocument()
    expect(tab.ui.queryByText('Unsaved')).not.toBeInTheDocument()

    // Save/Update
    clickCanvas(tab, 80, 90)
    fireEvent.click(tab.ui.getByRole('button', { name: 'Save/Update' }))
    await tab.ui.findByText('Blueprint "plano-3" saved.')
    expect(service.update).toHaveBeenCalledWith(
      'juan',
      'plano-3',
      expect.objectContaining({ points: expect.arrayContaining([{ x: 80, y: 90 }]) }),
    )
    await waitFor(() => expect(total(tab)).toBe('6'))

    // Delete
    fireEvent.click(tab.ui.getByRole('button', { name: 'Delete' }))
    await tab.ui.findByText('Blueprint "plano-3" deleted.')
    expect(service.delete).toHaveBeenCalledWith('juan', 'plano-3')
    await waitFor(() => expect(total(tab)).toBe('3'))
    expect(tab.ui.queryByRole('cell', { name: 'plano-3' })).not.toBeInTheDocument()
    expect(tab.ui.getByText('No blueprint selected')).toBeInTheDocument()
    confirm.mockRestore()
  })

  it('shows the error and keeps the draft when Create fails', async () => {
    service.create.mockRejectedValueOnce(new Error('Server unavailable'))
    const tab = renderTab()
    await loadBlueprint(tab, 'juan', 'plano-9')
    clickCanvas(tab, 10, 10)

    fireEvent.click(tab.ui.getByRole('button', { name: 'Create' }))

    expect(await tab.ui.findByRole('alert')).toHaveTextContent('Server unavailable')
    expect(tab.ui.getByText('Unsaved')).toBeInTheDocument()
    expect(pointCount(tab)).toBe('1 point')
  })
})
