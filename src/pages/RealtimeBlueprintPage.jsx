import { useCallback, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import AuthorPanel from '../components/AuthorPanel.jsx'
import BlueprintActionBar from '../components/BlueprintActionBar.jsx'
import BlueprintCanvas from '../components/BlueprintCanvas.jsx'
import RealtimeStatus from '../components/RealtimeStatus.jsx'
import { RT_TECHNOLOGIES } from '../config.js'
import {
  createBlueprint,
  deleteBlueprint,
  draftStarted,
  fetchBlueprint,
  fetchByAuthor,
  pointAdded,
  pointsAppended,
  updateBlueprint,
} from '../features/blueprints/blueprintsSlice.js'
import useRealtimeBlueprint from '../realtime/useRealtimeBlueprint.js'

const technologyLabels = {
  [RT_TECHNOLOGIES.SOCKET_IO]: 'Socket.IO',
  [RT_TECHNOLOGIES.STOMP]: 'STOMP',
}

const CANVAS_WIDTH = 520
const CANVAS_HEIGHT = 360

export default function RealtimeBlueprintPage() {
  const dispatch = useDispatch()
  const {
    byAuthor,
    current,
    byAuthorStatus,
    byAuthorError,
    currentStatus,
    currentError,
    createStatus,
    updateStatus,
    deleteStatus,
  } = useSelector((state) => state.blueprints)

  const [authorInput, setAuthorInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [author, setAuthor] = useState('')
  const [technology, setTechnology] = useState(RT_TECHNOLOGIES.NONE)
  const [notice, setNotice] = useState(null)
  const [actionError, setActionError] = useState(null)

  const items = byAuthor[author] || []
  const busy = [createStatus, updateStatus, deleteStatus].includes('loading')
  const hasBlueprint = Boolean(current) && currentStatus !== 'loading'
  const isNew = Boolean(current?.isNew)

  // Solo se conecta cuando hay un plano abierto (no mientras carga).
  const handleRemoteUpdate = useCallback(
    (update) => dispatch(pointsAppended(update)),
    [dispatch],
  )
  const realtime = useRealtimeBlueprint({
    technology,
    author: hasBlueprint ? current.author : null,
    name: hasBlueprint ? current.name : null,
    onRemoteUpdate: handleRemoteUpdate,
  })

  const refreshAuthor = (target) => dispatch(fetchByAuthor(target))

  // Carga los planos del autor y abre el plano indicado; si no existe, inicia un borrador.
  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextAuthor = authorInput.trim()
    const nextName = nameInput.trim()
    if (!nextAuthor) return

    setAuthor(nextAuthor)
    setNotice(null)
    setActionError(null)
    let list
    try {
      const result = await refreshAuthor(nextAuthor).unwrap()
      list = result.items
    } catch {
      return // El error queda en el estado y lo muestra AuthorPanel.
    }
    if (!nextName) return

    if (list.some((blueprint) => blueprint.name === nextName)) {
      dispatch(fetchBlueprint({ author: nextAuthor, name: nextName }))
    } else {
      dispatch(draftStarted({ author: nextAuthor, name: nextName }))
      setNotice(`New blueprint "${nextName}": click on the canvas and press Create.`)
    }
  }

  const openBlueprint = (blueprint) => {
    setNameInput(blueprint.name)
    setNotice(null)
    setActionError(null)
    dispatch(fetchBlueprint({ author: blueprint.author, name: blueprint.name }))
  }

  const handlePointAdd = (point) => {
    if (!current) return
    dispatch(pointAdded({ author: current.author, name: current.name, point }))
    // El servidor reenvía a los demás de la sala (no al emisor), así que no hay duplicados.
    realtime.publishPoint(point)
  }

  const currentPayload = () => ({
    author: current.author,
    name: current.name,
    points: current.points.map(({ x, y }) => ({ x, y })),
  })

  // Ejecuta Create/Save/Delete y refresca la lista y el total del autor.
  const runAction = async (action, successMessage) => {
    setNotice(null)
    setActionError(null)
    const target = current.author
    try {
      await dispatch(action).unwrap()
      setNotice(successMessage)
      refreshAuthor(target)
    } catch (error) {
      setActionError(error?.message || 'Unexpected error.')
    }
  }

  const handleCreate = () =>
    runAction(createBlueprint(currentPayload()), `Blueprint "${current.name}" created.`)

  const handleSave = () =>
    runAction(
      updateBlueprint({ author: current.author, name: current.name, blueprint: currentPayload() }),
      `Blueprint "${current.name}" saved.`,
    )

  const handleDelete = () => {
    if (!window.confirm(`Delete ${current.author}/${current.name}?`)) return
    const { name } = current
    runAction(deleteBlueprint({ author: current.author, name }), `Blueprint "${name}" deleted.`)
    setNameInput('')
  }

  return (
    <main className="blueprints-layout">
      <section className="blueprints-sidebar" aria-label="Blueprint selection">
        <section className="card search-panel" aria-labelledby="rt-search-title">
          <p className="eyebrow">Collaborative drawing</p>
          <h2 className="panel-title" id="rt-search-title">
            Choose a blueprint
          </h2>
          <form className="rt-form" onSubmit={handleSubmit}>
            <label className="rt-field">
              <span>Author</span>
              <input
                className="input"
                placeholder="e.g. juan"
                required
                value={authorInput}
                onChange={(event) => setAuthorInput(event.target.value)}
              />
            </label>
            <label className="rt-field">
              <span>Blueprint name</span>
              <input
                className="input"
                placeholder="e.g. plano-1 (optional)"
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
              />
            </label>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={!authorInput.trim() || byAuthorStatus === 'loading'}
            >
              Load
            </button>
          </form>
        </section>

        <AuthorPanel
          author={author}
          items={items}
          status={byAuthorStatus}
          error={byAuthorError}
          selectedName={current?.author === author ? current?.name : null}
          openDisabled={currentStatus === 'loading'}
          onOpen={openBlueprint}
          onRetry={() => refreshAuthor(author)}
        />
      </section>

      <section className="card blueprint-viewer" aria-labelledby="rt-current-title">
        <div className="viewer-heading">
          <div>
            <p className="eyebrow">Canvas</p>
            <h2 className="panel-title" id="rt-current-title">
              Current blueprint
            </h2>
          </div>
          <span className="viewer-point-count">
            {current?.points?.length || 0} {current?.points?.length === 1 ? 'point' : 'points'}
          </span>
        </div>

        <p className="current-blueprint-name" aria-live="polite">
          {current ? `${current.author} / ${current.name}` : 'No blueprint selected'}
          {isNew && <span className="draft-badge">Unsaved</span>}
        </p>

        <BlueprintActionBar
          canCreate={hasBlueprint && isNew}
          canSave={hasBlueprint && !isNew}
          canDelete={hasBlueprint && !isNew}
          busy={busy}
          technology={technology}
          onTechnologyChange={setTechnology}
          onCreate={handleCreate}
          onSave={handleSave}
          onDelete={handleDelete}
        />
        <RealtimeStatus
          technologyLabel={technologyLabels[technology]}
          status={realtime.status}
          room={realtime.room}
          error={realtime.error}
        />

        {currentStatus === 'loading' && (
          <p className="status-message" role="status">
            Loading blueprint...
          </p>
        )}
        {currentStatus === 'failed' && (
          <p className="status-message error-message" role="alert">
            Could not open blueprint: {currentError}
          </p>
        )}
        {actionError && (
          <p className="status-message error-message" role="alert">
            {actionError}
          </p>
        )}
        {notice && !actionError && (
          <p className="status-message" role="status">
            {notice}
          </p>
        )}

        <div className="canvas-shell">
          <BlueprintCanvas
            points={current?.points || []}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            interactive={hasBlueprint}
            coordinates="pixels"
            onPointAdd={handlePointAdd}
          />
        </div>
        <p className="canvas-caption">
          {hasBlueprint
            ? 'Click on the canvas to add points. Save to persist them.'
            : 'Load or open a blueprint to start drawing.'}
        </p>
      </section>
    </main>
  )
}
