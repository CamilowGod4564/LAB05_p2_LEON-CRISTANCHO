// Logs de tiempo real (conexión, eventos). Se silencian en las pruebas.
const enabled = import.meta.env.MODE !== 'test'

export const rtLogger = {
  info: (...args) => enabled && console.info('[RT]', ...args),
  warn: (...args) => enabled && console.warn('[RT]', ...args),
}
