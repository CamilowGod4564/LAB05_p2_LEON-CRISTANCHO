import { z } from 'zod'

// Límites generosos: el canvas es de 520×360, pero otros clientes pueden usar otro tamaño.
const MAX_COORDINATE = 10000
const MAX_POINTS_PER_UPDATE = 500

// El punto separa las partes de la sala `blueprints.{author}.{name}`: si se permitiera,
// "a.b"/"c" y "a"/"b.c" compartirían sala y se rompería el aislamiento por plano.
const roomSegment = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'only letters, numbers, "-" and "_" are allowed')

export const pointSchema = z.object({
  x: z.number().int().min(0).max(MAX_COORDINATE),
  y: z.number().int().min(0).max(MAX_COORDINATE),
})

export const drawEventSchema = z.object({
  author: roomSegment,
  name: roomSegment,
  point: pointSchema,
})

export const blueprintUpdateSchema = z.object({
  author: roomSegment,
  name: roomSegment,
  points: z.array(pointSchema).min(1).max(MAX_POINTS_PER_UPDATE),
})

function firstIssue(result) {
  const issue = result.error.issues[0]
  return issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message
}

// Devuelve { ok: true, data } o { ok: false, error } sin lanzar excepciones.
function validate(schema, value) {
  const result = schema.safeParse(value)
  return result.success ? { ok: true, data: result.data } : { ok: false, error: firstIssue(result) }
}

export const validateRoomTarget = (author, name) =>
  validate(z.object({ author: roomSegment, name: roomSegment }), { author, name })

export const validateDrawEvent = (event) => validate(drawEventSchema, event)

export const validateBlueprintUpdate = (update) => validate(blueprintUpdateSchema, update)
