const blueprints = [
  {
    author: 'john',
    name: 'house',
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
  },
  {
    author: 'john',
    name: 'garage',
    points: [
      { x: 5, y: 5 },
      { x: 15, y: 5 },
      { x: 15, y: 15 },
    ],
  },
  {
    author: 'jane',
    name: 'garden',
    points: [
      { x: 2, y: 2 },
      { x: 3, y: 4 },
      { x: 6, y: 7 },
    ],
  },
  // Coincide con el plano de ejemplo del backend guía de Socket.IO.
  {
    author: 'juan',
    name: 'plano-1',
    points: [
      { x: 10, y: 10 },
      { x: 40, y: 50 },
    ],
  },
]

function cloneBlueprint(blueprint) {
  return {
    ...blueprint,
    points: blueprint.points.map((point) => ({ ...point })),
  }
}

const apimock = {
  async getAll() {
    return blueprints.map(cloneBlueprint)
  },

  async getByAuthor(author) {
    return blueprints.filter((blueprint) => blueprint.author === author).map(cloneBlueprint)
  },

  async getByAuthorAndName(author, name) {
    const blueprint = blueprints.find(
      (item) => item.author === author && item.name === name,
    )
    return blueprint ? cloneBlueprint(blueprint) : null
  },

  async create(newBlueprint) {
    if (!newBlueprint?.author?.trim() || !newBlueprint?.name?.trim()) {
      throw new Error('El autor y el nombre del plano son obligatorios.')
    }
    if (!Array.isArray(newBlueprint.points) || !newBlueprint.points.length) {
      throw new Error('El plano debe incluir al menos un punto.')
    }

    const blueprint = cloneBlueprint(newBlueprint)
    if (
      blueprints.some(
        (item) => item.author === blueprint.author && item.name === blueprint.name,
      )
    ) {
      throw new Error(`Ya existe el plano ${blueprint.author}/${blueprint.name}.`)
    }

    blueprints.push(blueprint)
    return cloneBlueprint(blueprint)
  },

  async update(author, name, updatedBlueprint) {
    const index = blueprints.findIndex(
      (item) => item.author === author && item.name === name,
    )
    if (index < 0) throw new Error(`No existe el plano ${author}/${name}.`)
    if (!Array.isArray(updatedBlueprint?.points) || !updatedBlueprint.points.length) {
      throw new Error('El plano debe incluir al menos un punto.')
    }

    const blueprint = cloneBlueprint({
      ...blueprints[index],
      ...updatedBlueprint,
      author,
      name,
    })
    blueprints[index] = blueprint
    return cloneBlueprint(blueprint)
  },

  async delete(author, name) {
    const index = blueprints.findIndex(
      (item) => item.author === author && item.name === name,
    )
    if (index < 0) throw new Error(`No existe el plano ${author}/${name}.`)

    blueprints.splice(index, 1)
    return { author, name }
  },
}

export default apimock
