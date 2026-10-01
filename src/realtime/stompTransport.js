import { Client } from '@stomp/stompjs'
import { STOMP_BASE, STOMP_PATH } from '../config.js'
import { rtLogger } from './logger.js'

// Protocolo del backend guía (Spring, WebSocket nativo sin SockJS):
//   cliente → servidor: SEND /app/draw { author, name, point }
//   servidor → TODOS los suscritos (incluido el emisor):
//     /topic/blueprints.{author}.{name} { author, name, points: [point] }
// Como el emisor recibe su propio eco, se descartan los puntos que este cliente envió.
const MAX_PENDING_ECHOES = 200

export function toBrokerUrl(base = STOMP_BASE, path = STOMP_PATH) {
  return `${base.replace(/^http/, 'ws')}${path}`
}

const pointKey = (point) => `${point?.x},${point?.y}`

export function createStompTransport({
  brokerURL = toBrokerUrl(),
  ClientClass = Client,
  logger = rtLogger,
} = {}) {
  return {
    name: 'STOMP',

    connect({ room, onStatus, onUpdate }) {
      const topic = `/topic/${room}`
      let pendingEchoes = []
      let closed = false
      const notify = (...args) => !closed && onStatus(...args)

      const client = new ClientClass({
        brokerURL,
        reconnectDelay: 3000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
      })

      const handleMessage = (message) => {
        let update
        try {
          update = JSON.parse(message.body)
        } catch {
          logger.warn(`Invalid STOMP message on ${topic}`, message.body)
          return
        }
        const points = Array.isArray(update?.points) ? update.points : []
        const remotePoints = points.filter((point) => {
          const index = pendingEchoes.indexOf(pointKey(point))
          if (index < 0) return true
          pendingEchoes.splice(index, 1)
          return false
        })
        if (!remotePoints.length) return
        logger.info(`STOMP update received on ${topic}`, remotePoints)
        onUpdate({ ...update, points: remotePoints })
      }

      client.onConnect = () => {
        pendingEchoes = []
        client.subscribe(topic, handleMessage)
        logger.info(`STOMP connected to ${brokerURL}, subscribed to ${topic}`)
        notify('connected')
      }
      client.onWebSocketClose = () => {
        logger.info('STOMP connection closed, retrying...')
        notify('reconnecting', `Cannot reach ${brokerURL}`)
      }
      client.onStompError = (frame) => {
        const message = frame.headers?.message || 'STOMP broker error'
        logger.warn(`STOMP error: ${message}`)
        notify('error', message)
      }

      client.activate()

      return {
        publish({ author, name, point }) {
          if (!client.connected) {
            logger.warn('/app/draw not sent: STOMP is not connected')
            return false
          }
          pendingEchoes.push(pointKey(point))
          if (pendingEchoes.length > MAX_PENDING_ECHOES) pendingEchoes.shift()
          client.publish({ destination: '/app/draw', body: JSON.stringify({ author, name, point }) })
          logger.info('STOMP /app/draw sent', point)
          return true
        },
        disconnect() {
          closed = true
          client.deactivate()
        },
      }
    },
  }
}

export default createStompTransport()
