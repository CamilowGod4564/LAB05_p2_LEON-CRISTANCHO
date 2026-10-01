import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import reducer, {
  createBlueprint,
  draftStarted,
  pointAdded,
} from '../src/features/blueprints/blueprintsSlice.js'
import BlueprintCanvas from '../src/components/BlueprintCanvas.jsx'
import BlueprintActionBar from '../src/components/BlueprintActionBar.jsx'

describe('collaborative drawing state', () => {
  it('starts an unsaved draft and appends points only to the open blueprint', () => {
    let state = reducer(undefined, draftStarted({ author: 'juan', name: 'plano-9' }))
    expect(state.current).toEqual({ author: 'juan', name: 'plano-9', points: [], isNew: true })

    state = reducer(state, pointAdded({ author: 'juan', name: 'plano-9', point: { x: 5, y: 6 } }))
    state = reducer(state, pointAdded({ author: 'ana', name: 'otro', point: { x: 1, y: 1 } }))

    expect(state.current.points).toEqual([{ x: 5, y: 6 }])
  })

  it('clears the draft flag once the blueprint is created', () => {
    let state = reducer(undefined, draftStarted({ author: 'juan', name: 'plano-9' }))
    const created = { author: 'juan', name: 'plano-9', points: [{ x: 5, y: 6 }] }
    state = reducer(state, createBlueprint.fulfilled(created, 'req-1', created))

    expect(state.current).toEqual(created)
    expect(state.byAuthor.juan).toEqual([created])
  })
})

describe('BlueprintCanvas in pixel mode', () => {
  it('reports the clicked point in canvas pixels', () => {
    const onPointAdd = vi.fn()
    const { container } = render(
      <BlueprintCanvas interactive coordinates="pixels" onPointAdd={onPointAdd} />,
    )
    const canvas = container.querySelector('#blueprint-canvas')
    // jsdom no calcula layout: simulamos que el canvas se ve a la mitad de su tamaño.
    canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: 260, height: 180 })

    fireEvent.click(canvas, { clientX: 60, clientY: 70 })

    expect(onPointAdd).toHaveBeenCalledWith({ x: 100, y: 100 })
  })

  it('draws stored pixel points without rescaling them', () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
    render(
      <BlueprintCanvas
        coordinates="pixels"
        points={[
          { x: 10, y: 10 },
          { x: 40, y: 50 },
        ]}
      />,
    )
    const context = getContext.mock.results.at(-1).value

    expect(context.moveTo).toHaveBeenLastCalledWith(10, 10)
    expect(context.lineTo).toHaveBeenLastCalledWith(40, 50)
  })
})

describe('BlueprintActionBar', () => {
  it('enables the actions it is allowed to run and calls their handlers', () => {
    const onCreate = vi.fn()
    const onSave = vi.fn()
    render(<BlueprintActionBar canCreate onCreate={onCreate} onSave={onSave} />)

    expect(screen.getByRole('button', { name: 'Save/Update' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(onCreate).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('offers None / Socket.IO / STOMP and reports the selected technology', () => {
    const onTechnologyChange = vi.fn()
    render(<BlueprintActionBar onTechnologyChange={onTechnologyChange} />)
    const select = screen.getByRole('combobox')

    expect([...select.options].map((option) => option.text)).toEqual([
      'None',
      'Socket.IO',
      'STOMP',
    ])
    fireEvent.change(select, { target: { value: 'socketio' } })
    expect(onTechnologyChange).toHaveBeenCalledWith('socketio')
  })
})
