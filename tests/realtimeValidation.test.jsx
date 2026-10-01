import { describe, it, expect, vi } from 'vitest'
import { renderHook, render, screen, fireEvent, waitFor } from '@testing-library/react'
import {
  validateBlueprintUpdate,
  validateDrawEvent,
  validateRoomTarget,
} from '../src/realtime/validation.js'
import useRealtimeBlueprint from '../src/realtime/useRealtimeBlueprint.js'
import { checkService } from '../src/services/healthService.js'
import HealthPanel from '../src/components/HealthPanel.jsx'

describe('real-time payload validation', () => {
  it('accepts valid draw events and updates', () => {
    expect(validateDrawEvent({ author: 'juan', name: 'plano-1', point: { x: 10, y: 20 } }).ok).toBe(
      true,
    )
    expect(
      validateBlueprintUpdate({ author: 'juan', name: 'plano_1', points: [{ x: 0, y: 0 }] }).ok,
    ).toBe(true)
  })

  it('rejects malformed points and payloads', () => {
    expect(validateDrawEvent({ author: 'juan', name: 'p', point: { x: '10', y: 2 } }).ok).toBe(
      false,
    )
    expect(validateDrawEvent({ author: 'juan', name: 'p', point: { x: -1, y: 2 } }).ok).toBe(false)
    expect(validateDrawEvent({ author: 'juan', name: 'p', point: { x: 1.5, y: 2 } }).ok).toBe(false)
    expect(validateBlueprintUpdate({ author: 'juan', name: 'p', points: [] }).ok).toBe(false)
    expect(validateBlueprintUpdate(null).ok).toBe(false)
  })

  it('rejects author/name with dots so two blueprints never share a room', () => {
    const result = validateRoomTarget('a.b', 'c')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/author/)
    expect(validateRoomTarget('juan', 'plano-1').ok).toBe(true)
  })
})

describe('useRealtimeBlueprint validation', () => {
  const logger = { info: vi.fn(), warn: vi.fn() }

  function setup(props) {
    const connection = { publish: vi.fn(() => true), disconnect: vi.fn() }
    const transport = { connect: vi.fn(() => connection) }
    const transports = { socketio: transport }
    const onRemoteUpdate = vi.fn()
    const hook = renderHook(() =>
      useRealtimeBlueprint({
        technology: 'socketio',
        author: 'juan',
        name: 'plano-1',
        onRemoteUpdate,
        transports,
        logger,
        ...props,
      }),
    )
    return { ...hook, transport, connection, onRemoteUpdate }
  }

  it('does not connect when the room name is unsafe', () => {
    const { result, transport } = setup({ author: 'a.b', name: 'c' })

    expect(transport.connect).not.toHaveBeenCalled()
    expect(result.current.status).toBe('error')
    expect(result.current.error).toMatch(/not available/)
  })

  it('discards invalid incoming updates and does not publish invalid points', () => {
    const { result, transport, connection, onRemoteUpdate } = setup()
    const { onUpdate } = transport.connect.mock.calls[0][0]

    onUpdate({ author: 'juan', name: 'plano-1', points: [{ x: 'bad', y: 1 }] })
    expect(onRemoteUpdate).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalled()

    expect(result.current.publishPoint({ x: -5, y: 1 })).toBe(false)
    expect(connection.publish).not.toHaveBeenCalled()
  })
})

describe('health check', () => {
  const target = { id: 'rest', label: 'REST API', url: 'http://api.test/api/blueprints' }

  it('reports a reachable service as up with its latency', async () => {
    let time = 100
    const fetchImpl = vi.fn(async () => {
      time = 142
      return {}
    })

    const result = await checkService(target, { fetchImpl, now: () => time })

    expect(fetchImpl).toHaveBeenCalledWith(target.url, expect.objectContaining({ mode: 'no-cors' }))
    expect(result).toMatchObject({ id: 'rest', status: 'up', latencyMs: 42, error: null })
  })

  it('reports an unreachable service as down', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })

    const result = await checkService(target, { fetchImpl })

    expect(result).toMatchObject({ status: 'down', latencyMs: null, error: 'Unreachable' })
  })

  it('renders the results and re-runs the check on demand', async () => {
    const check = vi.fn(async () => [
      { ...target, status: 'up', latencyMs: 12, error: null },
      {
        id: 'socketio',
        label: 'Socket.IO',
        url: 'x',
        status: 'down',
        latencyMs: null,
        error: 'Unreachable',
      },
    ])
    render(<HealthPanel check={check} />)

    expect(await screen.findByText(/Up · 12 ms/)).toBeInTheDocument()
    expect(screen.getByText(/Down · Unreachable/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /check again/i }))
    await waitFor(() => expect(check).toHaveBeenCalledTimes(2))
  })
})
