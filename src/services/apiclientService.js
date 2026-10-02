import api from './apiClient.js'

// Endpoints del LAB06 (relativos a `${VITE_API_BASE}/api`):
//   GET    /blueprints?author=:author
//   GET    /blueprints/:author/:name
//   POST   /blueprints
//   PUT    /blueprints/:author/:name
//   DELETE /blueprints/:author/:name
const blueprintsPath = '/blueprints'

function blueprintPath(author, name) {
  return `${blueprintsPath}/${encodeURIComponent(author)}/${encodeURIComponent(name)}`
}

// Acepta tanto respuestas planas como el sobre { code, message, data } del LAB03.
function unwrapResponse(response) {
  return response.data?.data ?? response.data
}

function ensureList(data) {
  if (!Array.isArray(data)) {
    throw new Error('La respuesta del servidor no contiene una lista de planos.')
  }
  return data
}

const apiclient = {
  async getAll() {
    const response = await api.get(blueprintsPath)
    return ensureList(unwrapResponse(response))
  },

  async getByAuthor(author) {
    try {
      const response = await api.get(blueprintsPath, { params: { author } })
      return ensureList(unwrapResponse(response))
    } catch (error) {
      if (error.response?.status === 404) return []
      throw error
    }
  },

  async getByAuthorAndName(author, name) {
    try {
      const response = await api.get(blueprintPath(author, name))
      return unwrapResponse(response)
    } catch (error) {
      if (error.response?.status === 404) return null
      throw error
    }
  },

  async create(blueprint) {
    const response = await api.post(blueprintsPath, blueprint)
    return unwrapResponse(response)
  },

  async update(author, name, blueprint) {
    const response = await api.put(blueprintPath(author, name), blueprint)
    const data = unwrapResponse(response)
    // Algunos backends responden 204 sin cuerpo: se devuelve lo enviado.
    return data && typeof data === 'object' ? data : { ...blueprint, author, name }
  },

  async delete(author, name) {
    await api.delete(blueprintPath(author, name))
    return { author, name }
  },
}

export default apiclient
