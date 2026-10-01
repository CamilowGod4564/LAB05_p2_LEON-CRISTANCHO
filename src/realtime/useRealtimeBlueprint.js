import { useCallback, useEffect, useRef, useState } from 'react'
import { RT_TECHNOLOGIES, roomFor } from '../config.js'
import socketIoTransport from './socketIoTransport.js'

const defaultTransports = {
  [RT_TECHNOLOGIES.SOCKET_IO]: socketIoTransport,
}

// Conecta el plano abierto (author/name) a la tecnología RT elegida.
// Devuelve el estado de la conexión y publishPoint para enviar los clics locales.
export default function useRealtimeBlueprint({
  technology,
  author,
  name,
  onRemoteUpdate,
  transports = defaultTransports,
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
        // Aislamiento por plano: se ignoran actualizaciones de otro plano.
        if (update?.author !== author || update?.name !== name) return
        if (!Array.isArray(update.points)) return
        onRemoteUpdateRef.current?.(update)
      },
    })
    connectionRef.current = connection

    return () => {
      connection.disconnect()
      connectionRef.current = null
    }
  }, [technology, room, author, name, transports])

  const publishPoint = useCallback(
    (point) => connectionRef.current?.publish({ author, name, point }) ?? false,
    [author, name],
  )

  return { status, error, room, publishPoint }
}
