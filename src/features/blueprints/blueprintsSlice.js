import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit'
import blueprintsService from '../../services/blueprintsService.js'

const cloneBlueprint = (blueprint) => ({
  ...blueprint,
  points: (blueprint.points || []).map((point) => ({ ...point })),
})

const sameBlueprint = (first, author, name) =>
  first?.author === author && first?.name === name

const findBlueprintIndex = (items, author, name) =>
  items.findIndex((item) => sameBlueprint(item, author, name))

function upsertBlueprint(items, blueprint, author = blueprint.author, name = blueprint.name) {
  const index = findBlueprintIndex(items, author, name)
  if (index < 0) items.push(blueprint)
  else items[index] = blueprint
}

function removeBlueprint(items, author, name) {
  const index = findBlueprintIndex(items, author, name)
  if (index >= 0) items.splice(index, 1)
}

function restoreOptimisticUpdate(items, author, name, index, original) {
  if (!items) return
  const optimisticIndex = findBlueprintIndex(items, author, name)

  if (!original) {
    if (optimisticIndex >= 0) items.splice(optimisticIndex, 1)
    return
  }

  if (optimisticIndex >= 0) items[optimisticIndex] = original
  else items.splice(Math.min(Math.max(index, 0), items.length), 0, original)
}

export const fetchAuthors = createAsyncThunk('blueprints/fetchAuthors', async () => {
  const blueprints = await blueprintsService.getAll()
  const authors = [...new Set(blueprints.map((blueprint) => blueprint.author))]
  return { authors, blueprints }
})

export const fetchByAuthor = createAsyncThunk('blueprints/fetchByAuthor', async (author) => {
  const items = await blueprintsService.getByAuthor(author)
  return { author, items }
})

export const fetchBlueprint = createAsyncThunk(
  'blueprints/fetchBlueprint',
  async ({ author, name }) => {
    const blueprint = await blueprintsService.getByAuthorAndName(author, name)

    if (!blueprint || !Array.isArray(blueprint.points)) {
      throw new Error('La respuesta del servidor no contiene los puntos del plano.')
    }

    return blueprint
  },
)

export const createBlueprint = createAsyncThunk('blueprints/createBlueprint', async (payload) =>
  blueprintsService.create(payload),
)

export const updateBlueprint = createAsyncThunk(
  'blueprints/updateBlueprint',
  async ({ author, name, blueprint }) => {
    const response = await blueprintsService.update(author, name, blueprint)
    return Array.isArray(response?.points)
      ? {
          ...blueprint,
          ...response,
          author: response.author || author,
          name: response.name || name,
        }
      : blueprint
  },
)

export const deleteBlueprint = createAsyncThunk(
  'blueprints/deleteBlueprint',
  async ({ author, name }) => {
    await blueprintsService.delete(author, name)
    return { author, name }
  },
)

const selectAllBlueprints = (state) => state.blueprints.all

export const selectTopFiveBlueprints = createSelector([selectAllBlueprints], (blueprints) =>
  [...blueprints]
    .sort(
      (first, second) =>
        (second.points?.length || 0) - (first.points?.length || 0) ||
        first.author.localeCompare(second.author) ||
        first.name.localeCompare(second.name),
    )
    .slice(0, 5),
)

