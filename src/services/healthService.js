import { API_BASE, IO_BASE, STOMP_BASE, STOMP_PATH } from '../config.js'

const DEFAULT_TIMEOUT_MS = 4000

// Servicios que usa el front. Se comprueba que el servidor responda (alcanzable)
// y cuánto tarda, sin depender de CORS: `no-cors` resuelve si hay respuesta HTTP
// y solo falla si el servidor no está o no contesta a tiempo.
export const healthTargets = [
  { id: 'rest', label: 'REST API', url: `${API_BASE}/api/blueprints` },
  { id: 'socketio', label: 'Socket.IO', url: `${IO_BASE}/socket.io/?EIO=4&transport=polling` },
  { id: 'stomp', label: 'STOMP', url: `${STOMP_BASE}${STOMP_PATH}` },
]

export async function checkService(
  target,
  {
    fetchImpl = globalThis.fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    now = () => performance.now(),
  } = {},
) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = now()
  try {
    await fetchImpl(target.url, { mode: 'no-cors', cache: 'no-store', signal: controller.signal })
    return { ...target, status: 'up', latencyMs: Math.round(now() - startedAt), error: null }
  } catch (error) {
    const timedOut = error?.name === 'AbortError'
    return {
      ...target,
      status: 'down',
      latencyMs: null,
      error: timedOut ? `No response in ${timeoutMs} ms` : 'Unreachable',
    }
  } finally {
    clearTimeout(timer)
  }
}

export function checkAllServices(targets = healthTargets, options) {
  return Promise.all(targets.map((target) => checkService(target, options)))
}
