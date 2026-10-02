// Número de puntos de un plano. La lista por autor puede traer el arreglo
// `points` o solo un conteo (`totalPoints` / `pointsCount`) según el backend.
export function countPoints(blueprint) {
  if (Array.isArray(blueprint?.points)) return blueprint.points.length
  const count = blueprint?.totalPoints ?? blueprint?.pointsCount
  return Number.isFinite(count) ? count : 0
}

// Total de puntos de todos los planos de un autor.
export function totalPoints(blueprints = []) {
  return blueprints.reduce((total, blueprint) => total + countPoints(blueprint), 0)
}