const slice = createSlice({
  name: 'blueprints',
  initialState: {
    authors: [],
    all: [],
    byAuthor: {},
    current: null,
    currentStatus: 'idle',
    currentError: null,
    authorsStatus: 'idle',
    authorsError: null,
    byAuthorStatus: 'idle',
    byAuthorError: null,
    createStatus: 'idle',
    createError: null,
    updateStatus: 'idle',
    updateError: null,
    deleteStatus: 'idle',
    deleteError: null,
    optimisticSnapshots: {},
  },
  reducers: {
    // Plano nuevo, aún no guardado en el backend (se crea con Create).
    draftStarted(state, action) {
      const { author, name } = action.payload
      state.current = { author, name, points: [], isNew: true }
      state.currentStatus = 'succeeded'
      state.currentError = null
    },
    // Punto agregado al plano abierto (clic local o evento de tiempo real).
    pointAdded(state, action) {
      const { author, name, point } = action.payload
      if (!sameBlueprint(state.current, author, name)) return
      state.current.points.push({ x: point.x, y: point.y })
    },
    // Puntos recibidos de otro cliente por tiempo real (blueprint-update).
    pointsAppended(state, action) {
      const { author, name, points } = action.payload
      if (!sameBlueprint(state.current, author, name)) return
      for (const point of points) state.current.points.push({ x: point.x, y: point.y })
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAuthors.pending, (state) => {
        state.authorsStatus = 'loading'
        state.authorsError = null
      })
      .addCase(fetchAuthors.fulfilled, (state, action) => {
        state.authorsStatus = 'succeeded'
        state.authors = action.payload.authors
        state.all = action.payload.blueprints
      })
      .addCase(fetchAuthors.rejected, (state, action) => {
        state.authorsStatus = 'failed'
        state.authorsError = action.error.message
      })
      .addCase(fetchByAuthor.fulfilled, (state, action) => {
        state.byAuthor[action.payload.author] = action.payload.items
        state.byAuthorStatus = 'succeeded'
        state.byAuthorError = null
      })
      .addCase(fetchByAuthor.pending, (state, action) => {
        state.byAuthorStatus = 'loading'
        state.byAuthorError = null
        state.byAuthor[action.meta.arg] = []
      })
      .addCase(fetchByAuthor.rejected, (state, action) => {
        state.byAuthorStatus = 'failed'
        state.byAuthorError = action.error.message
      })
      .addCase(fetchBlueprint.fulfilled, (state, action) => {
        state.current = action.payload
        state.currentStatus = 'succeeded'
        state.currentError = null
      })
      .addCase(fetchBlueprint.pending, (state, action) => {
        state.current = { ...action.meta.arg, points: [] }
        state.currentStatus = 'loading'
        state.currentError = null
      })
      .addCase(fetchBlueprint.rejected, (state, action) => {
        state.currentStatus = 'failed'
        state.currentError = action.error.message
      })
      .addCase(createBlueprint.fulfilled, (state, action) => {
        const blueprint = action.payload
        upsertBlueprint(state.all, blueprint)
        if (!state.byAuthor[blueprint.author]) state.byAuthor[blueprint.author] = []
        upsertBlueprint(state.byAuthor[blueprint.author], blueprint)
        if (!state.authors.includes(blueprint.author)) state.authors.push(blueprint.author)
        if (sameBlueprint(state.current, blueprint.author, blueprint.name)) {
          state.current = cloneBlueprint(blueprint)
        }
        state.createStatus = 'succeeded'
        state.createError = null
      })
      .addCase(createBlueprint.pending, (state) => {
        state.createStatus = 'loading'
        state.createError = null
      })
      .addCase(createBlueprint.rejected, (state, action) => {
        state.createStatus = 'failed'
        state.createError = action.error.message
      })
      .addCase(updateBlueprint.pending, (state, action) => {
        const { author, name, blueprint } = action.meta.arg
        const allIndex = findBlueprintIndex(state.all, author, name)
        const authorList = state.byAuthor[author]
        const authorIndex = authorList ? findBlueprintIndex(authorList, author, name) : -1
        const currentMatches = sameBlueprint(state.current, author, name)

        state.optimisticSnapshots[action.meta.requestId] = {
          kind: 'update',
          author,
          name,
          allIndex,
          allOriginal: allIndex >= 0 ? cloneBlueprint(state.all[allIndex]) : null,
          authorIndex,
          authorOriginal:
            authorIndex >= 0 ? cloneBlueprint(authorList[authorIndex]) : null,
          currentMatches,
          currentOriginal: currentMatches ? cloneBlueprint(state.current) : null,
        }

        const optimisticBlueprint = cloneBlueprint(blueprint)
        upsertBlueprint(state.all, optimisticBlueprint, author, name)
        if (authorList) upsertBlueprint(authorList, optimisticBlueprint, author, name)
        if (currentMatches) state.current = optimisticBlueprint
        state.updateStatus = 'loading'
        state.updateError = null
      })
      .addCase(updateBlueprint.fulfilled, (state, action) => {
        const { author, name } = action.meta.arg
        const blueprint = action.payload
        upsertBlueprint(state.all, blueprint, author, name)
        if (state.byAuthor[author]) {
          upsertBlueprint(state.byAuthor[author], blueprint, author, name)
        }
        if (sameBlueprint(state.current, author, name)) state.current = blueprint
        delete state.optimisticSnapshots[action.meta.requestId]
        state.updateStatus = 'succeeded'
        state.updateError = null
      })
      .addCase(updateBlueprint.rejected, (state, action) => {
        const snapshot = state.optimisticSnapshots[action.meta.requestId]
        if (snapshot?.kind === 'update') {
          restoreOptimisticUpdate(
            state.all,
            snapshot.author,
            snapshot.name,
            snapshot.allIndex,
            snapshot.allOriginal,
          )
          restoreOptimisticUpdate(
            state.byAuthor[snapshot.author],
            snapshot.author,
            snapshot.name,
            snapshot.authorIndex,
            snapshot.authorOriginal,
          )
          if (snapshot.currentMatches) state.current = snapshot.currentOriginal
        }
        delete state.optimisticSnapshots[action.meta.requestId]
        state.updateStatus = 'failed'
        state.updateError = action.error.message
      })
      .addCase(deleteBlueprint.pending, (state, action) => {
        const { author, name } = action.meta.arg
        const allIndex = findBlueprintIndex(state.all, author, name)
        const authorList = state.byAuthor[author]
        const authorIndex = authorList ? findBlueprintIndex(authorList, author, name) : -1
        const currentMatches = sameBlueprint(state.current, author, name)
        const blueprint =
          (allIndex >= 0 && state.all[allIndex]) ||
          (authorIndex >= 0 && authorList[authorIndex]) ||
          (currentMatches && state.current)

        state.optimisticSnapshots[action.meta.requestId] = {
          kind: 'delete',
          author,
          name,
          blueprint: blueprint ? cloneBlueprint(blueprint) : null,
          allIndex,
          authorIndex,
          currentMatches,
          currentOriginal: currentMatches ? cloneBlueprint(state.current) : null,
        }
        removeBlueprint(state.all, author, name)
        if (authorList) removeBlueprint(authorList, author, name)
        if (currentMatches) state.current = null
        state.deleteStatus = 'loading'
        state.deleteError = null
      })
      .addCase(deleteBlueprint.fulfilled, (state, action) => {
        delete state.optimisticSnapshots[action.meta.requestId]
        const { author } = action.meta.arg
        if (!state.all.some((blueprint) => blueprint.author === author)) {
          state.authors = state.authors.filter((item) => item !== author)
        }
        state.deleteStatus = 'succeeded'
        state.deleteError = null
      })
      .addCase(deleteBlueprint.rejected, (state, action) => {
        const snapshot = state.optimisticSnapshots[action.meta.requestId]
        if (snapshot?.kind === 'delete' && snapshot.blueprint) {
          if (snapshot.allIndex >= 0) {
            state.all.splice(
              Math.min(snapshot.allIndex, state.all.length),
              0,
              snapshot.blueprint,
            )
          }
          if (snapshot.authorIndex >= 0 && state.byAuthor[snapshot.author]) {
            state.byAuthor[snapshot.author].splice(
              Math.min(snapshot.authorIndex, state.byAuthor[snapshot.author].length),
              0,
              snapshot.blueprint,
            )
          }
          if (snapshot.currentMatches) state.current = snapshot.currentOriginal
        }
        delete state.optimisticSnapshots[action.meta.requestId]
        state.deleteStatus = 'failed'
        state.deleteError = action.error.message
      })
  },
})

export const { draftStarted, pointAdded, pointsAppended } = slice.actions

export default slice.reducer
