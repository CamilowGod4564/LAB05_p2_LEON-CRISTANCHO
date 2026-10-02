import { useCallback, useEffect, useRef, useState } from 'react'
import { RT_TECHNOLOGIES, roomFor } from '../config.js'
import { rtLogger } from './logger.js'
import socketIoTransport from './socketIoTransport.js'
import stompTransport from './stompTransport.js'
import { validateBlueprintUpdate, validateDrawEvent, validateRoomTarget } from './validation.js'

const defaultTransports = {
  [RT_TECHNOLOGIES.SOCKET_IO]: socketIoTransport,
  [RT_TECHNOLOGIES.STOMP]: stompTransport,
}

// Conecta el plano abierto (author/name) a la tecnología RT elegida.
// Devuelve el estado de la conexión y publishPoint para enviar los clics locales.
// Todo lo que entra y sale se valida aquí, sea cual sea el transporte.
export default function useRealtimeBlueprint({
  technology,
  author,
  name,
  onRemoteUpdate,
  transports = defaultTransports,
  logger = rtLogger,
}) {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const connectionRef = useRef(null)
  const onRemoteUpdateRef = useRef(onRemoteUpdate)
  const room = author && name ? roomFor(author, name) : null

  useEffect(() => {
    onRemoteUpdateRef.current = onRemoteUpdate
  }, [onRemoteUpdate])

  useEffect(() => {
    setError(null)
    if (technology === RT_TECHNOLOGIES.NONE || !room) {
      setStatus('idle')
      return undefined
    }
    const transport = transports[technology]
    if (!transport) {
      setStatus('unsupported')
      return undefined
    }
    const target = validateRoomTarget(author, name)
    if (!target.ok) {
      setStatus('error')
      setError(`Real time is not available for this blueprint (${target.error})`)
      return undefined
    }

    setStatus('connecting')
    const connection = transport.connect({
      room,
      author,
      name,
      onStatus: (nextStatus, message = null) => {
        setStatus(nextStatus)
        setError(message)
      },
      onUpdate: (update) => {
        const result = validateBlueprintUpdate(update)
        if (!result.ok) {
          logger.warn(`Invalid update discarded on ${room}: ${result.error}`, update)
          return
        }
        // Aislamiento por plano: se ignoran actualizaciones de otro plano.
        if (result.data.author !== author || result.data.name !== name) return
        onRemoteUpdateRef.current?.(result.data)
      },
    })
    connectionRef.current = connection

    return () => {
      connection.disconnect()
      connectionRef.current = null
    }
  }, [technology, room, author, name, transports, logger])

  const publishPoint = useCallback(
    (point) => {
      const connection = connectionRef.current
      if (!connection) return false
      const result = validateDrawEvent({ author, name, point })
      if (!result.ok) {
        logger.warn(`Point not sent: ${result.error}`, point)
        return false
      }
      return connection.publish(result.data)
    },
    [author, name, logger],
  )

  return { status, error, room, publishPoint }
}
