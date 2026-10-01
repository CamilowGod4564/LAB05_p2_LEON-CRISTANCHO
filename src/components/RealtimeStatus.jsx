const statusLabels = {
  idle: 'Off',
  connecting: 'Connecting...',
  connected: 'Connected',
  reconnecting: 'Reconnecting...',
  disconnected: 'Disconnected',
  error: 'Connection error',
  unsupported: 'Not available',
}

export default function RealtimeStatus({ technologyLabel, status = 'idle', room, error }) {
  if (status === 'idle') {
    return (
      <p className="rt-status" data-status="idle">
        Real time is off. Choose Socket.IO or STOMP to draw with other tabs.
      </p>
    )
  }

  return (
    <p className="rt-status" data-status={status} role="status">
      <span className="rt-dot" aria-hidden="true" />
      <strong>{technologyLabel}</strong> · {statusLabels[status] || status}
      {room && <code className="rt-room">{room}</code>}
      {error && <span className="rt-error">{error}</span>}
    </p>
  )
}
