import { io } from 'socket.io-client'
import { IO_BASE } from '../config.js'
import { rtLogger } from './logger.js'

// Protocolo del backend guía (Node):
//   cliente → servidor: 'join-room' (room), 'draw-event' { room, author, name, point }
//   servidor → otros clientes de la sala: 'blueprint-update' { author, name, points: [point] }
// Se abre una conexión por plano: al desconectar, el servidor saca el socket de la sala.
export function createSocketIoTransport({ url = IO_BASE, ioFactory = io, logger = rtLogger } = {}) {
  return {
    name: 'Socket.IO',

    connect({ room, onStatus, onUpdate }) {
      const socket = ioFactory(url, { transports: ['websocket'] })

      // El servidor olvida las salas al caerse el socket: se vuelve a unir en cada conexión.
      socket.on('connect', () => {
        socket.emit('join-room', room)
        logger.info(`Socket.IO connected (${socket.id}), joined ${room}`)
        onStatus('connected')
      })
      socket.on('disconnect', (reason) => {
        logger.info(`Socket.IO disconnected: ${reason}`)
        onStatus('disconnected')
      })
      socket.on('connect_error', (error) => {
        logger.warn(`Socket.IO connection error: ${error.message}`)
        onStatus('error', error.message)
      })
      const handleReconnectAttempt = (attempt) => {
        logger.info(`Socket.IO reconnect attempt #${attempt}`)
        onStatus('reconnecting')
      }
      socket.io?.on('reconnect_attempt', handleReconnectAttempt)
      socket.on('blueprint-update', (update) => {
        logger.info(`blueprint-update received on ${room}`, update)
        onUpdate(update)
      })

      return {
        publish({ author, name, point }) {
          if (!socket.connected) {
            logger.warn('draw-event not sent: socket is not connected')
            return false
          }
          socket.emit('draw-event', { room, author, name, point })
          logger.info(`draw-event sent to ${room}`, point)
          return true
        },
        disconnect() {
          socket.io?.off('reconnect_attempt', handleReconnectAttempt)
          socket.removeAllListeners()
          socket.disconnect()
        },
      }
    },
  }
}

export default createSocketIoTransport()
