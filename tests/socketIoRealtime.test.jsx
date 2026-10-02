import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { createSocketIoTransport } from '../src/realtime/socketIoTransport.js'
import useRealtimeBlueprint from '../src/realtime/useRealtimeBlueprint.js'
import reducer, { draftStarted, pointsAppended } from '../src/features/blueprints/blueprintsSlice.js'

const silentLogger = { info: vi.fn(), warn: vi.fn() }

function createFakeSocket() {
  const handlers = {}
  const managerHandlers = {}
  return {
    id: 'socket-1',
    connected: false,
    emit: vi.fn(),
    on: vi.fn((event, handler) => {
      handlers[event] = handler
    }),
    removeAllListeners: vi.fn(),
    disconnect: vi.fn(),
    io: {
      on: vi.fn((event, handler) => {
        managerHandlers[event] = handler
      }),
      off: vi.fn(),
    },
    trigger(event, payload) {
      if (event === 'connect') this.connected = true
      handlers[event]?.(payload)
    },
  }
}

describe('Socket.IO transport', () => {
  it('connects with websocket transport and joins the blueprint room on connect', () => {
    const socket = createFakeSocket()
    const ioFactory = vi.fn(() => socket)
    const onStatus = vi.fn()
    const transport = createSocketIoTransport({
      url: 'http://rt.test',
      ioFactory,
      logger: silentLogger,
    })

    transport.connect({ room: 'blueprints.juan.plano-1', onStatus, onUpdate: vi.fn() })
    socket.trigger('connect')

    expect(ioFactory).toHaveBeenCalledWith('http://rt.test', { transports: ['websocket'] })
    expect(socket.emit).toHaveBeenCalledWith('join-room', 'blueprints.juan.plano-1')
    expect(onStatus).toHaveBeenLastCalledWith('connected')
  })

  it('emits draw-event with the room payload and forwards blueprint-update', () => {
    const socket = createFakeSocket()
    const onUpdate = vi.fn()
    const transport = createSocketIoTransport({ ioFactory: () => socket, logger: silentLogger })
    const connection = transport.connect({
      room: 'blueprints.juan.plano-1',
      onStatus: vi.fn(),
      onUpdate,
    })

    expect(connection.publish({ author: 'juan', name: 'plano-1', point: { x: 1, y: 2 } })).toBe(
      false,
    )
    socket.trigger('connect')
    connection.publish({ author: 'juan', name: 'plano-1', point: { x: 1, y: 2 } })
    expect(socket.emit).toHaveBeenLastCalledWith('draw-event', {
      room: 'blueprints.juan.plano-1',
      author: 'juan',
      name: 'plano-1',
      point: { x: 1, y: 2 },
    })

    const update = { author: 'juan', name: 'plano-1', points: [{ x: 3, y: 4 }] }
    socket.trigger('blueprint-update', update)
    expect(onUpdate).toHaveBeenCalledWith(update)

    connection.disconnect()
    expect(socket.disconnect).toHaveBeenCalled()
    expect(socket.io.off).toHaveBeenCalledWith('reconnect_attempt', expect.any(Function))
  })
})

describe('useRealtimeBlueprint', () => {
  function createFakeTransport() {
    const connection = { publish: vi.fn(() => true), disconnect: vi.fn() }
    const transport = { connect: vi.fn(() => connection) }
    return { transport, connection }
  }

  it('stays idle when real time is off', () => {
    const { transport } = createFakeTransport()
    const { result } = renderHook(() =>
      useRealtimeBlueprint({
        technology: 'none',
        author: 'juan',
        name: 'plano-1',
        transports: { socketio: transport },
      }),
    )

    expect(result.current.status).toBe('idle')
    expect(transport.connect).not.toHaveBeenCalled()
  })

  it('connects to the blueprint room, publishes points and ignores other blueprints', () => {
    const { transport, connection } = createFakeTransport()
    const transports = { socketio: transport }
    const onRemoteUpdate = vi.fn()
    const { result } = renderHook(() =>
      useRealtimeBlueprint({
        technology: 'socketio',
        author: 'juan',
        name: 'plano-1',
        onRemoteUpdate,
        transports,
      }),
    )

    const { room, onStatus, onUpdate } = transport.connect.mock.calls[0][0]
    expect(room).toBe('blueprints.juan.plano-1')
    act(() => onStatus('connected'))
    expect(result.current.status).toBe('connected')

    result.current.publishPoint({ x: 7, y: 8 })
    expect(connection.publish).toHaveBeenCalledWith({
      author: 'juan',
      name: 'plano-1',
      point: { x: 7, y: 8 },
    })

    onUpdate({ author: 'ana', name: 'otro', points: [{ x: 1, y: 1 }] })
    onUpdate({ author: 'juan', name: 'plano-1', points: [{ x: 2, y: 2 }] })
    expect(onRemoteUpdate).toHaveBeenCalledTimes(1)
    expect(onRemoteUpdate).toHaveBeenCalledWith({
      author: 'juan',
      name: 'plano-1',
      points: [{ x: 2, y: 2 }],
    })
  })

  it('disconnects when the open blueprint changes', () => {
    const { transport, connection } = createFakeTransport()
    const transports = { socketio: transport }
    const { rerender } = renderHook((props) => useRealtimeBlueprint({ ...props, transports }), {
      initialProps: { technology: 'socketio', author: 'juan', name: 'plano-1' },
    })

    rerender({ technology: 'socketio', author: 'juan', name: 'plano-2' })

    expect(connection.disconnect).toHaveBeenCalledTimes(1)
    expect(transport.connect).toHaveBeenCalledTimes(2)
    expect(transport.connect.mock.calls[1][0].room).toBe('blueprints.juan.plano-2')
  })
})

describe('pointsAppended reducer', () => {
  it('appends remote points to the open blueprint only', () => {
    let state = reducer(undefined, draftStarted({ author: 'juan', name: 'plano-1' }))
    state = reducer(
      state,
      pointsAppended({ author: 'juan', name: 'plano-1', points: [{ x: 1, y: 2 }] }),
    )
    state = reducer(
      state,
      pointsAppended({ author: 'ana', name: 'otro', points: [{ x: 9, y: 9 }] }),
    )

    expect(state.current.points).toEqual([{ x: 1, y: 2 }])
  })
})
