const env = import.meta.env

function trimTrailingSlash(url) {
  return url.replace(/\/+$/, '')
}

export const API_BASE = trimTrailingSlash(env.VITE_API_BASE || 'http://localhost:8080')
export const AUTH_BASE = trimTrailingSlash(env.VITE_AUTH_BASE || API_BASE)
export const IO_BASE = trimTrailingSlash(env.VITE_IO_BASE || 'http://localhost:3001')
export const STOMP_BASE = trimTrailingSlash(env.VITE_STOMP_BASE || 'http://localhost:8080')
export const STOMP_PATH = env.VITE_STOMP_PATH || '/ws-blueprints'
export const USE_MOCK = env.VITE_USE_MOCK === 'true'

export const RT_TECHNOLOGIES = Object.freeze({
  NONE: 'none',
  SOCKET_IO: 'socketio',
  STOMP: 'stomp',
})

export function roomFor(author, name) {
  return `blueprints.${author}.${name}`
}
