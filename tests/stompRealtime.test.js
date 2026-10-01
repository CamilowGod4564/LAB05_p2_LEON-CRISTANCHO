import { describe, it, expect, vi } from 'vitest'
import { createStompTransport, toBrokerUrl } from '../src/realtime/stompTransport.js'

const silentLogger = { info: vi.fn(), warn: vi.fn() }

function createFakeClientClass() {
  const instances = []
  class FakeClient {
    constructor(config) {
      this.config = config
      this.connected = false
      this.subscriptions = {}
      this.publish = vi.fn()
      this.activate = vi.fn()
      this.deactivate = vi.fn()
      instances.push(this)
    }

    subscribe(destination, handler) {
      this.subscriptions[destination] = handler
    }

    // Helpers de prueba
    simulateConnect() {
      this.connected = true
      this.onConnect?.()
    }

    deliver(destination, payload) {
      this.subscriptions[destination]({ body: JSON.stringify(payload) })
    }
  }
  return { FakeClient, instances }
}

function connect(overrides = {}) {
  const { FakeClient, instances } = createFakeClientClass()
  const onStatus = vi.fn()
  const onUpdate = vi.fn()
  const transport = createStompTransport({
    brokerURL: 'ws://rt.test/ws-blueprints',
    ClientClass: FakeClient,
    logger: silentLogger,
    ...overrides,
  })
  const connection = transport.connect({ room: 'blueprints.juan.plano-1', onStatus, onUpdate })
  return { client: instances[0], connection, onStatus, onUpdate }
}

describe('STOMP transport', () => {
  it('builds the native WebSocket broker URL from the HTTP base', () => {
    expect(toBrokerUrl('http://localhost:8080', '/ws-blueprints')).toBe(
      'ws://localhost:8080/ws-blueprints',
    )
    expect(toBrokerUrl('https://rt.example.com', '/ws-blueprints')).toBe(
      'wss://rt.example.com/ws-blueprints',
    )
  })

  it('activates the client and subscribes to the blueprint topic on connect', () => {
    const { client, onStatus } = connect()

    expect(client.config.brokerURL).toBe('ws://rt.test/ws-blueprints')
    expect(client.activate).toHaveBeenCalled()
    client.simulateConnect()

    expect(client.subscriptions['/topic/blueprints.juan.plano-1']).toBeTypeOf('function')
    expect(onStatus).toHaveBeenLastCalledWith('connected')
  })

  it('publishes to /app/draw and ignores its own echo from the topic', () => {
    const { client, connection, onUpdate } = connect()
    const topic = '/topic/blueprints.juan.plano-1'

    expect(connection.publish({ author: 'juan', name: 'plano-1', point: { x: 1, y: 2 } })).toBe(
      false,
    )
    client.simulateConnect()
    connection.publish({ author: 'juan', name: 'plano-1', point: { x: 1, y: 2 } })

    expect(client.publish).toHaveBeenCalledWith({
      destination: '/app/draw',
      body: JSON.stringify({ author: 'juan', name: 'plano-1', point: { x: 1, y: 2 } }),
    })

    // Eco del propio punto: se descarta.
    client.deliver(topic, { author: 'juan', name: 'plano-1', points: [{ x: 1, y: 2 }] })
    expect(onUpdate).not.toHaveBeenCalled()

    // Punto de otro cliente (aunque tenga las mismas coordenadas, ya no hay eco pendiente).
    client.deliver(topic, { author: 'juan', name: 'plano-1', points: [{ x: 1, y: 2 }] })
    expect(onUpdate).toHaveBeenCalledWith({
      author: 'juan',
      name: 'plano-1',
      points: [{ x: 1, y: 2 }],
    })
  })

  it('ignores malformed messages and reports broker errors', () => {
    const { client, onUpdate, onStatus } = connect()
    client.simulateConnect()

    client.subscriptions['/topic/blueprints.juan.plano-1']({ body: 'not json' })
    expect(onUpdate).not.toHaveBeenCalled()

    client.onStompError({ headers: { message: 'Access denied' } })
    expect(onStatus).toHaveBeenLastCalledWith('error', 'Access denied')
  })

  it('deactivates the client and stops reporting status after disconnect', () => {
    const { client, connection, onStatus } = connect()
    connection.disconnect()
    client.onWebSocketClose()

    expect(client.deactivate).toHaveBeenCalled()
    expect(onStatus).not.toHaveBeenCalled()
  })
})
